import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { createClient, type Client as LibsqlClient } from '@libsql/client/node';
import { createHmac, timingSafeEqual } from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sendStatusEmail } from './src/lib/email';
import multer from 'multer';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const stored = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
    cb(null, stored);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedExts.includes(ext) && (allowedMimes.includes(file.mimetype) || ext === '.pdf' || ext === '.jpg' || ext === '.jpeg' || ext === '.png')) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG.'));
    }
  },
});

const csvUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo CSV.'));
    }
  },
});

type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO';
type Recommendation = 'APROBADO_PRIORIDAD_ALTA' | 'APROBADO_CONDICIONAL' | 'REQUIERE_COMITE' | 'NO_ELEGIBLE';

interface CensusInput {
  nombre_apellido: string;
  cedula: string;
  telefono: string;
  correo: string;
  region_sede?: string | null;
  vicepresidencia?: string | null;
  direccion_ejecutiva?: string | null;
  gerencia: string;
  unidad_operativa?: string | null;
  anos_servicio: number;
  cargo: string;
  ingreso_individual: number;
  ingreso_familiar: number;
  afiliado_cacref: boolean;
  capacidad_cuota: number;
  requiere_medicamento_cronico: boolean;
  medicamento_detalle?: string | null;
  requiere_cirugia: boolean;
  cirugia_detalle?: string | null;
  familiar_requiere_asistencia: boolean;
  calidad_vida_escala: number;
}

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;
const useTurso = Boolean(tursoUrl);
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'change_this_secret_in_production';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h
const ADMIN_COOKIE_NAME = 'admin_session';

type AdminRole = 'capturista' | 'vocal' | 'presidente' | 'director';

const DEMO_PASSWORD_HASH = '$2b$10$fETDCGLMEEKDNvqCikPtIejMQY90zD3nrAJTEq2Aot5tRbxebqSje';

const ADMIN_USERS: Record<string, { passwordHash: string; role: AdminRole; name: string }> = {
  admin: { passwordHash: process.env.ADMIN_PASS_HASH || DEMO_PASSWORD_HASH, role: 'director', name: 'Director General' },
  presidente: { passwordHash: process.env.PRES_PASS_HASH || DEMO_PASSWORD_HASH, role: 'presidente', name: 'Presidente del Comite' },
  vocal: { passwordHash: process.env.VOCAL_PASS_HASH || DEMO_PASSWORD_HASH, role: 'vocal', name: 'Vocal del Comite' },
  capturista: { passwordHash: process.env.CAPT_PASS_HASH || DEMO_PASSWORD_HASH, role: 'capturista', name: 'Capturista' },
};

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  capturista: 1,
  vocal: 2,
  presidente: 3,
  director: 4,
};

function hasRole(actualRole: AdminRole | undefined, requiredRole: AdminRole): boolean {
  if (!actualRole) return false;
  return ROLE_HIERARCHY[actualRole] >= ROLE_HIERARCHY[requiredRole];
}

const tursoClient: LibsqlClient | null = useTurso
  ? createClient({
      url: tursoUrl!,
      authToken: tursoToken,
    })
  : null;

const localDb: Database.Database | null = useTurso ? null : new Database('census.db');

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown) {
  return String(value ?? '').trim();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function signSessionPayload(payloadBase64: string) {
  return createHmac('sha256', ADMIN_SESSION_SECRET).update(payloadBase64).digest('base64url');
}

function createSessionToken(username: string, role: AdminRole) {
  const payloadBase64 = Buffer.from(
    JSON.stringify({ u: username, r: role, exp: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000 })
  ).toString('base64url');
  const signature = signSessionPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

function verifySessionToken(token?: string | null): { username: string; role: AdminRole } | null {
  if (!token || !token.includes('.')) return null;
  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) return null;

  const expectedSignature = signSessionPayload(payloadBase64);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as { u?: string; r?: AdminRole; exp?: number };
    if (!payload?.u || !payload?.r || !payload?.exp) return null;
    if (!ADMIN_USERS[payload.u]) return null;
    if (Date.now() > payload.exp) return null;
    return { username: payload.u, role: payload.r };
  } catch {
    return null;
  }
}

function parseCookies(rawCookieHeader?: string) {
  const cookies: Record<string, string> = {};
  if (!rawCookieHeader) return cookies;
  const pairs = rawCookieHeader.split(';');
  for (const pair of pairs) {
    const [name, ...rest] = pair.trim().split('=');
    if (!name) continue;
    cookies[name] = decodeURIComponent(rest.join('=') || '');
  }
  return cookies;
}

function normalizeInput(payload: any): CensusInput {
  const anosServicio = Math.max(toNumber(payload.anos_servicio), 0);
  const ingresoIndividual = Math.max(toNumber(payload.ingreso_individual), 0);
  const ingresoFamiliar = Math.max(toNumber(payload.ingreso_familiar), 0);
  const capacidadCuota = Math.max(toNumber(payload.capacidad_cuota), 0);
  const calidadVida = clamp(toNumber(payload.calidad_vida_escala, 5), 1, 10);

  return {
    nombre_apellido: toText(payload.nombre_apellido),
    cedula: toText(payload.cedula),
    telefono: toText(payload.telefono),
    correo: toText(payload.correo),
    region_sede: toText(payload.region_sede) || null,
    vicepresidencia: toText(payload.vicepresidencia) || null,
    direccion_ejecutiva: toText(payload.direccion_ejecutiva) || null,
    gerencia: toText(payload.gerencia),
    unidad_operativa: toText(payload.unidad_operativa) || null,
    anos_servicio: anosServicio,
    cargo: toText(payload.cargo),
    ingreso_individual: ingresoIndividual,
    ingreso_familiar: ingresoFamiliar,
    afiliado_cacref: Boolean(payload.afiliado_cacref),
    capacidad_cuota: capacidadCuota,
    requiere_medicamento_cronico: Boolean(payload.requiere_medicamento_cronico),
    medicamento_detalle: toText(payload.medicamento_detalle) || null,
    requiere_cirugia: Boolean(payload.requiere_cirugia),
    cirugia_detalle: toText(payload.cirugia_detalle) || null,
    familiar_requiere_asistencia: Boolean(payload.familiar_requiere_asistencia),
    calidad_vida_escala: calidadVida,
  };
}

function validateCensusInput(data: CensusInput) {
  const missing: string[] = [];
  if (!data.nombre_apellido) missing.push('nombre y apellido');
  if (!data.cedula) missing.push('cedula');
  if (!data.telefono) missing.push('telefono');
  if (!data.correo) missing.push('correo');
  if (!data.gerencia) missing.push('gerencia');
  if (!data.cargo) missing.push('cargo');
  if (data.requiere_medicamento_cronico && !data.medicamento_detalle) missing.push('detalle de medicamento cronico');
  if (data.requiere_cirugia && !data.cirugia_detalle) missing.push('detalle de cirugia');

  if (missing.length > 0) {
    return `Complete los campos obligatorios: ${missing.join(', ')}.`;
  }

  if (!data.correo.includes('@')) {
    return 'Ingrese un correo electronico valido.';
  }

  return null;
}

function evaluateApplicant(data: CensusInput) {
  const years = clamp(data.anos_servicio, 0, 40);
  const income = Math.max(data.ingreso_individual, 0);
  const familyIncome = Math.max(data.ingreso_familiar, 0);
  const monthlyQuota = Math.max(data.capacidad_cuota, 0);
  const affordabilityRatio = income > 0 ? monthlyQuota / income : 0;
  const suggestedMaxQuota = round2(income * 0.35);
  const householdSupportRatio = income > 0 ? familyIncome / income : 1;

  const seniorityScore = clamp((years / 15) * 22, 0, 22);
  const paymentCapacityScore = clamp((monthlyQuota / 420) * 28, 0, 28);

  let affordabilityScore = 0;
  if (affordabilityRatio >= 0.18 && affordabilityRatio <= 0.35) affordabilityScore = 24;
  else if (affordabilityRatio > 0.35 && affordabilityRatio <= 0.45) affordabilityScore = 16;
  else if (affordabilityRatio > 0.45 && affordabilityRatio <= 0.55) affordabilityScore = 8;
  else if (affordabilityRatio >= 0.1 && affordabilityRatio < 0.18) affordabilityScore = 10;
  else affordabilityScore = 2;

  let healthNeedScore = 0;
  if (data.requiere_cirugia) healthNeedScore += 25;
  if (data.requiere_medicamento_cronico) healthNeedScore += 15;
  if (data.familiar_requiere_asistencia) healthNeedScore += 10;
  
  // Lower quality of life = higher priority score (1 = bad, 10 = good)
  const qolPenalty = (10 - data.calidad_vida_escala) * 1.5;
  healthNeedScore += qolPenalty;
  healthNeedScore = clamp(healthNeedScore, 0, 45);

  const cooperativeBonus = data.afiliado_cacref ? 6 : 0;
  const householdSupportScore = clamp((householdSupportRatio - 1) * 4, 0, 4);

  const score = clamp(
    seniorityScore +
      paymentCapacityScore +
      affordabilityScore +
      healthNeedScore +
      cooperativeBonus +
      householdSupportScore,
    0,
    100
  );

  let riskLevel: RiskLevel = 'BAJO';
  if (data.requiere_cirugia || data.calidad_vida_escala <= 3) riskLevel = 'ALTO';
  else if (data.requiere_medicamento_cronico || data.calidad_vida_escala <= 5) riskLevel = 'MEDIO';

  let recommendation: Recommendation = 'NO_ELEGIBLE';
  let priorityBucket = 4;
  if (score >= 80 && riskLevel === 'BAJO') {
    recommendation = 'APROBADO_PRIORIDAD_ALTA';
    priorityBucket = 1;
  } else if (score >= 65 && riskLevel !== 'ALTO') {
    recommendation = 'APROBADO_CONDICIONAL';
    priorityBucket = 2;
  } else if (score >= 50) {
    recommendation = 'REQUIERE_COMITE';
    priorityBucket = 3;
  }

  return {
    score: round2(score),
    score_seniority: round2(seniorityScore),
    score_payment_capacity: round2(paymentCapacityScore),
    score_affordability: round2(affordabilityScore),
    score_health_need: round2(healthNeedScore),
    score_cooperative_bonus: round2(cooperativeBonus + householdSupportScore),
    affordability_ratio: round2(affordabilityRatio),
    suggested_max_quota: suggestedMaxQuota,
    risk_level: riskLevel,
    recommendation,
    priority_bucket: priorityBucket,
  };
}

async function execSql(sql: string) {
  if (tursoClient) {
    await tursoClient.execute(sql);
    return;
  }
  localDb!.exec(sql);
}

async function queryAll<T = any>(sql: string, args: Array<string | number | null> = []): Promise<T[]> {
  if (tursoClient) {
    const rs = await tursoClient.execute({ sql, args });
    return rs.rows as T[];
  }
  return localDb!.prepare(sql).all(...args) as T[];
}

async function queryOne<T = any>(sql: string, args: Array<string | number | null> = []): Promise<T | undefined> {
  if (tursoClient) {
    const rs = await tursoClient.execute({ sql, args });
    return rs.rows[0] as T | undefined;
  }
  return localDb!.prepare(sql).get(...args) as T | undefined;
}

async function runSql(sql: string, args: Array<string | number | null> = []) {
  if (tursoClient) {
    const rs = await tursoClient.execute({ sql, args });
    return { lastInsertRowid: Number(rs.lastInsertRowid ?? 0) };
  }
  const rs = localDb!.prepare(sql).run(...args);
  return { lastInsertRowid: Number(rs.lastInsertRowid ?? 0) };
}

async function ensureColumn(columnName: string, definition: string) {
  const columns = await queryAll<{ name: string }>('PRAGMA table_info(census_submissions)');
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await execSql(`ALTER TABLE census_submissions ADD COLUMN ${columnName} ${definition}`);
  }
}

async function initDatabase() {
  await execSql(`
    CREATE TABLE IF NOT EXISTS census_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_apellido TEXT NOT NULL,
      cedula TEXT NOT NULL UNIQUE,
      telefono TEXT NOT NULL,
      correo TEXT NOT NULL,
      region_sede TEXT,
      vicepresidencia TEXT,
      direccion_ejecutiva TEXT,
      gerencia TEXT NOT NULL,
      unidad_operativa TEXT,
      anos_servicio INTEGER NOT NULL,
      cargo TEXT NOT NULL,
      ingreso_individual REAL NOT NULL,
      ingreso_familiar REAL NOT NULL,
      afiliado_cacref BOOLEAN NOT NULL,
      capacidad_cuota REAL NOT NULL,
      posee_vehiculo BOOLEAN NOT NULL DEFAULT 0,
      vehiculo_ano INTEGER,
      vehiculo_modelo TEXT,
      vehiculo_marca TEXT,
      vehiculo_estado TEXT,
      vehiculo_aspirado TEXT NOT NULL DEFAULT 'NO APLICA - CENSO SALUD',
      requiere_medicamento_cronico BOOLEAN NOT NULL,
      medicamento_detalle TEXT,
      requiere_cirugia BOOLEAN NOT NULL,
      cirugia_detalle TEXT,
      familiar_requiere_asistencia BOOLEAN NOT NULL,
      calidad_vida_escala INTEGER NOT NULL,
      score REAL NOT NULL,
      score_seniority REAL,
      score_payment_capacity REAL,
      score_affordability REAL,
      score_health_need REAL,
      score_cooperative_bonus REAL,
      affordability_ratio REAL,
      suggested_max_quota REAL,
      risk_level TEXT,
      recommendation TEXT,
      priority_bucket INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn('vicepresidencia', 'TEXT');
  await ensureColumn('direccion_ejecutiva', 'TEXT');
  await ensureColumn('unidad_operativa', 'TEXT');
  await ensureColumn('posee_vehiculo', 'BOOLEAN NOT NULL DEFAULT 0');
  await ensureColumn('vehiculo_ano', 'INTEGER');
  await ensureColumn('vehiculo_modelo', 'TEXT');
  await ensureColumn('vehiculo_marca', 'TEXT');
  await ensureColumn('vehiculo_estado', 'TEXT');
  await ensureColumn('vehiculo_aspirado', "TEXT NOT NULL DEFAULT 'NO APLICA - CENSO SALUD'");
  await ensureColumn('requiere_medicamento_cronico', 'BOOLEAN NOT NULL DEFAULT 0');
  await ensureColumn('medicamento_detalle', 'TEXT');
  await ensureColumn('requiere_cirugia', 'BOOLEAN NOT NULL DEFAULT 0');
  await ensureColumn('cirugia_detalle', 'TEXT');
  await ensureColumn('familiar_requiere_asistencia', 'BOOLEAN NOT NULL DEFAULT 0');
  await ensureColumn('calidad_vida_escala', 'INTEGER NOT NULL DEFAULT 5');
  await ensureColumn('score_seniority', 'REAL');
  await ensureColumn('score_payment_capacity', 'REAL');
  await ensureColumn('score_affordability', 'REAL');
  await ensureColumn('score_health_need', 'REAL');
  await ensureColumn('score_cooperative_bonus', 'REAL');
  await ensureColumn('affordability_ratio', 'REAL');
  await ensureColumn('suggested_max_quota', 'REAL');
  await ensureColumn('risk_level', 'TEXT');
  await ensureColumn('recommendation', 'TEXT');
  await ensureColumn('priority_bucket', 'INTEGER');
  await ensureColumn('workflow_status', "TEXT NOT NULL DEFAULT 'REGISTRADO'");
  await ensureColumn('workflow_notes', 'TEXT');
  await ensureColumn('workflow_updated_at', 'DATETIME');
  await ensureColumn('decision_tipo', 'TEXT');
  await ensureColumn('decision_monto', 'REAL');
  await ensureColumn('decision_observaciones', 'TEXT');
  await ensureColumn('decision_at', 'DATETIME');
  await ensureColumn('assigned_to', 'TEXT');
  await ensureColumn('has_document', "BOOLEAN NOT NULL DEFAULT 0");

  await execSql(`
    CREATE TABLE IF NOT EXISTS workflow_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      note TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
    )
  `);

  await execSql(`
    CREATE TABLE IF NOT EXISTS submission_files (
      id TEXT PRIMARY KEY,
      submission_id INTEGER,
      file_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
    )
  `);

  await execSql(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await execSql(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_target TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      target_type TEXT,
      target_id TEXT,
      actor TEXT,
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await execSql(`
    CREATE TABLE IF NOT EXISTS case_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      author_role TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
    )
  `);

  await execSql('CREATE INDEX IF NOT EXISTS idx_census_score ON census_submissions(score)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_census_priority ON census_submissions(priority_bucket, score)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_census_gerencia ON census_submissions(gerencia)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_census_risk_reco ON census_submissions(risk_level, recommendation)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_census_created_at ON census_submissions(created_at)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_history_submission ON workflow_history(submission_id, changed_at)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_census_workflow_status ON census_submissions(workflow_status)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications(user_target, read_at, created_at)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at)');
  await execSql('CREATE INDEX IF NOT EXISTS idx_comments_submission ON case_comments(submission_id, created_at)');
}

async function backfillEvaluations() {
  const rows = await queryAll<any>(`
    SELECT *
    FROM census_submissions
    WHERE recommendation IS NULL OR risk_level IS NULL OR priority_bucket IS NULL
  `);

  for (const row of rows) {
    const normalized: CensusInput = {
      nombre_apellido: row.nombre_apellido ?? '',
      cedula: row.cedula ?? '',
      telefono: row.telefono ?? '',
      correo: row.correo ?? '',
      region_sede: row.region_sede ?? null,
      vicepresidencia: row.vicepresidencia ?? null,
      direccion_ejecutiva: row.direccion_ejecutiva ?? null,
      gerencia: row.gerencia ?? '',
      unidad_operativa: row.unidad_operativa ?? null,
      anos_servicio: toNumber(row.anos_servicio),
      cargo: row.cargo ?? '',
      ingreso_individual: toNumber(row.ingreso_individual),
      ingreso_familiar: toNumber(row.ingreso_familiar),
      afiliado_cacref: Boolean(row.afiliado_cacref),
      capacidad_cuota: toNumber(row.capacidad_cuota),
      requiere_medicamento_cronico: Boolean(row.requiere_medicamento_cronico),
      medicamento_detalle: row.medicamento_detalle ?? null,
      requiere_cirugia: Boolean(row.requiere_cirugia),
      cirugia_detalle: row.cirugia_detalle ?? null,
      familiar_requiere_asistencia: Boolean(row.familiar_requiere_asistencia),
      calidad_vida_escala: toNumber(row.calidad_vida_escala, 5),
    };

    const evaluation = evaluateApplicant(normalized);
    await runSql(
      `
      UPDATE census_submissions
      SET
        score = ?,
        score_seniority = ?,
        score_payment_capacity = ?,
        score_affordability = ?,
        score_health_need = ?,
        score_cooperative_bonus = ?,
        affordability_ratio = ?,
        suggested_max_quota = ?,
        risk_level = ?,
        recommendation = ?,
        priority_bucket = ?
      WHERE id = ?
      `,
      [
        evaluation.score,
        evaluation.score_seniority,
        evaluation.score_payment_capacity,
        evaluation.score_affordability,
        evaluation.score_health_need,
        evaluation.score_cooperative_bonus,
        evaluation.affordability_ratio,
        evaluation.suggested_max_quota,
        evaluation.risk_level,
        evaluation.recommendation,
        evaluation.priority_bucket,
        Number(row.id),
      ]
    );
  }
}

async function startServer() {
  await initDatabase();
  await backfillEvaluations();

  const app = express();
  const PORT = Number(process.env.PORT) || 7842;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '1mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
    next();
  });

  const setAdminCookie = (res: express.Response, token: string) => {
    const cookie = `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ADMIN_SESSION_TTL_SECONDS}${isProd ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', cookie);
  };

  const clearAdminCookie = (res: express.Response) => {
    const cookie = `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProd ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', cookie);
  };

  const getSession = (req: express.Request) => {
    const cookies = parseCookies(req.headers.cookie);
    return verifySessionToken(cookies[ADMIN_COOKIE_NAME]);
  };

  async function logAudit(opts: {
    req: express.Request;
    actor: string;
    role: AdminRole;
    action: string;
    target_type?: string;
    target_id?: string | number;
    details?: any;
  }) {
    const ip = (opts.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || opts.req.socket.remoteAddress
      || null;
    const ua = String(opts.req.headers['user-agent'] || '').slice(0, 250) || null;
    try {
      await runSql(
        `INSERT INTO audit_log (actor, actor_role, action, target_type, target_id, details, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          opts.actor,
          opts.role,
          opts.action,
          opts.target_type || null,
          opts.target_id != null ? String(opts.target_id) : null,
          opts.details ? JSON.stringify(opts.details).slice(0, 2000) : null,
          ip,
          ua,
        ]
      );
    } catch (err) {
      console.error('Audit log failed:', err);
    }
  }

  const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  const lastActivity = new Map<string, number>();
  const rateLimits = new Map<string, { count: number; first: number; blockedUntil?: number }>();

  function getClientIp(req: express.Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || 'unknown';
  }

  function checkRateLimit(key: string, max: number, windowMs: number, blockMs = 0): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = rateLimits.get(key);
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
    }
    if (entry && now - entry.first > windowMs) {
      rateLimits.delete(key);
    }
    const current = rateLimits.get(key);
    if (!current) {
      rateLimits.set(key, { count: 1, first: now });
      return { allowed: true };
    }
    current.count += 1;
    rateLimits.set(key, current);
    if (current.count > max) {
      if (blockMs > 0) current.blockedUntil = now + blockMs;
      return { allowed: false, retryAfter: Math.ceil((blockMs || windowMs) / 1000) };
    }
    return { allowed: true };
  }

  const rateLimitMiddleware = (key: string, max: number, windowMs: number, blockMs = 0) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = getClientIp(req);
    const result = checkRateLimit(`${key}:${ip}`, max, windowMs, blockMs);
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfter || 60));
      res.status(429).json({ error: 'Demasiadas solicitudes. Intente de nuevo en unos minutos.' });
      return;
    }
    next();
  };

  const requireFreshSession = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const cookies = parseCookies(req.headers.cookie);
    const lastSeen = lastActivity.get(cookies[ADMIN_COOKIE_NAME] || '');
    if (lastSeen && Date.now() - lastSeen > SESSION_IDLE_TIMEOUT_MS) {
      clearAdminCookie(res);
      res.status(401).json({ error: 'Sesion expirada por inactividad. Vuelva a iniciar sesion.' });
      return;
    }
    lastActivity.set(cookies[ADMIN_COOKIE_NAME] || '', Date.now());
    next();
  };

  async function createNotification(opts: {
    user_target: string;
    type: string;
    title: string;
    body?: string;
    target_type?: string;
    target_id?: string | number;
    actor?: string;
  }) {
    try {
      await runSql(
        `INSERT INTO notifications (user_target, type, title, body, target_type, target_id, actor)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          opts.user_target,
          opts.type,
          opts.title,
          opts.body || null,
          opts.target_type || null,
          opts.target_id != null ? String(opts.target_id) : null,
          opts.actor || null,
        ]
      );
    } catch (err) {
      console.error('Notification create failed:', err);
    }
  }

  function usernameFromAssignee(assignee: string | null | undefined): string | null {
    if (!assignee) return null;
    const entry = Object.entries(ADMIN_USERS).find(([_, info]) => info.name === assignee);
    return entry ? entry[0] : null;
  }

  const isAdminAuthenticated = (req: express.Request) => {
    return getSession(req) !== null;
  };

  const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const cookies = parseCookies(req.headers.cookie);
    const cookieValue = cookies[ADMIN_COOKIE_NAME];
    const lastSeen = lastActivity.get(cookieValue || '');
    if (lastSeen && Date.now() - lastSeen > SESSION_IDLE_TIMEOUT_MS) {
      clearAdminCookie(res);
      res.status(401).json({ error: 'Sesion expirada por inactividad. Vuelva a iniciar sesion.' });
      return;
    }
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
    if (cookieValue) lastActivity.set(cookieValue, Date.now());
    (req as any).session = session;
    next();
  };

  const requireRole = (role: AdminRole) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const cookies = parseCookies(req.headers.cookie);
    const cookieValue = cookies[ADMIN_COOKIE_NAME];
    const lastSeen = lastActivity.get(cookieValue || '');
    if (lastSeen && Date.now() - lastSeen > SESSION_IDLE_TIMEOUT_MS) {
      clearAdminCookie(res);
      res.status(401).json({ error: 'Sesion expirada por inactividad. Vuelva a iniciar sesion.' });
      return;
    }
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
    if (!hasRole(session.role, role)) {
      res.status(403).json({ error: 'Permisos insuficientes', required: role, actual: session.role });
      return;
    }
    if (cookieValue) lastActivity.set(cookieValue, Date.now());
    (req as any).session = session;
    next();
  };

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', db: useTurso ? 'turso' : 'sqlite' });
  });

  app.post('/api/admin/login', rateLimitMiddleware('login', 5, 15 * 60 * 1000, 15 * 60 * 1000), async (req, res) => {
    const user = toText(req.body?.user);
    const pass = toText(req.body?.pass);
    const entry = ADMIN_USERS[user];
    if (!entry || !(await bcrypt.compare(pass, entry.passwordHash))) {
      logAudit({ req, actor: user || 'unknown', role: 'capturista', action: 'login_failed', details: { user } });
      res.status(401).json({ error: 'Credenciales incorrectas' });
      return;
    }
    const token = createSessionToken(user, entry.role);
    setAdminCookie(res, token);
    logAudit({ req, actor: user, role: entry.role, action: 'login_success' });
    res.json({
      success: true,
      user: { username: user, role: entry.role, name: entry.name },
    });
  });

  app.post('/api/admin/logout', (req, res) => {
    const session = getSession(req);
    if (session) {
      logAudit({ req, actor: session.username, role: session.role, action: 'logout' });
    }
    clearAdminCookie(res);
    res.json({ success: true });
  });

  app.get('/api/admin/me', (req, res) => {
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
    const entry = ADMIN_USERS[session.username];
    res.json({
      ok: true,
      user: { username: session.username, role: session.role, name: entry?.name || session.username },
    });
  });

  app.get('/api/admin/users', requireRole('director'), (_req, res) => {
    const list = Object.entries(ADMIN_USERS).map(([username, info]) => ({
      username,
      role: info.role,
      name: info.name,
    }));
    res.json(list);
  });

  app.post('/api/admin/submissions/bulk-import', csvUpload.single('file'), requireRole('capturista'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No se recibio ningun archivo.' });
        return;
      }
      const content = fs.readFileSync(req.file.path, 'utf8');
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'El CSV debe tener al menos un encabezado y una fila.' });
        return;
      }

      const parseRow = (line: string): string[] => {
        const out: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; continue; }
          cur += ch;
        }
        out.push(cur);
        return out;
      };

      const header = parseRow(lines[0]).map(h => h.trim().toLowerCase());
      const requiredCols = ['nombre_apellido', 'cedula', 'telefono', 'correo', 'gerencia', 'anos_servicio', 'cargo', 'ingreso_individual', 'ingreso_familiar', 'capacidad_cuota', 'calidad_vida_escala'];
      const missing = requiredCols.filter(c => !header.includes(c));
      if (missing.length > 0) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: `Columnas requeridas faltantes: ${missing.join(', ')}` });
        return;
      }

      const colIndex = (col: string) => header.indexOf(col);
      const results = { inserted: 0, skipped: 0, errors: [] as Array<{ row: number; cedula: string; error: string }> };

      if (!localDb) {
        fs.unlinkSync(req.file.path);
        res.status(501).json({ error: 'La importacion masiva solo esta habilitada en modo local por ahora.' });
        return;
      }

      const insertStmt = localDb.prepare(`
        INSERT INTO census_submissions (
          nombre_apellido, cedula, telefono, correo, region_sede, vicepresidencia,
          direccion_ejecutiva, gerencia, unidad_operativa,
          anos_servicio, cargo, ingreso_individual, ingreso_familiar, afiliado_cacref,
          capacidad_cuota, posee_vehiculo, vehiculo_ano, vehiculo_modelo, vehiculo_marca,
          vehiculo_estado, vehiculo_aspirado, requiere_medicamento_cronico, medicamento_detalle, requiere_cirugia, cirugia_detalle,
          familiar_requiere_asistencia, calidad_vida_escala, score,
          score_seniority, score_payment_capacity, score_affordability, score_health_need,
          score_cooperative_bonus, affordability_ratio, suggested_max_quota, risk_level,
          recommendation, priority_bucket
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertHistoryStmt = localDb.prepare(`
        INSERT INTO workflow_history (submission_id, from_status, to_status, note, changed_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      const session = (req as any).session as { username: string; role: AdminRole };

      for (let i = 1; i < lines.length; i++) {
        const row = parseRow(lines[i]);
        if (row.length !== header.length) {
          results.errors.push({ row: i + 1, cedula: '', error: `Columnas esperadas ${header.length}, recibidas ${row.length}` });
          continue;
        }
        const get = (col: string) => (colIndex(col) >= 0 ? (row[colIndex(col)] || '').trim() : '');

        const cedula = get('cedula');
        if (!cedula || !/^\d{5,12}$/.test(cedula)) {
          results.errors.push({ row: i + 1, cedula, error: 'Cedula invalida' });
          results.skipped++;
          continue;
        }

        const data: CensusInput = {
          nombre_apellido: get('nombre_apellido'),
          cedula,
          telefono: get('telefono'),
          correo: get('correo'),
          region_sede: get('region_sede') || null,
          vicepresidencia: get('vicepresidencia') || null,
          direccion_ejecutiva: get('direccion_ejecutiva') || null,
          gerencia: get('gerencia'),
          unidad_operativa: get('unidad_operativa') || null,
          anos_servicio: toNumber(get('anos_servicio')),
          cargo: get('cargo'),
          ingreso_individual: toNumber(get('ingreso_individual')),
          ingreso_familiar: toNumber(get('ingreso_familiar')),
          afiliado_cacref: get('afiliado_cacref') === '1' || get('afiliado_cacref').toLowerCase() === 'true',
          capacidad_cuota: toNumber(get('capacidad_cuota')),
          requiere_medicamento_cronico: get('requiere_medicamento_cronico') === '1' || get('requiere_medicamento_cronico').toLowerCase() === 'true',
          medicamento_detalle: get('medicamento_detalle') || null,
          requiere_cirugia: get('requiere_cirugia') === '1' || get('requiere_cirugia').toLowerCase() === 'true',
          cirugia_detalle: get('cirugia_detalle') || null,
          familiar_requiere_asistencia: get('familiar_requiere_asistencia') === '1' || get('familiar_requiere_asistencia').toLowerCase() === 'true',
          calidad_vida_escala: clamp(toNumber(get('calidad_vida_escala'), 5), 1, 10),
        };

        const validationError = validateCensusInput(data);
        if (validationError) {
          results.errors.push({ row: i + 1, cedula, error: validationError });
          results.skipped++;
          continue;
        }

        const ev = evaluateApplicant(data);
        const now = new Date().toISOString();
        try {
          const result = insertStmt.run(
            data.nombre_apellido, data.cedula, data.telefono, data.correo,
            data.region_sede || 'No especificada', data.vicepresidencia, data.direccion_ejecutiva,
            data.gerencia, data.unidad_operativa, data.anos_servicio, data.cargo,
            data.ingreso_individual, data.ingreso_familiar, data.afiliado_cacref ? 1 : 0,
            data.capacidad_cuota, 0, null, null, null, null, 'NO APLICA - CENSO SALUD',
            data.requiere_medicamento_cronico ? 1 : 0, data.medicamento_detalle,
            data.requiere_cirugia ? 1 : 0, data.cirugia_detalle,
            data.familiar_requiere_asistencia ? 1 : 0, data.calidad_vida_escala,
            ev.score, ev.score_seniority, ev.score_payment_capacity, ev.score_affordability,
            ev.score_health_need, ev.score_cooperative_bonus, ev.affordability_ratio,
            ev.suggested_max_quota, ev.risk_level, ev.recommendation, ev.priority_bucket
          );
          insertHistoryStmt.run(result.lastInsertRowid, null, 'REGISTRADO', `Carga masiva por ${session.username}`, now);
          results.inserted++;
        } catch (err: any) {
          if (String(err.message || '').toLowerCase().includes('unique')) {
            results.errors.push({ row: i + 1, cedula, error: 'Cedula duplicada (ya existe)' });
          } else {
            results.errors.push({ row: i + 1, cedula, error: `Error: ${err.message || 'desconocido'}` });
          }
          results.skipped++;
        }
      }

      fs.unlinkSync(req.file.path);

      logAudit({
        req, actor: session.username, role: session.role,
        action: 'bulk_import',
        target_type: 'submissions',
        details: { file: req.file.originalname, inserted: results.inserted, skipped: results.skipped, errors: results.errors.length },
      });

      res.json({
        success: true,
        filename: req.file.originalname,
        ...results,
      });
    } catch (error: any) {
      console.error('Error bulk import:', error?.message || error);
      if (error?.stack) console.error('Stack:', error.stack);
      res.status(500).json({ error: 'Error al procesar el archivo.', detail: String(error?.message || error) });
    }
  });

  app.post('/api/census/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No se recibio ningun archivo.' });
        return;
      }
      const fileId = randomBytes(12).toString('hex');
      const fileType = toText((req.body as any)?.fileType) || 'OTRO';

      await runSql(
        `INSERT INTO submission_files (id, submission_id, file_type, original_name, stored_name, mime_type, size_bytes)
         VALUES (?, NULL, ?, ?, ?, ?, ?)`,
        [fileId, fileType, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size]
      );

      res.status(201).json({
        id: fileId,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        url: `/uploads/${req.file.filename}`,
        fileType,
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      if (error.message?.includes('Tipo de archivo')) {
        res.status(400).json({ error: error.message });
      } else if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'El archivo excede 10MB.' });
      } else {
        res.status(500).json({ error: 'Error al subir el archivo.' });
      }
    }
  });

  app.get('/api/admin/submissions/:id/files', requireAdminAuth, async (req, res) => {
    try {
      const id = toNumber(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Id invalido' });
        return;
      }
      const files = await queryAll<any>(
        'SELECT id, file_type, original_name, mime_type, size_bytes, uploaded_at, stored_name FROM submission_files WHERE submission_id = ? ORDER BY uploaded_at ASC',
        [id]
      );
      const enriched = files.map((f) => ({
        ...f,
        url: `/uploads/${f.stored_name}`,
      }));
      res.json(enriched);
    } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.get('/api/admin/submissions/:id/comments', requireAdminAuth, async (req, res) => {
    try {
      const id = toNumber(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Id invalido' });
        return;
      }
      const rows = await queryAll<any>(
        'SELECT id, author, author_role, body, created_at FROM case_comments WHERE submission_id = ? ORDER BY created_at ASC',
        [id]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.post('/api/admin/submissions/:id/comments', requireRole('vocal'), async (req, res) => {
    try {
      const id = toNumber(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Id invalido' });
        return;
      }
      const body = toText(req.body?.body).slice(0, 2000);
      if (!body) {
        res.status(400).json({ error: 'El comentario no puede estar vacio.' });
        return;
      }

      const session = (req as any).session as { username: string; role: AdminRole };
      const submission = await queryOne<any>('SELECT nombre_apellido, assigned_to FROM census_submissions WHERE id = ?', [id]);
      if (!submission) {
        res.status(404).json({ error: 'Registro no encontrado' });
        return;
      }

      const result = await runSql(
        'INSERT INTO case_comments (submission_id, author, author_role, body) VALUES (?, ?, ?, ?)',
        [id, session.username, session.role, body]
      );

      logAudit({
        req, actor: session.username, role: session.role,
        action: 'comment_added',
        target_type: 'submission', target_id: id,
        details: { snippet: body.slice(0, 100) },
      });

      const assigneeUsername = usernameFromAssignee(submission.assigned_to);
      if (assigneeUsername && assigneeUsername !== session.username) {
        await createNotification({
          user_target: assigneeUsername,
          type: 'case_comment',
          title: `Nuevo comentario en caso #${id}`,
          body: `${session.username} (${session.role}) comento: "${body.slice(0, 80)}${body.length > 80 ? '...' : ''}"`,
          target_type: 'submission',
          target_id: id,
          actor: session.username,
        });
      }

      const created = await queryOne<any>(
        'SELECT id, author, author_role, body, created_at FROM case_comments WHERE id = ?',
        [result.lastInsertRowid]
      );
      res.status(201).json(created);
    } catch (error) {
      console.error('Error posting comment:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.post('/api/census', rateLimitMiddleware('census-submit', 20, 60 * 60 * 1000), async (req, res) => {
    try {
      const data = normalizeInput(req.body);
      const validationError = validateCensusInput(data);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const evaluation = evaluateApplicant(data);

      const result = await runSql(
        `
        INSERT INTO census_submissions (
          nombre_apellido, cedula, telefono, correo, region_sede, vicepresidencia,
          direccion_ejecutiva, gerencia, unidad_operativa,
          anos_servicio, cargo, ingreso_individual, ingreso_familiar, afiliado_cacref,
          capacidad_cuota, posee_vehiculo, vehiculo_ano, vehiculo_modelo, vehiculo_marca,
          vehiculo_estado, vehiculo_aspirado, requiere_medicamento_cronico, medicamento_detalle, requiere_cirugia, cirugia_detalle,
          familiar_requiere_asistencia, calidad_vida_escala, score,
          score_seniority, score_payment_capacity, score_affordability, score_health_need,
          score_cooperative_bonus, affordability_ratio, suggested_max_quota, risk_level,
          recommendation, priority_bucket
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          data.nombre_apellido,
          data.cedula,
          data.telefono,
          data.correo,
          data.region_sede || data.unidad_operativa || 'No especificada',
          data.vicepresidencia,
          data.direccion_ejecutiva,
          data.gerencia,
          data.unidad_operativa,
          data.anos_servicio,
          data.cargo,
          data.ingreso_individual,
          data.ingreso_familiar,
          data.afiliado_cacref ? 1 : 0,
          data.capacidad_cuota,
          0,
          null,
          null,
          null,
          null,
          'NO APLICA - CENSO SALUD',
          data.requiere_medicamento_cronico ? 1 : 0,
          data.medicamento_detalle,
          data.requiere_cirugia ? 1 : 0,
          data.cirugia_detalle,
          data.familiar_requiere_asistencia ? 1 : 0,
          data.calidad_vida_escala,
          evaluation.score,
          evaluation.score_seniority,
          evaluation.score_payment_capacity,
          evaluation.score_affordability,
          evaluation.score_health_need,
          evaluation.score_cooperative_bonus,
          evaluation.affordability_ratio,
          evaluation.suggested_max_quota,
          evaluation.risk_level,
          evaluation.recommendation,
          evaluation.priority_bucket,
        ]
      );

      const newId = result.lastInsertRowid;
      const attachments = Array.isArray((req.body as any)?.attachments) ? (req.body as any).attachments : [];
      for (const att of attachments) {
        const uploadId = toText((att as any)?.uploadId);
        if (!uploadId) continue;
        await runSql(
          'UPDATE submission_files SET submission_id = ?, file_type = ? WHERE id = ?',
          [newId, toText((att as any)?.fileType) || 'OTRO', uploadId]
        );
      }

      res.status(201).json({
        success: true,
        id: newId,
        score: evaluation.score,
        recommendation: evaluation.recommendation,
        risk_level: evaluation.risk_level,
        files_attached: attachments.length,
      });
    } catch (error: any) {
      if (String(error?.message || '').toLowerCase().includes('unique')) {
        res.status(400).json({ error: 'Ya existe un censo registrado con esta cedula.' });
      } else {
        console.error('Error saving census:', error?.message || error);
        if (error?.stack) console.error('Stack:', error.stack);
        res.status(500).json({ error: 'Error interno del servidor.', detail: String(error?.message || error) });
      }
    }
  });

  app.get('/api/admin/submissions', requireAdminAuth, async (req, res) => {
    try {
      const { gerencia, minIngreso, maxIngreso, recommendation, riskLevel, search, assignedTo, page, limit } = req.query;

      let query = 'SELECT * FROM census_submissions WHERE 1=1';
      const params: Array<string | number | null> = [];

      if (gerencia && String(gerencia).trim()) {
        query += ' AND gerencia LIKE ?';
        params.push(`%${String(gerencia).trim()}%`);
      }
      if (minIngreso) {
        query += ' AND ingreso_individual >= ?';
        params.push(toNumber(minIngreso));
      }
      if (maxIngreso) {
        query += ' AND ingreso_individual <= ?';
        params.push(toNumber(maxIngreso));
      }
      if (recommendation) {
        query += ' AND recommendation = ?';
        params.push(String(recommendation));
      }
      if (riskLevel) {
        query += ' AND risk_level = ?';
        params.push(String(riskLevel));
      }
      if (assignedTo && String(assignedTo).trim()) {
        query += ' AND assigned_to = ?';
        params.push(String(assignedTo).trim());
      }
      if (search && String(search).trim()) {
        const term = `%${String(search).trim()}%`;
        query += ' AND (nombre_apellido LIKE ? OR cedula LIKE ? OR gerencia LIKE ?)';
        params.push(term, term, term);
      }

      query += ' ORDER BY COALESCE(priority_bucket, 99) ASC, score DESC, created_at DESC';

      const pageNum = Math.max(1, toNumber(page, 1));
      const limitNum = Math.min(100, Math.max(1, toNumber(limit, 50)));
      const offset = (pageNum - 1) * limitNum;

      const countQuery = query.replace(/^SELECT \*/, 'SELECT COUNT(*) as total');
      const countResult = await queryOne<{ total: number }>(countQuery, params);
      const total = Number(countResult?.total || 0);

      query += ' LIMIT ? OFFSET ?';
      params.push(limitNum, offset);
      const rows = await queryAll(query, params);

      const now = Date.now();
      const enriched = (rows as any[]).map((r) => {
        const updated = r.workflow_updated_at ? new Date(String(r.workflow_updated_at)).getTime() : new Date(String(r.created_at)).getTime();
        const days = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
        let sla: 'ON_TRACK' | 'WARNING' | 'OVERDUE' = 'ON_TRACK';
        if (r.workflow_status === 'COMITE' && days > 7) sla = 'OVERDUE';
        else if (r.workflow_status === 'COMITE' && days > 3) sla = 'WARNING';
        else if (['EN_REVISION', 'REGISTRADO'].includes(r.workflow_status) && days > 5) sla = 'WARNING';
        return { ...r, days_in_state: days, sla };
      });

      res.json({
        data: enriched,
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      console.error('Error fetching submissions:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.get('/api/census/status/:cedula', async (req, res) => {
    try {
      const cedula = toText(req.params.cedula);
      if (!cedula || !/^\d{5,12}$/.test(cedula)) {
        res.status(400).json({ found: false, error: 'Cedula invalida' });
        return;
      }

      const row = await queryOne<any>(
        `SELECT nombre_apellido, cedula, gerencia, workflow_status, assigned_to,
                decision_tipo, decision_monto, decision_observaciones, decision_at,
                workflow_updated_at, created_at
         FROM census_submissions WHERE cedula = ? LIMIT 1`,
        [cedula]
      );

      if (!row) {
        res.json({ found: false });
        return;
      }

      const updatedAt = row.workflow_updated_at ? new Date(String(row.workflow_updated_at)) : new Date(String(row.created_at));
      const now = new Date();
      const days = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      let sla: 'ON_TRACK' | 'WARNING' | 'OVERDUE' = 'ON_TRACK';
      if (row.workflow_status === 'COMITE' && days > 7) sla = 'OVERDUE';
      else if (row.workflow_status === 'COMITE' && days > 3) sla = 'WARNING';
      else if (['EN_REVISION', 'REGISTRADO'].includes(row.workflow_status) && days > 5) sla = 'WARNING';

      const statusLabels: Record<string, string> = {
        REGISTRADO: 'Recibido',
        EN_REVISION: 'En revision',
        COMITE: 'En comite',
        RESUELTO: 'Resuelto',
        DESCARTADO: 'Descartado',
      };

      const decision = row.decision_tipo
        ? {
            tipo: row.decision_tipo,
            monto_aprobado: Number(row.decision_monto || 0),
            observaciones: row.decision_observaciones,
          }
        : null;

      res.json({
        found: true,
        nombre_apellido: row.nombre_apellido,
        cedula: row.cedula,
        gerencia: row.gerencia,
        status: row.workflow_status || 'REGISTRADO',
        status_label: statusLabels[row.workflow_status] || row.workflow_status,
        assigned_to: row.assigned_to || null,
        days_in_state: days,
        sla,
        decision,
        submitted_at: row.created_at,
      });
    } catch (error) {
      console.error('Error fetching census status:', error);
      res.status(500).json({ found: false, error: 'Error interno del servidor.' });
    }
  });

  app.post('/api/admin/submissions/:id/attach', requireAdminAuth, async (req, res) => {
    try {
      const id = toNumber(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Id invalido' });
        return;
      }
      await runSql('UPDATE census_submissions SET has_document = 1 WHERE id = ?', [id]);
      res.json({ success: true, has_document: true });
    } catch (error) {
      console.error('Error attaching document:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.post('/api/admin/submissions/:id/detach', requireAdminAuth, async (req, res) => {
    try {
      const id = toNumber(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Id invalido' });
        return;
      }
      await runSql('UPDATE census_submissions SET has_document = 0 WHERE id = ?', [id]);
      res.json({ success: true, has_document: false });
    } catch (error) {
      console.error('Error detaching document:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.get('/api/admin/insights', requireAdminAuth, async (_req, res) => {
    try {
      const summary = await queryOne(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN recommendation = 'APROBADO_PRIORIDAD_ALTA' THEN 1 ELSE 0 END) as prioridad_alta,
          SUM(CASE WHEN recommendation = 'APROBADO_CONDICIONAL' THEN 1 ELSE 0 END) as condicional,
          SUM(CASE WHEN recommendation = 'REQUIERE_COMITE' THEN 1 ELSE 0 END) as comite,
          SUM(CASE WHEN recommendation = 'NO_ELEGIBLE' THEN 1 ELSE 0 END) as no_elegible,
          ROUND(AVG(score), 2) as score_promedio,
          ROUND(AVG(capacidad_cuota), 2) as cuota_promedio,
          ROUND(AVG(affordability_ratio), 2) as ratio_cuota_ingreso_promedio
        FROM census_submissions
      `);
      res.json(summary || {});
    } catch (error) {
      console.error('Error fetching insights:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.patch('/api/admin/submissions/:id/status', requireRole('vocal'), async (req, res) => {
    try {
      const id = toNumber(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Id invalido' });
        return;
      }
      const { status, note, decision, assigned_to, send_email } = req.body || {};
      const validStatuses = ['REGISTRADO', 'EN_REVISION', 'COMITE', 'RESUELTO', 'DESCARTADO'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Estado invalido' });
        return;
      }
      const noteText = toText(note).slice(0, 500) || null;

      const current = await queryOne<any>('SELECT workflow_status, correo, nombre_apellido FROM census_submissions WHERE id = ?', [id]);
      if (!current) {
        res.status(404).json({ error: 'Registro no encontrado' });
        return;
      }

      const now = new Date().toISOString();

      let decisionFields = '';
      const updateArgs: any[] = [status, noteText, now];

      if (assigned_to !== undefined) {
        const assignee = toText(assigned_to).slice(0, 120) || null;
        decisionFields += ', assigned_to = ?';
        updateArgs.push(assignee);
      }

      if (status === 'RESUELTO' && decision) {
        const tiposValidos = ['MEDICAMENTO', 'CIRUGIA', 'APOYO_FAMILIAR', 'OTRO'];
        const tipo = tiposValidos.includes(decision.tipo) ? decision.tipo : 'OTRO';
        const monto = Math.max(0, toNumber(decision.monto_aprobado));
        const obs = toText(decision.observaciones).slice(0, 1000) || null;
        decisionFields += ', decision_tipo = ?, decision_monto = ?, decision_observaciones = ?, decision_at = ?';
        updateArgs.push(tipo, monto, obs, now);
      }

      updateArgs.push(id);
      await runSql(
        `UPDATE census_submissions SET workflow_status = ?, workflow_notes = ?, workflow_updated_at = ?${decisionFields} WHERE id = ?`,
        updateArgs
      );
      await runSql(
        'INSERT INTO workflow_history (submission_id, from_status, to_status, note, changed_at) VALUES (?, ?, ?, ?, ?)',
        [id, current.workflow_status, status, noteText, now]
      );

      let emailResult: { sent: boolean; mocked: boolean; reason?: string } = { sent: false, mocked: false };
      if (send_email && current.correo) {
        emailResult = await sendStatusEmail({
          to: current.correo,
          nombre: current.nombre_apellido,
          status: status,
          note: noteText,
          decision: status === 'RESUELTO' && decision ? {
            tipo: decision.tipo,
            monto_aprobado: toNumber(decision.monto_aprobado),
            observaciones: toText(decision.observaciones),
          } : null,
        });
      }

      res.json({ success: true, status, changed_at: now, email: emailResult });

      const session = (req as any).session as { username: string; role: AdminRole } | undefined;
      if (session) {
        logAudit({
          req, actor: session.username, role: session.role,
          action: 'status_change',
          target_type: 'submission', target_id: id,
          details: { from: current.workflow_status, to: status, assigned_to, decision: status === 'RESUELTO' ? decision : null, sent_email: emailResult.sent },
        });

        const assigneeUsername = usernameFromAssignee(assigned_to || null);
        if (assigneeUsername && assigneeUsername !== session.username) {
          const targetUser = ADMIN_USERS[assigneeUsername];
          const statusLabels: Record<string, string> = {
            REGISTRADO: 'Recibido',
            EN_REVISION: 'En revision',
            COMITE: 'En comite',
            RESUELTO: 'Resuelto',
            DESCARTADO: 'Descartado',
          };
          await createNotification({
            user_target: assigneeUsername,
            type: 'case_assigned',
            title: `Caso #${id} asignado a ti`,
            body: `${session.username} (${session.role}) te asigno el caso de ${current.nombre_apellido} y lo movio a ${statusLabels[status] || status}.`,
            target_type: 'submission',
            target_id: id,
            actor: session.username,
          });
        }

        if (status === 'RESUELTO') {
          const vocales = Object.entries(ADMIN_USERS).filter(([u, info]) => info.role === 'vocal' || info.role === 'presidente');
          for (const [u] of vocales) {
            if (u !== session.username) {
              await createNotification({
                user_target: u,
                type: 'case_resolved',
                title: `Caso #${id} resuelto`,
                body: `${current.nombre_apellido} - decision final registrada.`,
                target_type: 'submission',
                target_id: id,
                actor: session.username,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.get('/api/admin/submissions/:id/history', requireAdminAuth, async (req, res) => {
    try {
      const id = toNumber(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Id invalido' });
        return;
      }
      const rows = await queryAll<any>(
        'SELECT id, from_status, to_status, note, changed_at FROM workflow_history WHERE submission_id = ? ORDER BY changed_at ASC',
        [id]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error fetching history:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.get('/api/admin/notifications', requireAdminAuth, async (req, res) => {
    try {
      const session = getSession(req);
      if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
      const unreadOnly = req.query.unread === 'true';
      const limit = Math.min(50, Math.max(1, toNumber(req.query.limit, 20)));

      const where = unreadOnly ? 'WHERE user_target = ? AND read_at IS NULL' : 'WHERE user_target = ?';
      const rows = await queryAll<any>(
        `SELECT id, type, title, body, target_type, target_id, actor, read_at, created_at
         FROM notifications ${where}
         ORDER BY created_at DESC LIMIT ?`,
        [session.username, limit]
      );
      const unread = await queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM notifications WHERE user_target = ? AND read_at IS NULL',
        [session.username]
      );
      res.json({
        data: rows,
        unread: Number(unread?.count || 0),
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.patch('/api/admin/notifications/:id/read', requireAdminAuth, async (req, res) => {
    try {
      const session = getSession(req);
      if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
      const id = toNumber(req.params.id);
      if (!id) { res.status(400).json({ error: 'Id invalido' }); return; }
      const now = new Date().toISOString();
      await runSql(
        'UPDATE notifications SET read_at = ? WHERE id = ? AND user_target = ?',
        [now, id, session.username]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification read:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.patch('/api/admin/notifications/read-all', requireAdminAuth, async (req, res) => {
    try {
      const session = getSession(req);
      if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
      const now = new Date().toISOString();
      await runSql(
        'UPDATE notifications SET read_at = ? WHERE user_target = ? AND read_at IS NULL',
        [now, session.username]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all read:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.get('/api/admin/audit', requireRole('director'), async (req, res) => {
    try {
      const { actor, action, page: pageQ, limit: limitQ } = req.query;
      const pageNum = Math.max(1, toNumber(pageQ, 1));
      const limitNum = Math.min(200, Math.max(1, toNumber(limitQ, 50)));
      const offset = (pageNum - 1) * limitNum;

      let where = '1=1';
      const args: any[] = [];
      if (actor && toText(actor)) {
        where += ' AND actor = ?';
        args.push(toText(actor));
      }
      if (action && toText(action)) {
        where += ' AND action = ?';
        args.push(toText(action));
      }

      const countResult = await queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM audit_log WHERE ${where}`, args);
      const total = Number(countResult?.total || 0);

      const rows = await queryAll<any>(
        `SELECT id, actor, actor_role, action, target_type, target_id, details, ip, user_agent, created_at
         FROM audit_log WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limitNum, offset]
      );
      res.json({
        data: rows,
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      console.error('Error fetching audit log:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.post('/api/census/export/:cedula', rateLimitMiddleware('export', 5, 60 * 60 * 1000), async (req, res) => {
    try {
      const cedula = toText(req.params.cedula);
      if (!cedula || !/^\d{5,12}$/.test(cedula)) {
        res.status(400).json({ error: 'Cedula invalida' });
        return;
      }
      const row = await queryOne<any>(
        `SELECT * FROM census_submissions WHERE cedula = ? LIMIT 1`,
        [cedula]
      );
      if (!row) {
        res.status(404).json({ found: false, error: 'Cedula no encontrada' });
        return;
      }
      const files = await queryAll<any>(
        'SELECT file_type, original_name, mime_type, size_bytes, uploaded_at FROM submission_files WHERE submission_id = ?',
        [row.id]
      );
      const history = await queryAll<any>(
        'SELECT from_status, to_status, note, changed_at FROM workflow_history WHERE submission_id = ? ORDER BY changed_at ASC',
        [row.id]
      );
      res.json({
        exportado_en: new Date().toISOString(),
        sujeto: {
          nombre_apellido: row.nombre_apellido,
          cedula: row.cedula,
          correo: row.correo,
          telefono: row.telefono,
        },
        vinculacion: {
          gerencia: row.gerencia,
          unidad_operativa: row.unidad_operativa,
          cargo: row.cargo,
          anos_servicio: row.anos_servicio,
          vicepresidencia: row.vicepresidencia,
          direccion_ejecutiva: row.direccion_ejecutiva,
        },
        socioeconomico: {
          ingreso_individual: row.ingreso_individual,
          ingreso_familiar: row.ingreso_familiar,
          capacidad_cuota: row.capacidad_cuota,
          afiliado_cacref: Boolean(row.afiliado_cacref),
        },
        salud: {
          requiere_medicamento_cronico: Boolean(row.requiere_medicamento_cronico),
          medicamento_detalle: row.medicamento_detalle,
          requiere_cirugia: Boolean(row.requiere_cirugia),
          cirugia_detalle: row.cirugia_detalle,
          familiar_requiere_asistencia: Boolean(row.familiar_requiere_asistencia),
          calidad_vida_escala: row.calidad_vida_escala,
        },
        evaluacion: {
          score: row.score,
          recommendation: row.recommendation,
          risk_level: row.risk_level,
          priority_bucket: row.priority_bucket,
          affordability_ratio: row.affordability_ratio,
          suggested_max_quota: row.suggested_max_quota,
        },
        workflow: {
          estado_actual: row.workflow_status,
          asignado_a: row.assigned_to,
          decision_tipo: row.decision_tipo,
          decision_monto: row.decision_monto,
          decision_observaciones: row.decision_observaciones,
          decision_at: row.decision_at,
        },
        archivos: files,
        historial_workflow: history,
        creado_en: row.created_at,
      });
    } catch (error) {
      console.error('Error export:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.post('/api/census/delete/:cedula', rateLimitMiddleware('delete', 3, 60 * 60 * 1000, 60 * 60 * 1000), async (req, res) => {
    try {
      const cedula = toText(req.params.cedula);
      const confirmToken = toText(req.body?.confirm);
      if (!cedula || !/^\d{5,12}$/.test(cedula)) {
        res.status(400).json({ error: 'Cedula invalida' });
        return;
      }
      if (confirmToken !== 'ELIMINAR') {
        res.status(400).json({ error: 'Debe confirmar con el token "ELIMINAR" en el body.' });
        return;
      }

      const row = await queryOne<any>('SELECT id, cedula, nombre_apellido FROM census_submissions WHERE cedula = ?', [cedula]);
      if (!row) {
        res.status(404).json({ error: 'Cedula no encontrada' });
        return;
      }

      const now = new Date().toISOString();

      if (localDb) {
        localDb.prepare(`
          UPDATE census_submissions SET
            nombre_apellido = 'ELIMINADO',
            telefono = 'ELIMINADO',
            correo = 'ELIMINADO',
            region_sede = 'ELIMINADO',
            vicepresidencia = NULL,
            direccion_ejecutiva = NULL,
            gerencia = 'ELIMINADO',
            unidad_operativa = NULL,
            cargo = 'ELIMINADO',
            anos_servicio = 0,
            ingreso_individual = 0,
            ingreso_familiar = 0,
            capacidad_cuota = 0,
            medicamento_detalle = NULL,
            cirugia_detalle = NULL,
            workflow_notes = NULL,
            decision_observaciones = NULL,
            assigned_to = NULL,
            workflow_status = 'DESCARTADO',
            score = 0,
            risk_level = NULL,
            recommendation = 'NO_ELEGIBLE',
            priority_bucket = 4
          WHERE id = ?
        `).run(row.id);
      }

      res.json({
        success: true,
        message: 'Sus datos personales han sido anonimizados conforme a la LOPDP.',
        id: row.id,
        derecho_ejercitado: 'Cancelacion (Art. 25 LOPDP)',
        fecha_eliminacion: now,
      });
    } catch (error) {
      console.error('Error delete:', error?.message || error);
      res.status(500).json({ error: 'Error interno del servidor.', detail: String(error?.message || error) });
    }
  });

  app.get('/api/transparencia', async (_req, res) => {
    try {
      const totalRow = await queryOne<{ total: number; first_at: string; last_at: string }>(
        `SELECT COUNT(*) as total, MIN(created_at) as first_at, MAX(created_at) as last_at FROM census_submissions`
      );
      const porEstado = await queryAll<{ workflow_status: string; count: number }>(
        `SELECT COALESCE(workflow_status, 'REGISTRADO') as workflow_status, COUNT(*) as count FROM census_submissions GROUP BY workflow_status`
      );
      const porGerencia = await queryAll<{ gerencia: string; total: number; resueltos: number }>(
        `SELECT gerencia,
          COUNT(*) as total,
          SUM(CASE WHEN workflow_status = 'RESUELTO' THEN 1 ELSE 0 END) as resueltos
         FROM census_submissions GROUP BY gerencia ORDER BY total DESC LIMIT 10`
      );
      const tiempos = await queryAll<{ workflow_status: string; avg_days: number }>(
        `SELECT workflow_status,
          ROUND(AVG((julianday(COALESCE(workflow_updated_at, created_at)) - julianday(created_at))), 1) as avg_days
         FROM census_submissions
         WHERE created_at IS NOT NULL
         GROUP BY workflow_status`
      );
      const medicamentos = await queryOne<{ total: number }>(
        `SELECT SUM(CASE WHEN requiere_medicamento_cronico = 1 THEN 1 ELSE 0 END) as total FROM census_submissions`
      );
      const cirugias = await queryOne<{ total: number }>(
        `SELECT SUM(CASE WHEN requiere_cirugia = 1 THEN 1 ELSE 0 END) as total FROM census_submissions`
      );
      const familiar = await queryOne<{ total: number }>(
        `SELECT SUM(CASE WHEN familiar_requiere_asistencia = 1 THEN 1 ELSE 0 END) as total FROM census_submissions`
      );

      const total = Number(totalRow?.total || 0);
      const estadosObj: Record<string, number> = { REGISTRADO: 0, EN_REVISION: 0, COMITE: 0, RESUELTO: 0, DESCARTADO: 0 };
      for (const r of porEstado) estadosObj[r.workflow_status] = Number(r.count);

      const resueltos = estadosObj.RESUELTO || 0;
      const enProceso = total - resueltos - estadosObj.DESCARTADO;
      const tasaResolucion = total > 0 ? Math.round((resueltos / total) * 1000) / 10 : 0;

      const tiemposMap: Record<string, number> = {};
      for (const t of tiempos) tiemposMap[t.workflow_status] = Number(t.avg_days || 0);

      res.json({
        total,
        generados: totalRow?.first_at || null,
        actualizados: totalRow?.last_at || null,
        resueltos,
        en_proceso: Math.max(0, enProceso),
        tasa_resolucion: tasaResolucion,
        por_estado: estadosObj,
        por_gerencia: porGerencia,
        tiempos_promedio_dias: tiemposMap,
        necesidades: {
          medicamento_cronico: Number(medicamentos?.total || 0),
          cirugia: Number(cirugias?.total || 0),
          familiar_asistencia: Number(familiar?.total || 0),
        },
        generado_en: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error transparency:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.get('/api/admin/executive-summary', requireAdminAuth, async (_req, res) => {
    try {
      const total = await queryOne<{ total: number }>('SELECT COUNT(*) as total FROM census_submissions');
      const porEstado = await queryAll<{ workflow_status: string; count: number }>(
        "SELECT COALESCE(workflow_status, 'REGISTRADO') as workflow_status, COUNT(*) as count FROM census_submissions GROUP BY workflow_status"
      );
      const porRecomendacion = await queryAll<{ recommendation: string; count: number }>(
        "SELECT COALESCE(recommendation, 'NO_ELEGIBLE') as recommendation, COUNT(*) as count FROM census_submissions GROUP BY recommendation"
      );
      const topGerencias = await queryAll<{ gerencia: string; ALTO: number; MEDIO: number; BAJO: number }>(
        `SELECT gerencia,
          SUM(CASE WHEN risk_level = 'ALTO' THEN 1 ELSE 0 END) as ALTO,
          SUM(CASE WHEN risk_level = 'MEDIO' THEN 1 ELSE 0 END) as MEDIO,
          SUM(CASE WHEN risk_level = 'BAJO' THEN 1 ELSE 0 END) as BAJO,
          COUNT(*) as total
         FROM census_submissions
         GROUP BY gerencia
         ORDER BY total DESC
         LIMIT 8`
      );
      const agregados = await queryOne<any>(`
        SELECT
          ROUND(AVG(calidad_vida_escala), 2) as calidad_vida_promedio,
          ROUND(AVG(score), 2) as score_promedio,
          ROUND(AVG(affordability_ratio), 2) as ratio_cuota_ingreso_promedio,
          SUM(CASE WHEN requiere_medicamento_cronico = 1 THEN 1 ELSE 0 END) as total_con_medicamento,
          SUM(CASE WHEN requiere_cirugia = 1 THEN 1 ELSE 0 END) as total_con_cirugia,
          SUM(CASE WHEN familiar_requiere_asistencia = 1 THEN 1 ELSE 0 END) as total_con_familiar_asistencia
        FROM census_submissions
      `);

      const porEstadoObj: Record<string, number> = { REGISTRADO: 0, EN_REVISION: 0, COMITE: 0, RESUELTO: 0, DESCARTADO: 0 };
      for (const row of porEstado) {
        porEstadoObj[row.workflow_status] = Number(row.count);
      }
      const porRecoObj: Record<string, number> = { APROBADO_PRIORIDAD_ALTA: 0, APROBADO_CONDICIONAL: 0, REQUIERE_COMITE: 0, NO_ELEGIBLE: 0 };
      for (const row of porRecomendacion) {
        porRecoObj[row.recommendation] = Number(row.count);
      }

      res.json({
        total: Number(total?.total || 0),
        por_estado: porEstadoObj,
        por_recomendacion: porRecoObj,
        top_gerencias: topGerencias,
        calidad_vida_promedio: Number(agregados?.calidad_vida_promedio || 0),
        score_promedio: Number(agregados?.score_promedio || 0),
        ratio_cuota_ingreso_promedio: Number(agregados?.ratio_cuota_ingreso_promedio || 0),
        total_con_medicamento_cronico: Number(agregados?.total_con_medicamento || 0),
        total_con_cirugia: Number(agregados?.total_con_cirugia || 0),
        total_con_familiar_asistencia: Number(agregados?.total_con_familiar_asistencia || 0),
        fecha_generacion: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching executive summary:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.use('/uploads', express.static(UPLOAD_DIR, {
    maxAge: '1d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));

  if (process.env.NODE_ENV !== 'production' && process.env.USE_VITE_DEV === '1') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database mode: ${useTurso ? 'Turso (libsql)' : 'Local SQLite file'}`);
  });
}

startServer().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
