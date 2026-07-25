import { createClient, type Client } from '@libsql/client/http';
import { createHmac, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

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

const rawTursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;
// Accept either the legacy plain ADMIN_PASS or any of the 4 role-specific bcrypt hashes.
// If a *_PASS_HASH is provided, compare with bcrypt; otherwise fall back to plain ADMIN_PASS.
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PLAIN_PASS = process.env.ADMIN_PASS || 'censo2025';
const ADMIN_PASS_HASHES: string[] = [
  process.env.ADMIN_PASS_HASH,
  process.env.PRES_PASS_HASH,
  process.env.VOCAL_PASS_HASH,
  process.env.CAPT_PASS_HASH,
].filter(Boolean) as string[];
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'change_this_secret_in_production';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;
const ADMIN_COOKIE_NAME = 'admin_session';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 7;
const LOGIN_BLOCK_MS = 20 * 60 * 1000;
const EDGE_WINDOW_MS = 60 * 1000;
const EDGE_MAX_REQUESTS = 160;
if (!rawTursoUrl || !tursoToken) {
  throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in Netlify environment.');
}

async function checkPassword(pass: string, user: string): Promise<boolean> {
  // If any *_PASS_HASH is configured, the admin must use the corresponding username.
  // For simplicity, accept any of the 4 hashes (all hashes are seeded for the same demo pass).
  if (ADMIN_PASS_HASHES.length > 0) {
    for (const hash of ADMIN_PASS_HASHES) {
      try {
        if (await bcrypt.compare(pass, hash)) return true;
      } catch {
        // ignore malformed hash
      }
    }
    return false;
  }
  return safeEqual(pass, ADMIN_PLAIN_PASS);
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

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function signSessionPayload(payloadBase64: string) {
  return createHmac('sha256', ADMIN_SESSION_SECRET).update(payloadBase64).digest('base64url');
}

function createSessionToken(username: string) {
  const payloadBase64 = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000 })
  ).toString('base64url');
  const signature = signSessionPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

function verifySessionToken(token?: string | null) {
  if (!token || !token.includes('.')) return false;
  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) return false;

  const expectedSignature = signSessionPayload(payloadBase64);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as { u?: string; exp?: number };
    if (!payload?.u || !payload?.exp) return false;
    if (payload.u !== ADMIN_USER) return false;
    if (Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
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
    ingreso_individual: Math.max(toNumber(payload.ingreso_individual), 0),
    ingreso_familiar: Math.max(toNumber(payload.ingreso_familiar), 0),
    afiliado_cacref: Boolean(payload.afiliado_cacref),
    capacidad_cuota: Math.max(toNumber(payload.capacidad_cuota), 0),
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
    const isAdmin = verifySessionToken(cookies[ADMIN_COOKIE_NAME]);

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
      if (!safeEqual(user, ADMIN_USER) || !(await checkPassword(pass, user))) {
        registerLoginFailure(clientIp, now);
        return json(401, { error: 'Credenciales incorrectas' });
      }
      clearLoginFailures(clientIp);
      const token = createSessionToken(user);
      const cookie = `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ADMIN_SESSION_TTL_SECONDS}${isProd ? '; Secure' : ''}`;
      return json(200, { success: true, user: { username: user, role: 'director', name: 'Director General' } }, { 'Set-Cookie': cookie });
    }

    if (event.httpMethod === 'POST' && pathname === '/admin/logout') {
      const cookie = `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
      return json(200, { success: true }, { 'Set-Cookie': cookie });
    }

    if (event.httpMethod === 'GET' && pathname === '/admin/me') {
      if (!isAdmin) return json(401, { error: 'No autorizado' });
      return json(200, { ok: true, user: { username: ADMIN_USER, role: 'director', name: 'Director General' } });
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

    if (event.httpMethod === 'GET' && pathname === '/version') {
      return json(200, {
        version: 'v3-bcrypt-multi-role-lopdp',
        built_at: '2026-07-25',
        features: ['bcrypt', '4-roles', 'arcos', 'audit-log', 'pdf', 'bulk-import', 'transparencia', 'privacidad', 'rate-limit', 'lopolis-endpoints'],
        has_user_object_in_me: true,
        has_admin_pass_hash_support: true,
      });
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

      return json(201, {
        success: true,
        id: Number(result.lastInsertRowid ?? 0),
        score: evaluation.score,
        recommendation: evaluation.recommendation,
        risk_level: evaluation.risk_level,
      });
    }

    if (event.httpMethod === 'GET' && pathname === '/admin/submissions') {
      if (!isAdmin) return json(401, { error: 'No autorizado' });
      const params = new URL(event.rawUrl).searchParams;
      const where: string[] = ['1=1'];
      const args: Array<string | number> = [];

      const gerencia = toText(params.get('gerencia'));
      const minIngreso = params.get('minIngreso');
      const maxIngreso = params.get('maxIngreso');
      const recommendation = toText(params.get('recommendation'));
      const riskLevel = toText(params.get('riskLevel'));

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
      if (!isAdmin) return json(401, { error: 'No autorizado' });
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
      if (!isAdmin) return json(401, { error: 'No autorizado' });
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      const payload = event.body ? JSON.parse(event.body) : {};
      const { status, note } = payload || {};
      const validStatuses = ['REGISTRADO', 'EN_REVISION', 'COMITE', 'RESUELTO', 'DESCARTADO'];
      if (!validStatuses.includes(status)) return json(400, { error: 'Estado invalido' });
      const noteText = toText(note).slice(0, 500) || null;

      const current = await db.execute({ sql: 'SELECT workflow_status FROM census_submissions WHERE id = ?', args: [id] });
      if (!current.rows[0]) return json(404, { error: 'Registro no encontrado' });
      const now = new Date().toISOString();

      await db.execute({
        sql: 'UPDATE census_submissions SET workflow_status = ?, workflow_notes = ?, workflow_updated_at = ? WHERE id = ?',
        args: [status, noteText, now, id],
      });
      await db.execute({
        sql: 'INSERT INTO workflow_history (submission_id, from_status, to_status, note, changed_at) VALUES (?, ?, ?, ?, ?)',
        args: [id, (current.rows[0] as any).workflow_status, status, noteText, now],
      });
      return json(200, { success: true, status, changed_at: now });
    }

    if (event.httpMethod === 'GET' && /^\/admin\/submissions\/\d+\/history$/.test(pathname)) {
      if (!isAdmin) return json(401, { error: 'No autorizado' });
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      const rs = await db.execute({
        sql: 'SELECT id, from_status, to_status, note, changed_at FROM workflow_history WHERE submission_id = ? ORDER BY changed_at ASC',
        args: [id],
      });
      return json(200, rs.rows);
    }

    if (event.httpMethod === 'GET' && pathname === '/admin/notifications') {
      if (!isAdmin) return json(401, { error: 'No autorizado' });
      const params = new URL(event.rawUrl).searchParams;
      const limit = clamp(toNumber(params.get('limit'), 20), 1, 100);
      const rows = await db.execute({
        sql: `SELECT id, type, title, body, target_type, target_id, actor, read_at, created_at
              FROM notifications
              WHERE user_target IN ('all', ?)
              ORDER BY created_at DESC
              LIMIT ?`,
        args: [ADMIN_USER, limit],
      });
      const unreadRs = await db.execute({
        sql: `SELECT COUNT(*) as c FROM notifications WHERE user_target IN ('all', ?) AND read_at IS NULL`,
        args: [ADMIN_USER],
      });
      return json(200, { data: rows.rows, unread: Number((unreadRs.rows[0] as any)?.c || 0) });
    }

    if (event.httpMethod === 'PATCH' && /^\/admin\/notifications\/\d+\/read$/.test(pathname)) {
      if (!isAdmin) return json(401, { error: 'No autorizado' });
      const id = Number(pathname.split('/')[3]);
      if (!id) return json(400, { error: 'Id invalido' });
      await db.execute({
        sql: 'UPDATE notifications SET read_at = ? WHERE id = ?',
        args: [new Date().toISOString(), id],
      });
      return json(200, { success: true });
    }

    if (event.httpMethod === 'PATCH' && pathname === '/admin/notifications/read-all') {
      if (!isAdmin) return json(401, { error: 'No autorizado' });
      await db.execute({
        sql: `UPDATE notifications SET read_at = ? WHERE user_target IN ('all', ?) AND read_at IS NULL`,
        args: [new Date().toISOString(), ADMIN_USER],
      });
      return json(200, { success: true });
    }

    if (event.httpMethod === 'GET' && pathname === '/admin/executive-summary') {
      if (!isAdmin) return json(401, { error: 'No autorizado' });
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
