import { createClient, type Client } from '@libsql/client/http';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { sendCensusConfirmationEmail, sendStatusEmail } from '../../src/lib/email';

type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO';
type Recommendation = 'APROBADO_PRIORIDAD_ALTA' | 'APROBADO_CONDICIONAL' | 'REQUIERE_COMITE' | 'NO_ELEGIBLE';
const BASE_CONTRIBUTION_RATE = 0.02;

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

const rawTursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;
type AdminRole = 'capturista' | 'vocal' | 'presidente' | 'director';
interface AdminEntry { passwordHash?: string; role: AdminRole; name: string }
const ADMIN_USERS: Record<string, AdminEntry> = {
  admin: { passwordHash: process.env.ADMIN_PASS_HASH, role: 'director', name: 'Director General' },
  presidente: { passwordHash: process.env.PRES_PASS_HASH, role: 'presidente', name: 'Presidente del Comite' },
  vocal: { passwordHash: process.env.VOCAL_PASS_HASH, role: 'vocal', name: 'Vocal del Comite' },
  capturista: { passwordHash: process.env.CAPT_PASS_HASH, role: 'capturista', name: 'Capturista' },
};
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;
const ADMIN_COOKIE_NAME = 'admin_session';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 7;
const LOGIN_BLOCK_MS = 20 * 60 * 1000;
const EDGE_WINDOW_MS = 60 * 1000;
const EDGE_MAX_REQUESTS = 160;

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  capturista: 1,
  vocal: 2,
  presidente: 3,
  director: 4,
};

function hasRole(actual: AdminRole | undefined, required: AdminRole): boolean {
  return actual ? ROLE_HIERARCHY[actual] >= ROLE_HIERARCHY[required] : false;
}

function assertSecureBootEnv() {
  const missing: string[] = [];
  if (!rawTursoUrl || !tursoToken) missing.push('TURSO_DATABASE_URL + TURSO_AUTH_TOKEN');
  if (!ADMIN_SESSION_SECRET || ADMIN_SESSION_SECRET.length < 32) missing.push('ADMIN_SESSION_SECRET (>=32 chars)');
  for (const [user, info] of Object.entries(ADMIN_USERS)) {
    if (!info.passwordHash || !info.passwordHash.startsWith('$2')) {
      missing.push(`${user.toUpperCase()}_PASS_HASH (bcrypt)`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Configuracion insegura detectada. Faltan variables:\n  - ${missing.join('\n  - ')}\n` +
      `Genera hashes con: npx tsx scripts/hash-password.ts <password>\n` +
      `Genera secret con: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
    );
  }
}

assertSecureBootEnv();

if (!rawTursoUrl || !tursoToken) {
  throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in Netlify environment.');
}

async function checkPasswordForUser(pass: string, entry: AdminEntry): Promise<boolean> {
  if (!entry.passwordHash) return false;
  try {
    return await bcrypt.compare(pass, entry.passwordHash);
  } catch {
    return false;
  }
}

const tursoUrl = rawTursoUrl.replace(/^libsql:\/\//, 'https://');
const db: Client = createClient({ url: tursoUrl, authToken: tursoToken });
let initialized = false;
const loginAttempts = new Map<string, { count: number; first: number; blockedUntil?: number }>();
const edgeRate = new Map<string, { count: number; first: number }>();

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

function calculateBaseContribution(income: number) {
  return round2(Math.max(income, 0) * BASE_CONTRIBUTION_RATE);
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function signSessionPayload(payloadBase64: string) {
  return createHmac('sha256', ADMIN_SESSION_SECRET!).update(payloadBase64).digest('base64url');
}

function createSessionToken(username: string) {
  const payloadBase64 = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000 })
  ).toString('base64url');
  const signature = signSessionPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

function verifySessionToken(token?: string | null): { username: string } | null {
  if (!token || !token.includes('.')) return null;
  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) return null;

  const expectedSignature = signSessionPayload(payloadBase64);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as { u?: string; exp?: number };
    if (!payload?.u || !payload?.exp) return null;
    if (!ADMIN_USERS[payload.u]) return null;
    if (Date.now() > payload.exp) return null;
    return { username: payload.u };
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

function getClientIp(event: any) {
  const xff = String(event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For'] || '');
  const nf = String(event.headers?.['x-nf-client-connection-ip'] || event.headers?.['X-Nf-Client-Connection-Ip'] || '');
  const ip = (xff.split(',')[0] || nf || 'unknown').trim();
  return ip || 'unknown';
}

function checkEdgeRateLimit(ip: string, now: number) {
  const bucket = edgeRate.get(ip);
  if (!bucket || now - bucket.first > EDGE_WINDOW_MS) {
    edgeRate.set(ip, { count: 1, first: now });
    return false;
  }
  bucket.count += 1;
  edgeRate.set(ip, bucket);
  return bucket.count > EDGE_MAX_REQUESTS;
}

function checkLoginLimit(ip: string, now: number) {
  const entry = loginAttempts.get(ip);
  if (!entry) return { limited: false, retryAfter: 0 };
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { limited: true, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  if (now - entry.first > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { limited: false, retryAfter: 0 };
  }
  return { limited: false, retryAfter: 0 };
}

function registerLoginFailure(ip: string, now: number) {
  const current = loginAttempts.get(ip);
  if (!current || now - current.first > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, first: now });
    return;
  }
  current.count += 1;
  if (current.count >= LOGIN_MAX_ATTEMPTS) {
    current.blockedUntil = now + LOGIN_BLOCK_MS;
  }
  loginAttempts.set(ip, current);
}

function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

function cleanupRateMaps(now: number) {
  for (const [ip, entry] of edgeRate.entries()) {
    if (now - entry.first > EDGE_WINDOW_MS) edgeRate.delete(ip);
  }
  for (const [ip, entry] of loginAttempts.entries()) {
    const expiredWindow = now - entry.first > LOGIN_WINDOW_MS;
    const expiredBlock = !entry.blockedUntil || now >= entry.blockedUntil;
    if (expiredWindow && expiredBlock) loginAttempts.delete(ip);
  }
}

function normalizeInput(payload: any): CensusInput {
  const calidadVida = clamp(toNumber(payload.calidad_vida_escala, 5), 1, 10);
  const ingresoIndividual = Math.max(toNumber(payload.ingreso_individual), 0);

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
    anos_servicio: Math.max(toNumber(payload.anos_servicio), 0),
    cargo: toText(payload.cargo),
    ingreso_individual: ingresoIndividual,
    ingreso_familiar: Math.max(toNumber(payload.ingreso_familiar), 0),
    afiliado_cacref: Boolean(payload.afiliado_cacref),
    capacidad_cuota: calculateBaseContribution(ingresoIndividual),
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

  if (missing.length > 0) return `Complete los campos obligatorios: ${missing.join(', ')}.`;
  if (!data.correo.includes('@')) return 'Ingrese un correo electronico valido.';
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
  const paymentCapacityScore = income > 0 ? clamp((income / 1000) * 28, 0, 28) : 0;
  const affordabilityScore = income > 0 && monthlyQuota > 0 ? 24 : 0;

  let healthNeedScore = 0;
  if (data.requiere_cirugia) healthNeedScore += 25;
  if (data.requiere_medicamento_cronico) healthNeedScore += 15;
  if (data.familiar_requiere_asistencia) healthNeedScore += 10;
  healthNeedScore += (10 - data.calidad_vida_escala) * 1.5;
  healthNeedScore = clamp(healthNeedScore, 0, 45);

  const cooperativeBonus = data.afiliado_cacref ? 6 : 0;
  const householdSupportScore = clamp((householdSupportRatio - 1) * 4, 0, 4);
  const score = clamp(
    seniorityScore + paymentCapacityScore + affordabilityScore + healthNeedScore + cooperativeBonus + householdSupportScore,
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

async function ensureColumn(columnName: string, definition: string, existingColumns: Set<string>) {
  if (existingColumns.has(columnName)) return;
  await db.execute(`ALTER TABLE census_submissions ADD COLUMN ${columnName} ${definition}`);
  existingColumns.add(columnName);
}

async function initSchema() {
  if (initialized) return;

  await db.execute(`
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
      requiere_medicamento_cronico BOOLEAN NOT NULL DEFAULT 0,
      medicamento_detalle TEXT,
      requiere_cirugia BOOLEAN NOT NULL DEFAULT 0,
      cirugia_detalle TEXT,
      familiar_requiere_asistencia BOOLEAN NOT NULL DEFAULT 0,
      calidad_vida_escala INTEGER NOT NULL DEFAULT 5,
      score REAL NOT NULL,
      score_seniority REAL,
      score_payment_capacity REAL,
      score_affordability REAL,
      score_vehicle_need REAL,
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

  const columnInfo = await db.execute('PRAGMA table_info(census_submissions)');
  const existingColumns = new Set(columnInfo.rows.map((column: any) => String(column.name)));

  await ensureColumn('vicepresidencia', 'TEXT', existingColumns);
  await ensureColumn('direccion_ejecutiva', 'TEXT', existingColumns);
  await ensureColumn('unidad_operativa', 'TEXT', existingColumns);
  await ensureColumn('posee_vehiculo', 'BOOLEAN NOT NULL DEFAULT 0', existingColumns);
  await ensureColumn('vehiculo_ano', 'INTEGER', existingColumns);
  await ensureColumn('vehiculo_modelo', 'TEXT', existingColumns);
  await ensureColumn('vehiculo_marca', 'TEXT', existingColumns);
  await ensureColumn('vehiculo_estado', 'TEXT', existingColumns);
  await ensureColumn('vehiculo_aspirado', "TEXT NOT NULL DEFAULT 'NO APLICA - CENSO SALUD'", existingColumns);
  await ensureColumn('requiere_medicamento_cronico', 'BOOLEAN NOT NULL DEFAULT 0', existingColumns);
  await ensureColumn('medicamento_detalle', 'TEXT', existingColumns);
  await ensureColumn('requiere_cirugia', 'BOOLEAN NOT NULL DEFAULT 0', existingColumns);
  await ensureColumn('cirugia_detalle', 'TEXT', existingColumns);
  await ensureColumn('familiar_requiere_asistencia', 'BOOLEAN NOT NULL DEFAULT 0', existingColumns);
  await ensureColumn('calidad_vida_escala', 'INTEGER NOT NULL DEFAULT 5', existingColumns);
  await ensureColumn('score_seniority', 'REAL', existingColumns);
  await ensureColumn('score_payment_capacity', 'REAL', existingColumns);
  await ensureColumn('score_affordability', 'REAL', existingColumns);
  await ensureColumn('score_vehicle_need', 'REAL', existingColumns);
  await ensureColumn('score_health_need', 'REAL', existingColumns);
  await ensureColumn('score_cooperative_bonus', 'REAL', existingColumns);
  await ensureColumn('affordability_ratio', 'REAL', existingColumns);
  await ensureColumn('suggested_max_quota', 'REAL', existingColumns);
  await ensureColumn('risk_level', 'TEXT', existingColumns);
  await ensureColumn('recommendation', 'TEXT', existingColumns);
  await ensureColumn('priority_bucket', 'INTEGER', existingColumns);
  await ensureColumn('workflow_status', "TEXT NOT NULL DEFAULT 'REGISTRADO'", existingColumns);
  await ensureColumn('workflow_notes', 'TEXT', existingColumns);
  await ensureColumn('workflow_updated_at', 'DATETIME', existingColumns);
  await ensureColumn('assigned_to', 'TEXT', existingColumns);
  await ensureColumn('decision_tipo', 'TEXT', existingColumns);
  await ensureColumn('decision_monto', 'REAL', existingColumns);
  await ensureColumn('decision_observaciones', 'TEXT', existingColumns);
  await ensureColumn('decision_at', 'DATETIME', existingColumns);
  await ensureColumn('has_document', 'BOOLEAN NOT NULL DEFAULT 0', existingColumns);
  await ensureColumn('created_by_ip', 'TEXT', existingColumns);

  await db.execute(`
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

  await db.execute(`
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS submission_files (
      id TEXT PRIMARY KEY,
      submission_id INTEGER,
      file_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      data BLOB,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
    )
  `);

  // Idempotent: add data column to existing tables
  try {
    const cols = await db.execute('PRAGMA table_info(submission_files)');
    const hasData = (cols.rows as any[]).some((c) => c.name === 'data');
    if (!hasData) {
      await db.execute('ALTER TABLE submission_files ADD COLUMN data BLOB');
    }
  } catch {
    // ignore
  }

  await db.execute(`
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
  await db.execute('CREATE INDEX IF NOT EXISTS idx_comments_submission ON case_comments(submission_id, created_at)');

  await db.execute(`
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
  await db.execute('CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)');

  await db.execute('CREATE INDEX IF NOT EXISTS idx_census_priority ON census_submissions(priority_bucket, score)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_census_risk_reco ON census_submissions(risk_level, recommendation)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_census_created_at ON census_submissions(created_at)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_history_submission ON workflow_history(submission_id, changed_at)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_census_workflow_status ON census_submissions(workflow_status)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_target, created_at)');

  initialized = true;
}

function json(statusCode: number, payload: unknown, headers?: Record<string, string>) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      ...(headers || {})
    },
    body: JSON.stringify(payload),
  };
}

async function audit(event: any, actor: string, role: AdminRole, action: string, target_type?: string, target_id?: string | number, details?: any) {
  try {
    const ip = getClientIp(event);
    const ua = String(event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '').slice(0, 250) || null;
    await db.execute({
      sql: `INSERT INTO audit_log (actor, actor_role, action, target_type, target_id, details, ip, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        actor,
        role,
        action,
        target_type || null,
        target_id != null ? String(target_id) : null,
        details ? JSON.stringify(details).slice(0, 2000) : null,
        ip,
        ua,
      ],
    });
  } catch (err) {
    console.error('audit_log insert failed:', err);
  }
}

export const handler = async (event: any) => {
  try {
    await initSchema();
    const now = Date.now();
    cleanupRateMaps(now);
    const clientIp = getClientIp(event);

    if (checkEdgeRateLimit(clientIp, now)) {
      return json(429, { error: 'Demasiadas solicitudes. Intente de nuevo en un minuto.' }, { 'Retry-After': '60' });
    }

    const url = new URL(
      event.rawUrl || `https://${event.headers?.host || 'localhost'}${event.path || '/'}`
    );
    let pathname = url.pathname;
    pathname = pathname.replace(/^\/\.netlify\/functions\/api/, '');
    pathname = pathname.replace(/^\/api/, '');
    if (!pathname) pathname = '/';
    const isProd = process.env.CONTEXT === 'production';
    const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie);
    const session = verifySessionToken(cookies[ADMIN_COOKIE_NAME]);
    const isAdmin = session !== null;
    const currentUser = session ? ADMIN_USERS[session.username] : null;

    const requireRole = (required: AdminRole) => {
      if (!isAdmin || !session || !currentUser) {
        return { ok: false as const, status: 401, body: { error: 'No autorizado', required } };
      }
      if (!hasRole(currentUser.role, required)) {
        return { ok: false as const, status: 403, body: { error: 'Permisos insuficientes', required, actual: currentUser.role } };
      }
      return { ok: true as const };
    };

    if (event.body && String(event.body).length > 6 * 1024 * 1024) {
      return json(413, { error: 'Payload demasiado grande' });
    }

    if (event.httpMethod === 'POST' && pathname === '/admin/login') {
      const limit = checkLoginLimit(clientIp, now);
      if (limit.limited) {
        return json(429, { error: 'Acceso temporalmente bloqueado por intentos fallidos.' }, { 'Retry-After': String(limit.retryAfter) });
      }
      const payload = event.body ? JSON.parse(event.body) : {};
      const user = toText(payload.user);
      const pass = toText(payload.pass);
      const entry = ADMIN_USERS[user];
      if (!entry || !(await checkPasswordForUser(pass, entry))) {
        registerLoginFailure(clientIp, now);
        await audit(event, user || 'unknown', 'capturista', 'login_failed', 'admin', user, { reason: 'invalid_credentials' });
        return json(401, { error: 'Credenciales incorrectas' });
      }
      clearLoginFailures(clientIp);
      const token = createSessionToken(user);
      const cookie = `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ADMIN_SESSION_TTL_SECONDS}${isProd ? '; Secure' : ''}`;
      await audit(event, user, entry.role, 'login_success', 'admin', user);
      return json(200, { success: true, user: { username: user, role: entry.role, name: entry.name } }, { 'Set-Cookie': cookie });
    }

    if (event.httpMethod === 'POST' && pathname === '/admin/logout') {
      if (session && currentUser) {
        await audit(event, session.username, currentUser.role, 'logout', 'admin', session.username);
      }
      const cookie = `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
      return json(200, { success: true }, { 'Set-Cookie': cookie });
    }

    if (event.httpMethod === 'GET' && pathname === '/admin/me') {
      if (!isAdmin || !currentUser || !session) return json(401, { error: 'No autorizado' });
      return json(200, { ok: true, user: { username: session.username, role: currentUser.role, name: currentUser.name } });
    }

    if (event.httpMethod === 'GET' && pathname === '/health') {
      return json(200, { status: 'ok', db: 'turso' });
    }

    if (event.httpMethod === 'GET' && pathname === '/transparencia') {
      try {
        const totalRow = await db.execute(`SELECT COUNT(*) as total, MIN(created_at) as first_at, MAX(created_at) as last_at FROM census_submissions`);
        const porEstado = await db.execute(`SELECT COALESCE(workflow_status, 'REGISTRADO') as workflow_status, COUNT(*) as count FROM census_submissions GROUP BY workflow_status`);
        const porGerencia = await db.execute(`SELECT gerencia, COUNT(*) as total, SUM(CASE WHEN workflow_status = 'RESUELTO' THEN 1 ELSE 0 END) as resueltos FROM census_submissions GROUP BY gerencia ORDER BY total DESC LIMIT 10`);
        const tiempos = await db.execute(`SELECT workflow_status, ROUND(AVG((julianday(COALESCE(workflow_updated_at, created_at)) - julianday(created_at))), 1) as avg_days FROM census_submissions WHERE created_at IS NOT NULL GROUP BY workflow_status`);
        const medicamentos = await db.execute(`SELECT SUM(CASE WHEN requiere_medicamento_cronico = 1 THEN 1 ELSE 0 END) as total FROM census_submissions`);
        const cirugias = await db.execute(`SELECT SUM(CASE WHEN requiere_cirugia = 1 THEN 1 ELSE 0 END) as total FROM census_submissions`);
        const familiar = await db.execute(`SELECT SUM(CASE WHEN familiar_requiere_asistencia = 1 THEN 1 ELSE 0 END) as total FROM census_submissions`);

        const total = Number((totalRow.rows[0] as any)?.total || 0);
        const estadosObj: Record<string, number> = { REGISTRADO: 0, EN_REVISION: 0, COMITE: 0, RESUELTO: 0, DESCARTADO: 0 };
        for (const r of porEstado.rows as any[]) estadosObj[r.workflow_status] = Number(r.count);

        const resueltos = estadosObj.RESUELTO || 0;
        const enProceso = total - resueltos - estadosObj.DESCARTADO;
        const tasaResolucion = total > 0 ? Math.round((resueltos / total) * 1000) / 10 : 0;

        const tiemposMap: Record<string, number> = {};
        for (const t of tiempos.rows as any[]) tiemposMap[t.workflow_status] = Number(t.avg_days || 0);

        return json(200, {
          total,
          generados: (totalRow.rows[0] as any)?.first_at || null,
          actualizados: (totalRow.rows[0] as any)?.last_at || null,
          resueltos,
          en_proceso: Math.max(0, enProceso),
          tasa_resolucion: tasaResolucion,
          por_estado: estadosObj,
          por_gerencia: porGerencia.rows,
          tiempos_promedio_dias: tiemposMap,
          necesidades: {
            medicamento_cronico: Number((medicamentos.rows[0] as any)?.total || 0),
            cirugia: Number((cirugias.rows[0] as any)?.total || 0),
            familiar_asistencia: Number((familiar.rows[0] as any)?.total || 0),
          },
          generado_en: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Transparency error:', err);
        return json(500, { error: 'Error interno del servidor.' });
      }
    }

    if (event.httpMethod === 'GET' && pathname === '/transparencia/geo') {
      try {
        const rs = await db.execute(`
          SELECT
            region_sede as estado,
            COUNT(*) as total,
            SUM(CASE WHEN recommendation = 'APROBADO_PRIORIDAD_ALTA' THEN 1 ELSE 0 END) as prioridad_alta,
            SUM(CASE WHEN recommendation = 'REQUIERE_COMITE' THEN 1 ELSE 0 END) as requiere_comite
          FROM census_submissions
          WHERE region_sede IS NOT NULL AND region_sede != ''
          GROUP BY region_sede
        `);
        // Mapeo nombre de estado del formulario -> nombre del TopoJSON
        const TOPO_NAME: Record<string, string> = {
          'Distrito Capital': 'Distrito Capital',
          'La Guaira': 'Vargas', // legacy
          'Nueva Esparta': 'Nueva Esparta',
        };
        const items = (rs.rows as any[]).map((r) => ({
          estado: r.estado,
          topo_name: TOPO_NAME[r.estado] || r.estado,
          total: Number(r.total || 0),
          prioridad_alta: Number(r.prioridad_alta || 0),
          requiere_comite: Number(r.requiere_comite || 0),
        }));
        return json(200, { estados: items });
      } catch (err) {
        console.error('Geo error:', err);
        return json(500, { error: 'Error interno del servidor.' });
      }
    }

    if (event.httpMethod === 'GET' && pathname === '/version') {
      return json(200, {
        version: 'v4-cacref-salud-demo',
        built_at: '2026-07-30',
        features: ['bcrypt', '4-roles', 'arcos', 'audit-log', 'pdf', 'bulk-import', 'transparencia', 'privacidad', 'rate-limit', 'email-confirmation', 'status-email', 'aporte-base-2'],
        has_user_object_in_me: true,
        has_admin_pass_hash_support: true,
        has_resend_api_key: Boolean(process.env.RESEND_API_KEY),
        sender_email: process.env.SENDER_EMAIL || 'noreply@futpvcacref.com',
      });
    }

    if (event.httpMethod === 'POST' && pathname === '/census/upload') {
      try {
        const contentType = String(event.headers?.['content-type'] || event.headers?.['Content-Type'] || '');
        if (!contentType.includes('multipart/form-data')) {
          return json(400, { error: 'Se requiere multipart/form-data.' });
        }
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!boundaryMatch) return json(400, { error: 'Boundary no encontrado.' });
        const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;

        // Decode body (Netlify sends binary as base64)
        let bodyBuf: Buffer;
        if (event.isBase64Encoded && event.body) {
          bodyBuf = Buffer.from(event.body, 'base64');
        } else if (event.body) {
          bodyBuf = Buffer.from(event.body, 'utf8');
        } else {
          return json(400, { error: 'Body vacio.' });
        }
        if (bodyBuf.length > 6 * 1024 * 1024) {
          return json(413, { error: 'Payload demasiado grande' });
        }

        // Find the file part
        const boundaryBuf = Buffer.from(boundary, 'utf8');
        const parts: Buffer[] = [];
        let start = bodyBuf.indexOf(boundaryBuf);
        if (start < 0) return json(400, { error: 'Boundary no encontrado en body.' });
        start += boundaryBuf.length;
        while (start < bodyBuf.length) {
          const next = bodyBuf.indexOf(boundaryBuf, start);
          if (next < 0) break;
          parts.push(bodyBuf.subarray(start, next));
          start = next + boundaryBuf.length;
        }

        let fileBuffer: Buffer | null = null;
        let fileName = 'archivo';
        let mimeType = 'application/octet-stream';

        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd < 0) continue;
          const rawHeaders = part.subarray(0, headerEnd).toString('utf8');
          const content = part.subarray(headerEnd + 4, part.length - 2); // strip trailing \r\n
          if (!rawHeaders.includes('name="file"')) continue;
          const fnMatch = rawHeaders.match(/filename="([^"]+)"/);
          const ctMatch = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i);
          if (fnMatch) fileName = fnMatch[1];
          if (ctMatch) mimeType = ctMatch[1].trim();
          fileBuffer = content;
          break;
        }

        if (!fileBuffer) return json(400, { error: 'No se encontro el archivo en el form.' });

        const id = randomUUID();
        const sizeBytes = fileBuffer.length;
        await db.execute({
          sql: 'INSERT INTO submission_files (id, file_type, original_name, stored_name, mime_type, size_bytes, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [id, 'OTRO', fileName, id, mimeType, sizeBytes, fileBuffer],
        });
        return json(200, {
          id,
          originalName: fileName,
          mimeType,
          sizeBytes,
          url: `/api/census/files/${id}`,
        });
      } catch (err) {
        console.error('Upload error:', err);
        return json(500, { error: 'Error al procesar el archivo.' });
      }
    }

    if (event.httpMethod === 'GET' && /^\/census\/files\/[^/]+$/.test(pathname)) {
      const id = pathname.split('/')[3];
      const rs = await db.execute({
        sql: 'SELECT mime_type, data, original_name FROM submission_files WHERE id = ?',
        args: [id],
      });
      if (!rs.rows[0]) return json(404, { error: 'No encontrado' });
      const row = rs.rows[0] as any;
      const data = row.data;
      if (data == null) return json(404, { error: 'Sin datos' });
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': String(row.mime_type || 'application/octet-stream'),
          'Content-Disposition': `inline; filename="${row.original_name || id}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
        body: buf.toString('base64'),
        isBase64Encoded: true,
      };
    }

    if (event.httpMethod === 'GET' && /^\/census\/status\/\d{5,12}$/.test(pathname)) {
      try {
        const cedula = pathname.split('/')[3];
        const rowRs = await db.execute({
          sql: `SELECT nombre_apellido, cedula, gerencia, workflow_status, assigned_to,
                  decision_tipo, decision_monto, decision_observaciones, decision_at,
                  workflow_updated_at, created_at
                  FROM census_submissions WHERE cedula = ? LIMIT 1`,
          args: [cedula],
        });
        const row = rowRs.rows[0] as any;
        if (!row) return json(200, { found: false });

        const updatedAt = row.workflow_updated_at
          ? new Date(String(row.workflow_updated_at))
          : new Date(String(row.created_at));
        const days = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
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

        return json(200, {
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
      } catch (err) {
        console.error('Status error:', err);
        return json(500, { found: false, error: 'Error interno del servidor.' });
      }
    }

    // ARCO: Cancelacion (Art. 25 LOPDP) - anonimiza datos personales
    if (event.httpMethod === 'POST' && /^\/census\/delete\/\d{5,12}$/.test(pathname)) {
      try {
        const cedula = pathname.split('/')[3];
        const payload = event.body ? JSON.parse(event.body) : {};
        const confirmToken = toText(payload.confirm);
        if (confirmToken !== 'ELIMINAR') {
          return json(400, { error: 'Debe confirmar con el token "ELIMINAR" en el body.' });
        }
        const exists = await db.execute({ sql: 'SELECT id, cedula, nombre_apellido FROM census_submissions WHERE cedula = ?', args: [cedula] });
        const row = exists.rows[0] as any;
        if (!row) return json(404, { error: 'Cedula no encontrada' });
        const now = new Date().toISOString();
        await db.execute({
          sql: `UPDATE census_submissions SET
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
          WHERE id = ?`,
          args: [row.id],
        });
        await audit(event, 'self_service', 'capturista', 'arco_cancel', 'submission', row.id, { cedula, derecho: 'Art. 25 LOPDP' });
        return json(200, {
          success: true,
          message: 'Sus datos personales han sido anonimizados conforme a la LOPDP.',
          id: row.id,
          derecho_ejercitado: 'Cancelacion (Art. 25 LOPDP)',
          fecha_eliminacion: now,
        });
      } catch (err) {
        console.error('Delete error:', err);
        return json(500, { error: 'Error interno del servidor.' });
      }
    }

    // ARCO: Portabilidad (Art. 25 LOPDP) - exporta todos los datos del titular en JSON
    if (event.httpMethod === 'POST' && /^\/census\/export\/\d{5,12}$/.test(pathname)) {
      try {
        const cedula = pathname.split('/')[3];
        const rowRs = await db.execute({
          sql: 'SELECT * FROM census_submissions WHERE cedula = ? LIMIT 1',
          args: [cedula],
        });
        const row = rowRs.rows[0] as any;
        if (!row) return json(404, { found: false, error: 'Cedula no encontrada' });
        const filesRs = await db.execute({
          sql: 'SELECT file_type, original_name, mime_type, size_bytes, uploaded_at FROM submission_files WHERE submission_id = ?',
          args: [row.id],
        });
        const historyRs = await db.execute({
          sql: 'SELECT from_status, to_status, note, changed_at FROM workflow_history WHERE submission_id = ? ORDER BY changed_at ASC',
          args: [row.id],
        });
        await audit(event, 'self_service', 'capturista', 'arco_export', 'submission', row.id, { cedula, derecho: 'Art. 25 LOPDP' });
        return json(200, {
          exportado_en: new Date().toISOString(),
          formato: 'JSON LOPDP Art. 25 (Portabilidad)',
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
          archivos: filesRs.rows,
          historial_workflow: historyRs.rows,
          creado_en: row.created_at,
        });
      } catch (err) {
        console.error('Export error:', err);
        return json(500, { error: 'Error interno del servidor.' });
      }
    }

    if (event.httpMethod === 'POST' && pathname === '/census') {
      const payload = event.body ? JSON.parse(event.body) : {};
      const data = normalizeInput(payload);
      const validationError = validateCensusInput(data);
      if (validationError) return json(400, { error: validationError });

      const evaluation = evaluateApplicant(data);

      const result = await db.execute({
        sql: `
          INSERT INTO census_submissions (
            nombre_apellido, cedula, telefono, correo, region_sede, vicepresidencia,
            direccion_ejecutiva, gerencia, unidad_operativa,
            anos_servicio, cargo, ingreso_individual, ingreso_familiar, afiliado_cacref,
            capacidad_cuota, posee_vehiculo, vehiculo_ano, vehiculo_modelo, vehiculo_marca,
            vehiculo_estado, vehiculo_aspirado, requiere_medicamento_cronico, medicamento_detalle,
            requiere_cirugia, cirugia_detalle, familiar_requiere_asistencia, calidad_vida_escala, score,
            score_seniority, score_payment_capacity, score_affordability, score_vehicle_need, score_health_need,
            score_cooperative_bonus, affordability_ratio, suggested_max_quota, risk_level,
            recommendation, priority_bucket
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          data.nombre_apellido,
          data.cedula,
          data.telefono,
          data.correo,
          data.unidad_operativa || data.region_sede || null,
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
          0,
          evaluation.score_health_need,
          evaluation.score_cooperative_bonus,
          evaluation.affordability_ratio,
          evaluation.suggested_max_quota,
          evaluation.risk_level,
          evaluation.recommendation,
          evaluation.priority_bucket,
        ],
      });

      // Vincular los archivos subidos previamente (que estaban con submission_id=NULL)
      // con el censo recién creado. El frontend envía un array de {uploadId, fileType}.
      const newSubmissionId = Number(result.lastInsertRowid ?? 0);
      const attachments = Array.isArray((payload as any)?.attachments) ? (payload as any).attachments : [];
      let filesAttached = 0;
      for (const att of attachments) {
        const uploadId = toText((att as any)?.uploadId);
        if (!uploadId) continue;
        await db.execute({
          sql: 'UPDATE submission_files SET submission_id = ?, file_type = ? WHERE id = ? AND submission_id IS NULL',
          args: [newSubmissionId, toText((att as any)?.fileType) || 'OTRO', uploadId],
        });
        filesAttached++;
      }
      // Marcar has_document si hay al menos un archivo
      if (filesAttached > 0) {
        await db.execute({
          sql: 'UPDATE census_submissions SET has_document = 1 WHERE id = ?',
          args: [newSubmissionId],
        });
      }

      const confirmationEmail = await sendCensusConfirmationEmail({
        to: data.correo,
        nombre: data.nombre_apellido,
        cedula: data.cedula,
        submissionId: newSubmissionId,
        gerencia: data.gerencia,
        aporteBase: data.capacidad_cuota,
        filesAttached,
      });

      return json(201, {
        success: true,
        id: newSubmissionId,
        score: evaluation.score,
        recommendation: evaluation.recommendation,
        risk_level: evaluation.risk_level,
        files_attached: filesAttached,
        email: confirmationEmail,
      });
    }

    if (event.httpMethod === 'GET' && pathname === '/admin/submissions') {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const params = new URL(event.rawUrl).searchParams;
      const where: string[] = ['1=1'];
      const args: Array<string | number> = [];

      const gerencia = toText(params.get('gerencia'));
      const minIngreso = params.get('minIngreso');
      const maxIngreso = params.get('maxIngreso');
      const recommendation = toText(params.get('recommendation'));
      const riskLevel = toText(params.get('riskLevel'));
      const search = toText(params.get('search'));
      const assignedTo = toText(params.get('assignedTo'));

      if (gerencia) {
        where.push('gerencia LIKE ?');
        args.push(`%${gerencia}%`);
      }
      if (minIngreso) {
        where.push('ingreso_individual >= ?');
        args.push(toNumber(minIngreso));
      }
      if (maxIngreso) {
        where.push('ingreso_individual <= ?');
        args.push(toNumber(maxIngreso));
      }
      if (recommendation) {
        where.push('recommendation = ?');
        args.push(recommendation);
      }
      if (riskLevel) {
        where.push('risk_level = ?');
        args.push(riskLevel);
      }
      if (search) {
        where.push('(nombre_apellido LIKE ? OR cedula LIKE ? OR correo LIKE ? OR telefono LIKE ?)');
        const s = `%${search}%`;
        args.push(s, s, s, s);
      }
      if (assignedTo) {
        where.push('assigned_to = ?');
        args.push(assignedTo);
      }

      const rs = await db.execute({
        sql: `
          SELECT *
          FROM census_submissions
          WHERE ${where.join(' AND ')}
          ORDER BY COALESCE(priority_bucket, 99) ASC, score DESC, created_at DESC
        `,
        args,
      });
      const rows = rs.rows as any[];
      const limit = clamp(toNumber(params.get('limit'), 50), 1, 200);
      const total = rows.length;
      const total_pages = Math.max(1, Math.ceil(total / limit));
      return json(200, { data: rows, total, total_pages, page: 1 });
    }

    if (event.httpMethod === 'GET' && pathname === '/admin/insights') {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const rs = await db.execute(`
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
      return json(200, rs.rows[0] ?? {});
    }

    if (event.httpMethod === 'PATCH' && /^\/admin\/submissions\/\d+\/status$/.test(pathname)) {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      const payload = event.body ? JSON.parse(event.body) : {};
      const { status, note, decision, assigned_to, send_email } = payload || {};
      const validStatuses = ['REGISTRADO', 'EN_REVISION', 'COMITE', 'RESUELTO', 'DESCARTADO'];
      if (!validStatuses.includes(status)) return json(400, { error: 'Estado invalido' });
      if (currentUser!.role === 'capturista' && status !== 'EN_REVISION') {
        return json(403, { error: 'Los capturistas solo pueden mover casos a EN_REVISION.' });
      }
      const noteText = toText(note).slice(0, 500) || null;

      const current = await db.execute({ sql: 'SELECT workflow_status, correo, nombre_apellido FROM census_submissions WHERE id = ?', args: [id] });
      if (!current.rows[0]) return json(404, { error: 'Registro no encontrado' });
      const now = new Date().toISOString();
      const currentRow = current.rows[0] as any;
      const fromStatus = currentRow.workflow_status;

      let updateFields = '';
      const updateArgs: any[] = [status, noteText, now];

      if (assigned_to !== undefined) {
        updateFields += ', assigned_to = ?';
        updateArgs.push(toText(assigned_to).slice(0, 120) || null);
      }

      if (status === 'RESUELTO' && decision) {
        const tiposValidos = ['MEDICAMENTO', 'CIRUGIA', 'APOYO_FAMILIAR', 'OTRO'];
        const tipo = tiposValidos.includes(decision.tipo) ? decision.tipo : 'OTRO';
        const monto = Math.max(0, toNumber(decision.monto_aprobado));
        const obs = toText(decision.observaciones).slice(0, 1000) || null;
        updateFields += ', decision_tipo = ?, decision_monto = ?, decision_observaciones = ?, decision_at = ?';
        updateArgs.push(tipo, monto, obs, now);
      }

      updateArgs.push(id);

      await db.execute({
        sql: `UPDATE census_submissions SET workflow_status = ?, workflow_notes = ?, workflow_updated_at = ?${updateFields} WHERE id = ?`,
        args: updateArgs,
      });
      await db.execute({
        sql: 'INSERT INTO workflow_history (submission_id, from_status, to_status, note, changed_at) VALUES (?, ?, ?, ?, ?)',
        args: [id, fromStatus, status, noteText, now],
      });

      let emailResult: { sent: boolean; mocked: boolean; reason?: string; messageId?: string } = { sent: false, mocked: false };
      if (send_email && currentRow.correo) {
        emailResult = await sendStatusEmail({
          to: String(currentRow.correo),
          nombre: String(currentRow.nombre_apellido || 'Postulante'),
          status,
          note: noteText,
          decision: status === 'RESUELTO' && decision ? {
            tipo: String(decision.tipo || 'OTRO'),
            monto_aprobado: toNumber(decision.monto_aprobado),
            observaciones: toText(decision.observaciones),
          } : null,
        });
      }

      await audit(event, session!.username, currentUser!.role, 'status_change', 'submission', id, { from: fromStatus, to: status, assigned_to, sent_email: emailResult.sent, email_reason: emailResult.reason });
      return json(200, { success: true, status, changed_at: now, email: emailResult });
    }

    if (event.httpMethod === 'GET' && /^\/admin\/submissions\/\d+\/history$/.test(pathname)) {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      const rs = await db.execute({
        sql: 'SELECT id, from_status, to_status, note, changed_at FROM workflow_history WHERE submission_id = ? ORDER BY changed_at ASC',
        args: [id],
      });
      return json(200, rs.rows);
    }

    if (event.httpMethod === 'GET' && /^\/admin\/submissions\/\d+\/comments$/.test(pathname)) {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      const rs = await db.execute({
        sql: 'SELECT id, author, author_role, body, created_at FROM case_comments WHERE submission_id = ? ORDER BY created_at ASC',
        args: [id],
      });
      return json(200, rs.rows);
    }

    // Bulk import - simplified: accepts a JSON array of submissions
    if (event.httpMethod === 'POST' && pathname === '/admin/submissions/bulk-import') {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      try {
        const payload = event.body ? JSON.parse(event.body) : {};
        const items: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
        let inserted = 0;
        let errors = 0;
        const errorDetails: any[] = [];
        for (let i = 0; i < items.length; i++) {
          try {
            const data = normalizeInput(items[i]);
            const validationError = validateCensusInput(data);
            if (validationError) { errors++; errorDetails.push({ row: i, error: validationError }); continue; }
            const evaluation = evaluateApplicant(data);
            await db.execute({
              sql: `INSERT INTO census_submissions (
                nombre_apellido, cedula, telefono, correo, region_sede, vicepresidencia,
                direccion_ejecutiva, gerencia, unidad_operativa,
                anos_servicio, cargo, ingreso_individual, ingreso_familiar, afiliado_cacref,
                capacidad_cuota, posee_vehiculo, vehiculo_ano, vehiculo_modelo, vehiculo_marca,
                vehiculo_estado, vehiculo_aspirado, requiere_medicamento_cronico, medicamento_detalle,
                requiere_cirugia, cirugia_detalle, familiar_requiere_asistencia, calidad_vida_escala, score,
                score_seniority, score_payment_capacity, score_affordability, score_vehicle_need, score_health_need,
                score_cooperative_bonus, affordability_ratio, suggested_max_quota, risk_level,
                recommendation, priority_bucket
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                data.nombre_apellido, data.cedula, data.telefono, data.correo, null, data.vicepresidencia,
                data.direccion_ejecutiva, data.gerencia, data.unidad_operativa,
                data.anos_servicio, data.cargo, data.ingreso_individual, data.ingreso_familiar, data.afiliado_cacref ? 1 : 0,
                data.capacidad_cuota, 0, null, null, null, null, 'NO APLICA - CENSO SALUD',
                data.requiere_medicamento_cronico ? 1 : 0, data.medicamento_detalle,
                data.requiere_cirugia ? 1 : 0, data.cirugia_detalle,
                data.familiar_requiere_asistencia ? 1 : 0, data.calidad_vida_escala,
                evaluation.score, evaluation.score_seniority, evaluation.score_payment_capacity,
                evaluation.score_affordability, 0, evaluation.score_health_need,
                evaluation.score_cooperative_bonus, evaluation.affordability_ratio,
                evaluation.suggested_max_quota, evaluation.risk_level,
                evaluation.recommendation, evaluation.priority_bucket,
              ],
            });
            inserted++;
          } catch (e: any) {
            errors++;
            errorDetails.push({ row: i, error: String(e?.message || e) });
          }
        }
        await audit(event, session!.username, currentUser!.role, 'bulk_import', 'submissions', null, { inserted, errors });
        return json(200, { success: true, inserted, errors, errorDetails: errorDetails.slice(0, 10) });
      } catch (err) {
        console.error('Bulk import error:', err);
        return json(500, { error: 'Error interno del servidor.' });
      }
    }

    if (event.httpMethod === 'POST' && /^\/admin\/submissions\/\d+\/comments$/.test(pathname)) {
      const auth = requireRole('vocal');
      if (!auth.ok) return json(auth.status, auth.body);
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      const payload = event.body ? JSON.parse(event.body) : {};
      const body = toText(payload.body).slice(0, 2000);
      if (!body) return json(400, { error: 'El comentario no puede estar vacio.' });
      const exists = await db.execute({ sql: 'SELECT id FROM census_submissions WHERE id = ?', args: [id] });
      if (!exists.rows[0]) return json(404, { error: 'Registro no encontrado' });
      const result = await db.execute({
        sql: 'INSERT INTO case_comments (submission_id, author, author_role, body) VALUES (?, ?, ?, ?)',
        args: [id, session!.username, currentUser!.role, body],
      });
      const newId = Number(result.lastInsertRowid ?? 0);
      const created = await db.execute({
        sql: 'SELECT id, author, author_role, body, created_at FROM case_comments WHERE id = ?',
        args: [newId],
      });
      await audit(event, session!.username, currentUser!.role, 'comment_added', 'submission', id, { snippet: body.slice(0, 100) });
      return json(201, (created.rows[0] as any) || {});
    }

    if (event.httpMethod === 'GET' && /^\/admin\/submissions\/\d+\/files$/.test(pathname)) {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      const rs = await db.execute({
        sql: 'SELECT id, file_type, original_name, stored_name, mime_type, size_bytes, uploaded_at FROM submission_files WHERE submission_id = ? ORDER BY uploaded_at ASC',
        args: [id],
      });
      const files = (rs.rows as any[]).map((f) => ({
        ...f,
        url: `/api/census/files/${f.id}`,
      }));
      return json(200, files);
    }

    if (event.httpMethod === 'POST' && /^\/admin\/submissions\/\d+\/attach$/.test(pathname)) {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      await db.execute({ sql: 'UPDATE census_submissions SET has_document = 1 WHERE id = ?', args: [id] });
      return json(200, { success: true, has_document: true });
    }

    if (event.httpMethod === 'POST' && /^\/admin\/submissions\/\d+\/detach$/.test(pathname)) {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      await db.execute({ sql: 'UPDATE census_submissions SET has_document = 0 WHERE id = ?', args: [id] });
      return json(200, { success: true, has_document: false });
    }

    if (event.httpMethod === 'GET' && pathname === '/admin/notifications') {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const params = new URL(event.rawUrl).searchParams;
      const limit = clamp(toNumber(params.get('limit'), 20), 1, 100);
      const me = session?.username || 'admin';
      const rows = await db.execute({
        sql: `SELECT id, type, title, body, target_type, target_id, actor, read_at, created_at
              FROM notifications
              WHERE user_target IN ('all', ?)
              ORDER BY created_at DESC
              LIMIT ?`,
        args: [me, limit],
      });
      const unreadRs = await db.execute({
        sql: `SELECT COUNT(*) as c FROM notifications WHERE user_target IN ('all', ?) AND read_at IS NULL`,
        args: [me],
      });
      return json(200, { data: rows.rows, unread: Number((unreadRs.rows[0] as any)?.c || 0) });
    }

    if (event.httpMethod === 'PATCH' && /^\/admin\/notifications\/\d+\/read$/.test(pathname)) {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      await db.execute({
        sql: 'UPDATE notifications SET read_at = ? WHERE id = ?',
        args: [new Date().toISOString(), id],
      });
      return json(200, { success: true });
    }

    if (event.httpMethod === 'PATCH' && pathname === '/admin/notifications/read-all') {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const me = session?.username || 'admin';
      await db.execute({
        sql: `UPDATE notifications SET read_at = ? WHERE user_target IN ('all', ?) AND read_at IS NULL`,
        args: [new Date().toISOString(), me],
      });
      return json(200, { success: true });
    }

    if (event.httpMethod === 'GET' && pathname === '/admin/audit') {
      const auth = requireRole('director');
      if (!auth.ok) return json(auth.status, auth.body);
      const params = new URL(event.rawUrl).searchParams;
      const actor = toText(params.get('actor'));
      const action = toText(params.get('action'));
      const pageNum = Math.max(1, toNumber(params.get('page'), 1));
      const limitNum = Math.min(200, Math.max(1, toNumber(params.get('limit'), 50)));
      const offset = (pageNum - 1) * limitNum;

      const where: string[] = ['1=1'];
      const args: Array<string | number> = [];
      if (actor) { where.push('actor = ?'); args.push(actor); }
      if (action) { where.push('action = ?'); args.push(action); }

      const countRs = await db.execute({ sql: `SELECT COUNT(*) as total FROM audit_log WHERE ${where.join(' AND ')}`, args });
      const total = Number((countRs.rows[0] as any)?.total || 0);
      const rows = await db.execute({
        sql: `SELECT id, actor, actor_role, action, target_type, target_id, details, ip, user_agent, created_at
              FROM audit_log WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        args: [...args, limitNum, offset],
      });
      return json(200, {
        data: rows.rows,
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
      });
    }

    if (event.httpMethod === 'GET' && pathname === '/admin/executive-summary') {
      const auth = requireRole('capturista');
      if (!auth.ok) return json(auth.status, auth.body);
      const total = await db.execute('SELECT COUNT(*) as total FROM census_submissions');
      const porEstado = await db.execute("SELECT COALESCE(workflow_status, 'REGISTRADO') as workflow_status, COUNT(*) as count FROM census_submissions GROUP BY workflow_status");
      const porReco = await db.execute("SELECT COALESCE(recommendation, 'NO_ELEGIBLE') as recommendation, COUNT(*) as count FROM census_submissions GROUP BY recommendation");
      const topGer = await db.execute(`
        SELECT gerencia,
          SUM(CASE WHEN risk_level = 'ALTO' THEN 1 ELSE 0 END) as ALTO,
          SUM(CASE WHEN risk_level = 'MEDIO' THEN 1 ELSE 0 END) as MEDIO,
          SUM(CASE WHEN risk_level = 'BAJO' THEN 1 ELSE 0 END) as BAJO,
          COUNT(*) as total
        FROM census_submissions
        GROUP BY gerencia
        ORDER BY total DESC
        LIMIT 8
      `);
      const agregados = await db.execute(`
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
      for (const row of porEstado.rows as any[]) porEstadoObj[row.workflow_status] = Number(row.count);
      const porRecoObj: Record<string, number> = { APROBADO_PRIORIDAD_ALTA: 0, APROBADO_CONDICIONAL: 0, REQUIERE_COMITE: 0, NO_ELEGIBLE: 0 };
      for (const row of porReco.rows as any[]) porRecoObj[row.recommendation] = Number(row.count);

      const agg = (agregados.rows[0] as any) || {};
      return json(200, {
        total: Number((total.rows[0] as any)?.total || 0),
        por_estado: porEstadoObj,
        por_recomendacion: porRecoObj,
        top_gerencias: topGer.rows,
        calidad_vida_promedio: Number(agg.calidad_vida_promedio || 0),
        score_promedio: Number(agg.score_promedio || 0),
        ratio_cuota_ingreso_promedio: Number(agg.ratio_cuota_ingreso_promedio || 0),
        total_con_medicamento_cronico: Number(agg.total_con_medicamento || 0),
        total_con_cirugia: Number(agg.total_con_cirugia || 0),
        total_con_familiar_asistencia: Number(agg.total_con_familiar_asistencia || 0),
        fecha_generacion: new Date().toISOString(),
      });
    }

    return json(404, { error: 'Ruta no encontrada' });
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.toLowerCase().includes('unique')) {
      return json(400, { error: 'Ya existe un censo registrado con esta cedula.' });
    }
    console.error('Netlify function error:', error);
    return json(500, { error: 'Error interno del servidor.' });
  }
};
