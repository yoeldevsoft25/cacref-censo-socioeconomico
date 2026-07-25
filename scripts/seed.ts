import 'dotenv/config';
import Database from 'better-sqlite3';
import { createClient } from '@libsql/client/node';
import { generateSeedSubmissions } from '../src/lib/seedData';

const EVALUATE = (data: any) => {
  const years = Math.max(0, Math.min(40, data.anos_servicio));
  const income = Math.max(0, data.ingreso_individual);
  const monthlyQuota = Math.max(0, data.capacidad_cuota);
  const familyIncome = Math.max(0, data.ingreso_familiar);
  const affordabilityRatio = income > 0 ? monthlyQuota / income : 0;
  const suggestedMaxQuota = Math.round(income * 0.35 * 100) / 100;
  const householdSupportRatio = income > 0 ? familyIncome / income : 1;

  const seniorityScore = Math.max(0, Math.min(22, (years / 15) * 22));
  const paymentCapacityScore = Math.max(0, Math.min(28, (monthlyQuota / 420) * 28));
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
  healthNeedScore = Math.max(0, Math.min(45, healthNeedScore));

  const cooperativeBonus = data.afiliado_cacref ? 6 : 0;
  const householdSupportScore = Math.max(0, Math.min(4, (householdSupportRatio - 1) * 4));
  const score = Math.max(0, Math.min(100, seniorityScore + paymentCapacityScore + affordabilityScore + healthNeedScore + cooperativeBonus + householdSupportScore));

  let riskLevel: 'BAJO' | 'MEDIO' | 'ALTO' = 'BAJO';
  if (data.requiere_cirugia || data.calidad_vida_escala <= 3) riskLevel = 'ALTO';
  else if (data.requiere_medicamento_cronico || data.calidad_vida_escala <= 5) riskLevel = 'MEDIO';

  let recommendation: 'APROBADO_PRIORIDAD_ALTA' | 'APROBADO_CONDICIONAL' | 'REQUIERE_COMITE' | 'NO_ELEGIBLE' = 'NO_ELEGIBLE';
  let priorityBucket = 4;
  if (score >= 80 && riskLevel === 'BAJO') { recommendation = 'APROBADO_PRIORIDAD_ALTA'; priorityBucket = 1; }
  else if (score >= 65 && riskLevel !== 'ALTO') { recommendation = 'APROBADO_CONDICIONAL'; priorityBucket = 2; }
  else if (score >= 50) { recommendation = 'REQUIERE_COMITE'; priorityBucket = 3; }

  return {
    score: Math.round(score * 100) / 100,
    score_seniority: Math.round(seniorityScore * 100) / 100,
    score_payment_capacity: Math.round(paymentCapacityScore * 100) / 100,
    score_affordability: Math.round(affordabilityScore * 100) / 100,
    score_health_need: Math.round(healthNeedScore * 100) / 100,
    score_cooperative_bonus: Math.round((cooperativeBonus + householdSupportScore) * 100) / 100,
    affordability_ratio: Math.round(affordabilityRatio * 100) / 100,
    suggested_max_quota: suggestedMaxQuota,
    risk_level: riskLevel,
    recommendation,
    priority_bucket: priorityBucket,
  };
};

const SCHEMA_SQL = `
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
    score_health_need REAL,
    score_cooperative_bonus REAL,
    affordability_ratio REAL,
    suggested_max_quota REAL,
    risk_level TEXT,
    recommendation TEXT,
    priority_bucket INTEGER,
    workflow_status TEXT NOT NULL DEFAULT 'REGISTRADO',
    workflow_notes TEXT,
    workflow_updated_at DATETIME,
    decision_tipo TEXT,
    decision_monto REAL,
    decision_observaciones TEXT,
    decision_at DATETIME,
    assigned_to TEXT,
    has_document BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const INSERT_SQL = `
  INSERT INTO census_submissions (
    nombre_apellido, cedula, telefono, correo, region_sede, vicepresidencia,
    direccion_ejecutiva, gerencia, unidad_operativa, anos_servicio, cargo,
    ingreso_individual, ingreso_familiar, afiliado_cacref, capacidad_cuota,
    posee_vehiculo, vehiculo_aspirado,
    requiere_medicamento_cronico, medicamento_detalle, requiere_cirugia,
    cirugia_detalle, familiar_requiere_asistencia, calidad_vida_escala,
    score, score_seniority, score_payment_capacity, score_affordability,
    score_health_need, score_cooperative_bonus, affordability_ratio,
    suggested_max_quota, risk_level, recommendation, priority_bucket,
    workflow_status, workflow_updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const HISTORY_SQL = `
  INSERT INTO workflow_history (submission_id, from_status, to_status, note, changed_at)
  VALUES (?, ?, ?, ?, ?)
`;

async function main() {
  const args = process.argv.slice(2);
  const wipe = args.includes('--wipe');
  const countArg = args.find(a => a.startsWith('--count='));
  const count = countArg ? parseInt(countArg.split('=')[1], 10) : 85;

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  const useTurso = Boolean(tursoUrl && tursoToken);

  console.log(`Modo: ${useTurso ? 'Turso (produccion)' : 'SQLite local'}`);

  let db: any;
  let localDb: any = null;
  let isTurso = false;

  if (useTurso) {
    db = createClient({ url: tursoUrl!, authToken: tursoToken! });
    isTurso = true;
  } else {
    localDb = new Database('census.db');
    db = localDb;
  }

  console.log('Asegurando schema...');
  if (isTurso) {
    await db.batch([
      SCHEMA_SQL,
      `CREATE TABLE IF NOT EXISTS workflow_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        note TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
      )`,
      `CREATE TABLE IF NOT EXISTS submission_files (
        id TEXT PRIMARY KEY,
        submission_id INTEGER,
        file_type TEXT NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
      )`,
      `CREATE TABLE IF NOT EXISTS audit_log (
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
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
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
      )`,
      `CREATE TABLE IF NOT EXISTS case_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        author TEXT NOT NULL,
        author_role TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
      )`,
    ], 'write');
  } else {
    localDb.exec(SCHEMA_SQL);
    localDb.exec(`CREATE TABLE IF NOT EXISTS workflow_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      note TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
    )`);
    localDb.exec(`CREATE TABLE IF NOT EXISTS submission_files (
      id TEXT PRIMARY KEY,
      submission_id INTEGER,
      file_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
    )`);
    localDb.exec(`CREATE TABLE IF NOT EXISTS audit_log (
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
    )`);
    localDb.exec(`CREATE TABLE IF NOT EXISTS notifications (
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
    )`);
    localDb.exec(`CREATE TABLE IF NOT EXISTS case_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      author_role TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
    )`);
  }

  if (wipe) {
    console.log('Limpiando tablas...');
    if (isTurso) {
      await db.batch([
        'DELETE FROM case_comments',
        'DELETE FROM submission_files',
        'DELETE FROM workflow_history',
        'DELETE FROM notifications',
        'DELETE FROM audit_log',
        'DELETE FROM census_submissions',
      ], 'write');
    } else {
      localDb.exec('DELETE FROM case_comments');
      localDb.exec('DELETE FROM submission_files');
      localDb.exec('DELETE FROM workflow_history');
      localDb.exec('DELETE FROM notifications');
      localDb.exec('DELETE FROM audit_log');
      localDb.exec('DELETE FROM census_submissions');
    }
    console.log('Tablas limpiadas.');
  }

  console.log(`Generando ${count} registros...`);
  const records = generateSeedSubmissions(count);

  const INTENTIONAL_DISTRIBUTION = ['REGISTRADO', 'REGISTRADO', 'EN_REVISION', 'EN_REVISION', 'EN_REVISION', 'COMITE', 'COMITE', 'RESUELTO', 'RESUELTO', 'DESCARTADO'];
  const workflowByRecommendation: Record<string, string> = {
    APROBADO_PRIORIDAD_ALTA: 'COMITE',
    APROBADO_CONDICIONAL: 'EN_REVISION',
    REQUIERE_COMITE: 'EN_REVISION',
    NO_ELEGIBLE: 'DESCARTADO',
  };

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    try {
      const ev = EVALUATE(r);
      const status = i === 0 ? 'COMITE' : INTENTIONAL_DISTRIBUTION[i % INTENTIONAL_DISTRIBUTION.length];
      const now = new Date(Date.now() - (records.length - i) * 60 * 60 * 1000).toISOString();

      let newId: number | bigint;

      if (isTurso) {
        const result = await db.execute({
          sql: INSERT_SQL,
          args: [
            r.nombre_apellido, r.cedula, r.telefono, r.correo, r.region_sede, r.vicepresidencia,
            r.direccion_ejecutiva, r.gerencia, r.unidad_operativa, r.anos_servicio, r.cargo,
            r.ingreso_individual, r.ingreso_familiar, r.afiliado_cacref ? 1 : 0, r.capacidad_cuota,
            0, 'NO APLICA - CENSO SALUD',
            r.requiere_medicamento_cronico ? 1 : 0, r.medicamento_detalle, r.requiere_cirugia ? 1 : 0,
            r.cirugia_detalle, r.familiar_requiere_asistencia ? 1 : 0, r.calidad_vida_escala,
            ev.score, ev.score_seniority, ev.score_payment_capacity, ev.score_affordability,
            ev.score_health_need, ev.score_cooperative_bonus, ev.affordability_ratio,
            ev.suggested_max_quota, ev.risk_level, ev.recommendation, ev.priority_bucket,
            status, now,
          ],
        });
        newId = Number(result.lastInsertRowid ?? 0);
        await db.execute({
          sql: HISTORY_SQL,
          args: [newId, null, status, 'Carga inicial masiva', now],
        });
      } else {
        const insert = localDb.prepare(INSERT_SQL);
        const insertHistory = localDb.prepare(HISTORY_SQL);
        const result = insert.run(
          r.nombre_apellido, r.cedula, r.telefono, r.correo, r.region_sede, r.vicepresidencia,
          r.direccion_ejecutiva, r.gerencia, r.unidad_operativa, r.anos_servicio, r.cargo,
          r.ingreso_individual, r.ingreso_familiar, r.afiliado_cacref ? 1 : 0, r.capacidad_cuota,
          0, 'NO APLICA - CENSO SALUD',
          r.requiere_medicamento_cronico ? 1 : 0, r.medicamento_detalle, r.requiere_cirugia ? 1 : 0,
          r.cirugia_detalle, r.familiar_requiere_asistencia ? 1 : 0, r.calidad_vida_escala,
          ev.score, ev.score_seniority, ev.score_payment_capacity, ev.score_affordability,
          ev.score_health_need, ev.score_cooperative_bonus, ev.affordability_ratio,
          ev.suggested_max_quota, ev.risk_level, ev.recommendation, ev.priority_bucket,
          status, now,
        );
        newId = Number(result.lastInsertRowid);
        insertHistory.run(newId, null, status, 'Carga inicial masiva', now);
      }
      inserted++;
    } catch (err: any) {
      const msg = String(err.message || '');
      if (msg.toLowerCase().includes('unique')) {
        skipped++;
      } else {
        errors.push(`${r.cedula}: ${msg}`);
        skipped++;
      }
    }
  }

  console.log('');
  console.log('=== Resultado ===');
  console.log('Insertados:', inserted);
  console.log('Omitidos:', skipped);
  if (errors.length > 0) {
    console.log('Errores (primeros 3):');
    errors.slice(0, 3).forEach(e => console.log(' -', e));
  }

  if (isTurso) {
    const countRes = await db.execute('SELECT COUNT(*) as c FROM census_submissions');
    const workflowRes = await db.execute('SELECT workflow_status, COUNT(*) as c FROM census_submissions GROUP BY workflow_status');
    const recoRes = await db.execute('SELECT recommendation, COUNT(*) as c FROM census_submissions GROUP BY recommendation');
    console.log('');
    console.log('Total censos en Turso:', (countRes.rows[0] as any).c);
    console.log('Por estado:', workflowRes.rows);
    console.log('Por recomendacion:', recoRes.rows);
  } else {
    const total = localDb.prepare('SELECT COUNT(*) as c FROM census_submissions').get() as any;
    const byStatus = localDb.prepare('SELECT workflow_status, COUNT(*) as c FROM census_submissions GROUP BY workflow_status').all() as any[];
    const byReco = localDb.prepare('SELECT recommendation, COUNT(*) as c FROM census_submissions GROUP BY recommendation').all() as any[];
    console.log('');
    console.log('Total censos:', total.c);
    console.log('Por estado:', byStatus);
    console.log('Por recomendacion:', byReco);
  }

  if (localDb) localDb.close();
  console.log('');
  console.log('Listo.');
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
