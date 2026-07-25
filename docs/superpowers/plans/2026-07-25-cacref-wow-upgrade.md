# CACREF Wow Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar el MVP de CACREF a "las grandes ligas" hoy mismo, agregando workflow con estados, charts de impacto, resumen ejecutivo, PDF imprimible, página de metodología pública, firma personal y seed data con historia.

**Architecture:** Refactor quirúrgico del AdminDashboard existente para integrar Recharts (visualización), jspdf (PDF cliente), nueva tabla `workflow_history` y 3 endpoints. El formulario público y los componentes existentes no se tocan. Se agrega capa de metodología + footer como superficie pública.

**Tech Stack:** React 19, Vite 6, Tailwind 4, motion, lucide-react, Recharts, jspdf, jspdf-autotable, Express, better-sqlite3 / @libsql/client.

**Worktree:** Este plan se ejecuta en el directorio actual del proyecto (`C:\Users\Yoel Dev\Documents\GitHub\CACREF-SALUD`).

**Reglas de oro:**
- `npm run lint` y `npm run build` deben pasar al final de cada fase.
- No se permiten placeholders. Cada paso tiene código o comando concreto.
- No se elimina `census.db` durante la ejecución.
- Validación es manual (no se escriben tests automatizados hoy).

---

## Fase 1 — Foundation (1.5 h)

### Task 1.1: Instalar dependencias

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar paquetes**

```bash
npm install recharts jspdf jspdf-autotable
```

- [ ] **Step 2: Verificar instalación**

```bash
npm list recharts jspdf jspdf-autotable
```

Expected: 3 paquetes listados con versiones.

- [ ] **Step 3: Lint baseline**

```bash
npm run lint
```

Expected: PASS (mismos warnings que antes).

---

### Task 1.2: Crear `src/lib/format.ts`

**Files:**
- Create: `src/lib/format.ts`

Helpers de formato centralizados.

- [ ] **Step 1: Crear archivo**

```ts
export function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatMoney(value: unknown): string {
  return `$${toNumber(value).toFixed(2)}`;
}

export function formatPercent(value: unknown, decimals = 1): string {
  const num = toNumber(value);
  return `${(num * 100).toFixed(decimals)}%`;
}

export function formatDate(value: unknown): string {
  if (!value) return 'N/D';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatDateTime(value: unknown): string {
  if (!value) return 'N/D';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleString('es-VE', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function boolLabel(value: number | boolean | undefined | null): string {
  return Boolean(value) ? 'Si' : 'No';
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

export const WORKFLOW_STATUSES = ['REGISTRADO', 'EN_REVISION', 'COMITE', 'RESUELTO', 'DESCARTADO'] as const;
export type WorkflowStatus = typeof WORKFLOW_STATUSES[number];

export function workflowStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'EN_REVISION': return 'En revision';
    case 'COMITE': return 'En comite';
    case 'RESUELTO': return 'Resuelto';
    case 'DESCARTADO': return 'Descartado';
    default: return 'Registrado';
  }
}

export function workflowStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'EN_REVISION': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'COMITE': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'RESUELTO': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'DESCARTADO': return 'bg-slate-100 text-slate-700 border-slate-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
```

---

### Task 1.3: Backend local — schema y endpoints nuevos (`server.ts`)

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Agregar columnas a `initDatabase`**

En la función `initDatabase`, después de los `ensureColumn` existentes, agregar:

```ts
await ensureColumn('workflow_status', "TEXT NOT NULL DEFAULT 'REGISTRADO'");
await ensureColumn('workflow_notes', 'TEXT');
await ensureColumn('workflow_updated_at', 'DATETIME');
```

- [ ] **Step 2: Crear tabla `workflow_history` después de los índices**

```ts
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
await execSql('CREATE INDEX IF NOT EXISTS idx_history_submission ON workflow_history(submission_id, changed_at)');
await execSql('CREATE INDEX IF NOT EXISTS idx_census_workflow_status ON census_submissions(workflow_status)');
```

- [ ] **Step 3: Agregar endpoint PATCH /api/admin/submissions/:id/status**

Insertar antes de `app.get('/api/admin/submissions', ...)`:

```ts
app.patch('/api/admin/submissions/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Id invalido' });
      return;
    }
    const { status, note } = req.body || {};
    const validStatuses = ['REGISTRADO', 'EN_REVISION', 'COMITE', 'RESUELTO', 'DESCARTADO'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Estado invalido' });
      return;
    }
    const noteText = toText(note).slice(0, 500) || null;

    const current = await queryOne<any>('SELECT workflow_status FROM census_submissions WHERE id = ?', [id]);
    if (!current) {
      res.status(404).json({ error: 'Registro no encontrado' });
      return;
    }

    const now = new Date().toISOString();
    await runSql(
      'UPDATE census_submissions SET workflow_status = ?, workflow_notes = ?, workflow_updated_at = ? WHERE id = ?',
      [status, noteText, now, id]
    );
    await runSql(
      'INSERT INTO workflow_history (submission_id, from_status, to_status, note, changed_at) VALUES (?, ?, ?, ?, ?)',
      [id, current.workflow_status, status, noteText, now]
    );

    res.json({ success: true, status, changed_at: now });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});
```

- [ ] **Step 4: Agregar endpoint GET /api/admin/submissions/:id/history**

```ts
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
```

- [ ] **Step 5: Agregar endpoint GET /api/admin/executive-summary**

```ts
app.get('/api/admin/executive-summary', requireAdminAuth, async (_req, res) => {
  try {
    const total = await queryOne<{ total: number }>('SELECT COUNT(*) as total FROM census_submissions');
    const porEstado = await queryAll<{ workflow_status: string; count: number }>(
      'SELECT COALESCE(workflow_status, "REGISTRADO") as workflow_status, COUNT(*) as count FROM census_submissions GROUP BY workflow_status'
    );
    const porRecomendacion = await queryAll<{ recommendation: string; count: number }>(
      'SELECT COALESCE(recommendation, "NO_ELEGIBLE") as recommendation, COUNT(*) as count FROM census_submissions GROUP BY recommendation'
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
```

- [ ] **Step 6: Verificar lint**

```bash
npm run lint
```

Expected: PASS.

---

### Task 1.4: Backend deploy — mismas adiciones en `netlify/functions/api.ts`

**Files:**
- Modify: `netlify/functions/api.ts`

- [ ] **Step 1: Agregar columna y tabla nuevas en `initSchema`**

En la función `initSchema`, después de los `ensureColumn` existentes, agregar:

```ts
await ensureColumn('workflow_status', "TEXT NOT NULL DEFAULT 'REGISTRADO'", existingColumns);
await ensureColumn('workflow_notes', 'TEXT', existingColumns);
await ensureColumn('workflow_updated_at', 'DATETIME', existingColumns);
```

Y crear la tabla nueva:

```ts
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
await db.execute('CREATE INDEX IF NOT EXISTS idx_history_submission ON workflow_history(submission_id, changed_at)');
await db.execute('CREATE INDEX IF NOT EXISTS idx_census_workflow_status ON census_submissions(workflow_status)');
```

- [ ] **Step 2: Agregar handlers nuevos**

Antes de `return json(404, ...)`:

```ts
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
    args: [id, current.rows[0].workflow_status, status, noteText, now],
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

if (event.httpMethod === 'GET' && pathname === '/admin/executive-summary') {
  if (!isAdmin) return json(401, { error: 'No autorizado' });
  const total = await db.execute('SELECT COUNT(*) as total FROM census_submissions');
  const porEstado = await db.execute('SELECT COALESCE(workflow_status, \'REGISTRADO\') as workflow_status, COUNT(*) as count FROM census_submissions GROUP BY workflow_status');
  const porReco = await db.execute('SELECT COALESCE(recommendation, \'NO_ELEGIBLE\') as recommendation, COUNT(*) as count FROM census_submissions GROUP BY recommendation');
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
```

- [ ] **Step 2: Verificar lint**

```bash
npm run lint
```

Expected: PASS.

---

### Task 1.5: Verificar compilación

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: EXIT 0, archivos en `dist/`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json src/lib/format.ts server.ts netlify/functions/api.ts
git commit -m "feat: workflow fields, history table, executive summary endpoints"
```

(Solo si el repo es git; si no, omitir.)

---

## Fase 2 — Seed data (30 min)

### Task 2.1: Generador de seed data

**Files:**
- Create: `src/lib/seedData.ts`

- [ ] **Step 1: Crear archivo**

```ts
export interface SeedRecord {
  nombre_apellido: string;
  cedula: string;
  telefono: string;
  correo: string;
  region_sede: string;
  vicepresidencia: string;
  direccion_ejecutiva: string;
  gerencia: string;
  unidad_operativa: string;
  anos_servicio: number;
  cargo: string;
  ingreso_individual: number;
  ingreso_familiar: number;
  afiliado_cacref: boolean;
  capacidad_cuota: number;
  requiere_medicamento_cronico: boolean;
  medicamento_detalle: string | null;
  requiere_cirugia: boolean;
  cirugia_detalle: string | null;
  familiar_requiere_asistencia: boolean;
  calidad_vida_escala: number;
}

const GERENCIAS = [
  { gerencia: 'Refinacion', dir: 'Direccion Ejecutiva de Manufactura', vp: 'VP de Manufactura' },
  { gerencia: 'Produccion', dir: 'Direccion Ejecutiva de Produccion', vp: 'VP de Produccion' },
  { gerencia: 'Exploracion', dir: 'Direccion Ejecutiva de Exploracion', vp: 'VP de Exploracion' },
  { gerencia: 'Comercializacion', dir: 'Direccion Ejecutiva Comercial', vp: 'VP Comercial' },
  { gerencia: 'Gas', dir: 'Direccion Ejecutiva de Gas', vp: 'VP de Gas' },
  { gerencia: 'Logistica y Transporte', dir: 'Direccion Ejecutiva de Logistica', vp: 'VP de Logistica' },
  { gerencia: 'Mantenimiento', dir: 'Direccion Ejecutiva de Mantenimiento', vp: 'VP de Mantenimiento' },
  { gerencia: 'Seguridad Industrial', dir: 'Direccion Ejecutiva de SSO', vp: 'VP de Operaciones' },
  { gerencia: 'Recursos Humanos', dir: 'Direccion Ejecutiva de Talento Humano', vp: 'VP de Administracion' },
  { gerencia: 'Tecnologia e Informacion', dir: 'Direccion Ejecutiva de TI', vp: 'VP de Administracion' },
];

const CARGOS = ['Operador', 'Tecnico', 'Supervisor', 'Analista', 'Especialista', 'Coordinador', 'Profesional Asociado', 'Asistente Administrativo', 'Jefe de Unidad', 'Gerente'];

const NOMBRES = ['Juan', 'Maria', 'Carlos', 'Ana', 'Luis', 'Pedro', 'Jose', 'Rosa', 'Carmen', 'Miguel', 'Luis', 'Jorge', 'Patricia', 'Daniela', 'Andres', 'Sofia', 'Eduardo', 'Gabriela', 'Francisco', 'Isabel', 'Manuel', 'Laura', 'Ricardo', 'Teresa', 'Rafael', 'Beatriz', 'Alejandro', 'Monica', 'Roberto', 'Cristina'];
const APELLIDOS = ['Perez', 'Gonzalez', 'Rodriguez', 'Hernandez', 'Garcia', 'Martinez', 'Lopez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera', 'Gomez', 'Diaz', 'Morales', 'Castro', 'Ortiz', 'Delgado', 'Reyes', 'Romero'];

const CONDICIONES_MEDICAS = [
  'Losartan 50mg diario para hipertension',
  'Metformina 850mg cada 12 horas para diabetes tipo 2',
  'Atorvastatina 40mg diario para colesterol alto',
  'Salbutamol inhalador para asma',
  'Levotiroxina 75mcg para hipotiroidismo',
  'Enalapril 10mg diario para hipertension',
  'Insulina NPH para diabetes tipo 1',
  'Quimioterapia en curso - control oncologico',
  'Anticoagulantes por trombosis previa',
  'Omeprazol 20mg para reflujo gastrico',
];

const PROCEDIMIENTOS = [
  'Cirugia de cataratas en ojo izquierdo',
  'Artroplastia de rodilla derecha pendiente',
  'Colecistectomia laparoscopica',
  'Hernia discal lumbar - evaluacion quirurgica',
  'Cirugia bariatrica en evaluacion',
  'Cardiaca: cateterismo pendiente',
  'Protesis de cadera izquierda',
  'Cirugia de tunel carpiano bilateral',
];

const FAMILIARES = [
  'Conyuge con tratamiento de quimioterapia',
  'Hijo menor con condicion neurologica',
  'Madre de 78 anos con diabetes y movilidad reducida',
  'Padre con Alzheimer en etapa inicial',
  'Hija con condicion cardiaca congenita',
  'Conyuge postoperatorio de columna',
];

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateSeedSubmissions(count: number): SeedRecord[] {
  const records: SeedRecord[] = [];
  for (let i = 0; i < count; i++) {
    const ger = rand(GERENCIAS);
    const cedula = String(randInt(5000000, 35000000));
    const years = randInt(0, 35);
    const individual = Math.round((randInt(200, 3500) + Math.random()) * 100) / 100;
    const familiar = Math.round((individual + randInt(-500, 1500)) * 100) / 100;
    const hasMed = Math.random() < 0.35;
    const hasSurg = Math.random() < 0.18;
    const hasFam = Math.random() < 0.22;
    const calidad = Math.max(1, Math.min(10, Math.round(4 + (Math.random() - 0.6) * 6)));
    const quota = Math.round(individual * (0.18 + Math.random() * 0.2) * 100) / 100;

    records.push({
      nombre_apellido: `${rand(NOMBRES)} ${rand(APELLIDOS)} ${rand(APELLIDOS)}`,
      cedula,
      telefono: `04${randInt(12, 26)}${randInt(1000000, 9999999)}`,
      correo: `${rand(NOMBRES).toLowerCase()}.${rand(APELLIDOS).toLowerCase()}${i}@pdvsa.com.ve`,
      region_sede: rand(['Caracas', 'Maracaibo', 'Valencia', 'Puerto La Cruz', 'Barinas', 'Maturin']),
      vicepresidencia: ger.vp,
      direccion_ejecutiva: ger.dir,
      gerencia: ger.gerencia,
      unidad_operativa: `Unidad ${rand(['Norte', 'Sur', 'Oriental', 'Occidental', 'Central'])}`,
      anos_servicio: years,
      cargo: rand(CARGOS),
      ingreso_individual: individual,
      ingreso_familiar: Math.max(0, familiar),
      afiliado_cacref: Math.random() < 0.85,
      capacidad_cuota: quota,
      requiere_medicamento_cronico: hasMed,
      medicamento_detalle: hasMed ? rand(CONDICIONES_MEDICAS) : null,
      requiere_cirugia: hasSurg,
      cirugia_detalle: hasSurg ? rand(PROCEDIMIENTOS) : null,
      familiar_requiere_asistencia: hasFam,
      calidad_vida_escala: calidad,
    });
  }

  // Casos destacados garantizados
  records[0] = {
    nombre_apellido: 'Juan Carlos Perez Mendoza',
    cedula: '12345678',
    telefono: '04141234567',
    correo: 'juan.perez@pdvsa.com.ve',
    region_sede: 'Caracas',
    vicepresidencia: 'VP de Produccion',
    direccion_ejecutiva: 'Direccion Ejecutiva de Produccion',
    gerencia: 'Produccion',
    unidad_operativa: 'Unidad Norte',
    anos_servicio: 22,
    cargo: 'Supervisor',
    ingreso_individual: 850,
    ingreso_familiar: 1200,
    afiliado_cacref: true,
    capacidad_cuota: 220,
    requiere_medicamento_cronico: true,
    medicamento_detalle: 'Losartan 50mg diario para hipertension + Atorvastatina 40mg',
    requiere_cirugia: true,
    cirugia_detalle: 'Cardiaca: cateterismo pendiente',
    familiar_requiere_asistencia: true,
    calidad_vida_escala: 2,
  };

  return records;
}
```

---

### Task 2.2: Script de seed

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: Crear directorio**

```bash
mkdir -p scripts
```

- [ ] **Step 2: Crear script**

```ts
import 'dotenv/config';
import Database from 'better-sqlite3';
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

function main() {
  const args = process.argv.slice(2);
  const wipe = args.includes('--wipe');
  const countArg = args.find(a => a.startsWith('--count='));
  const count = countArg ? parseInt(countArg.split('=')[1], 10) : 80;

  const db = new Database('census.db');
  if (wipe) {
    db.exec('DELETE FROM workflow_history');
    db.exec('DELETE FROM census_submissions');
    console.log('Tablas limpiadas.');
  }

  const records = generateSeedSubmissions(count);
  const insert = db.prepare(`
    INSERT INTO census_submissions (
      nombre_apellido, cedula, telefono, correo, region_sede, vicepresidencia,
      direccion_ejecutiva, gerencia, unidad_operativa, anos_servicio, cargo,
      ingreso_individual, ingreso_familiar, afiliado_cacref, capacidad_cuota,
      requiere_medicamento_cronico, medicamento_detalle, requiere_cirugia,
      cirugia_detalle, familiar_requiere_asistencia, calidad_vida_escala,
      score, score_seniority, score_payment_capacity, score_affordability,
      score_health_need, score_cooperative_bonus, affordability_ratio,
      suggested_max_quota, risk_level, recommendation, priority_bucket,
      workflow_status, workflow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO workflow_history (submission_id, from_status, to_status, note, changed_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const workflowByRecommendation: Record<string, string> = {
    APROBADO_PRIORIDAD_ALTA: 'COMITE',
    APROBADO_CONDICIONAL: 'EN_REVISION',
    REQUIERE_COMITE: 'EN_REVISION',
    NO_ELEGIBLE: 'DESCARTADO',
  };

  let inserted = 0;
  for (const r of records) {
    try {
      const ev = EVALUATE(r);
      const status = workflowByRecommendation[ev.recommendation] || 'REGISTRADO';
      const now = new Date().toISOString();
      const result = insert.run(
        r.nombre_apellido, r.cedula, r.telefono, r.correo, r.region_sede, r.vicepresidencia,
        r.direccion_ejecutiva, r.gerencia, r.unidad_operativa, r.anos_servicio, r.cargo,
        r.ingreso_individual, r.ingreso_familiar, r.afiliado_cacref ? 1 : 0, r.capacidad_cuota,
        r.requiere_medicamento_cronico ? 1 : 0, r.medicamento_detalle, r.requiere_cirugia ? 1 : 0,
        r.cirugia_detalle, r.familiar_requiere_asistencia ? 1 : 0, r.calidad_vida_escala,
        ev.score, ev.score_seniority, ev.score_payment_capacity, ev.score_affordability,
        ev.score_health_need, ev.score_cooperative_bonus, ev.affordability_ratio,
        ev.suggested_max_quota, ev.risk_level, ev.recommendation, ev.priority_bucket,
        status, now
      );
      insertHistory.run(result.lastInsertRowid, null, status, 'Carga inicial masiva', now);
      inserted++;
    } catch (err: any) {
      if (!String(err.message).toLowerCase().includes('unique')) {
        console.error('Error insertando', r.cedula, err.message);
      }
    }
  }

  console.log(`Insertados/actualizados: ${inserted} registros.`);
  const counts = db.prepare(`SELECT workflow_status, COUNT(*) as c FROM census_submissions GROUP BY workflow_status`).all() as any[];
  console.log('Distribucion por estado:', counts);
  db.close();
}

main();
```

- [ ] **Step 3: Ejecutar seed**

```bash
npx tsx scripts/seed.ts --wipe --count=85
```

Expected: `Insertados/actualizados: 85 registros.` + tabla de distribución.

- [ ] **Step 4: Verificar en DB**

```bash
node -e "const db = require('better-sqlite3')('census.db'); console.log(db.prepare('SELECT COUNT(*) as c FROM census_submissions').get());"
```

Expected: `{ c: 85 }`

---

## Fase 3 — Dashboard charts (1 h)

### Task 3.1: RecommendationPie

**Files:**
- Create: `src/components/Charts/RecommendationPie.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Props {
  data: Record<string, number>;
}

const COLORS: Record<string, string> = {
  APROBADO_PRIORIDAD_ALTA: '#10b981',
  APROBADO_CONDICIONAL: '#3b82f6',
  REQUIERE_COMITE: '#f59e0b',
  NO_ELEGIBLE: '#ef4444',
};

const LABELS: Record<string, string> = {
  APROBADO_PRIORIDAD_ALTA: 'Prioridad Alta',
  APROBADO_CONDICIONAL: 'Aprobado Condicional',
  REQUIERE_COMITE: 'Comite',
  NO_ELEGIBLE: 'No Elegible',
};

export default function RecommendationPie({ data }: Props) {
  const chartData = Object.entries(data)
    .filter(([_, v]) => v > 0)
    .map(([key, value]) => ({ name: LABELS[key] || key, value, key }));

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Sin datos suficientes</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={COLORS[entry.key] || '#94a3b8'} stroke="white" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

---

### Task 3.2: GerenciaBar

**Files:**
- Create: `src/components/Charts/GerenciaBar.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from 'recharts';

interface GerenciaRow {
  gerencia: string;
  ALTO: number;
  MEDIO: number;
  BAJO: number;
}

export default function GerenciaBar({ data }: { data: GerenciaRow[] }) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Sin datos</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis dataKey="gerencia" type="category" width={140} tick={{ fontSize: 11, fill: '#64748b' }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
        <Bar dataKey="ALTO" stackId="risk" fill="#ef4444" name="Alto riesgo" />
        <Bar dataKey="MEDIO" stackId="risk" fill="#f59e0b" name="Riesgo medio" />
        <Bar dataKey="BAJO" stackId="risk" fill="#10b981" name="Riesgo bajo" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

### Task 3.3: QualityOfLifeHistogram

**Files:**
- Create: `src/components/Charts/QualityOfLifeHistogram.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid } from 'recharts';

export default function QualityOfLifeHistogram({ values }: { values: number[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    bin: String(i + 1),
    count: values.filter(v => v === i + 1).length,
  }));

  const colorFor = (bin: string) => {
    const n = parseInt(bin, 10);
    if (n <= 3) return '#ef4444';
    if (n <= 5) return '#f59e0b';
    if (n <= 7) return '#3b82f6';
    return '#10b981';
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={buckets} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="bin" tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Calidad de vida (1-10)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {buckets.map((b) => (
            <Cell key={b.bin} fill={colorFor(b.bin)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

### Task 3.4: Integrar charts en AdminDashboard

**Files:**
- Modify: `src/components/AdminDashboard.tsx`

- [ ] **Step 1: Importar charts y agregar estado**

Al inicio del archivo, modificar imports:

```tsx
import RecommendationPie from './Charts/RecommendationPie';
import GerenciaBar from './Charts/GerenciaBar';
import QualityOfLifeHistogram from './Charts/QualityOfLifeHistogram';
```

Dentro de `AdminDashboard`, agregar al estado:

```tsx
const [executiveSummary, setExecutiveSummary] = useState<any>(null);
```

- [ ] **Step 2: Cargar executive summary en fetchDashboard**

Modificar `fetchDashboard` para también llamar al nuevo endpoint:

```tsx
const fetchDashboard = async () => {
  setLoading(true);
  try {
    const queryParams = new URLSearchParams();
    if (filters.gerencia.trim()) queryParams.append('gerencia', filters.gerencia.trim());
    if (filters.minIngreso) queryParams.append('minIngreso', filters.minIngreso);
    if (filters.maxIngreso) queryParams.append('maxIngreso', filters.maxIngreso);
    if (filters.recommendation) queryParams.append('recommendation', filters.recommendation);
    if (filters.riskLevel) queryParams.append('riskLevel', filters.riskLevel);

    const [submissionsResponse, insightsResponse, summaryResponse] = await Promise.all([
      fetch(`/api/admin/submissions?${queryParams.toString()}`),
      fetch('/api/admin/insights'),
      fetch('/api/admin/executive-summary'),
    ]);

    const submissionsData = await submissionsResponse.json();
    const insightsData = await insightsResponse.json();
    const summaryData = await summaryResponse.json();
    setSubmissions(Array.isArray(submissionsData) ? submissionsData : []);
    setInsights(insightsData || {});
    setExecutiveSummary(summaryData || null);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    setSubmissions([]);
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 3: Insertar sección de charts después de los StatCards**

Localizar el bloque que contiene `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">` con los StatCards. Después de cerrar ese div, insertar:

```tsx
{executiveSummary && (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Distribución por Recomendación</h3>
        <span className="text-xs text-slate-400">{executiveSummary.total} registros</span>
      </div>
      <RecommendationPie data={executiveSummary.por_recomendacion} />
    </div>
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Riesgo por Gerencia</h3>
        <span className="text-xs text-slate-400">Top {executiveSummary.top_gerencias?.length || 0}</span>
      </div>
      <GerenciaBar data={executiveSummary.top_gerencias || []} />
    </div>
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Calidad de Vida</h3>
        <span className="text-xs text-slate-400">Promedio {executiveSummary.calidad_vida_promedio}/10</span>
      </div>
      <QualityOfLifeHistogram values={submissions.map(s => Number(s.calidad_vida_escala))} />
    </div>
  </div>
)}
```

- [ ] **Step 4: Verificar lint y build**

```bash
npm run lint && npm run build
```

Expected: ambos PASS.

---

## Fase 4 — Workflow + Resumen Ejecutivo (1.5 h)

### Task 4.1: WorkflowStatusControl

**Files:**
- Create: `src/components/WorkflowStatusControl.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X } from 'lucide-react';
import { workflowStatusLabel, workflowStatusColor, WORKFLOW_STATUSES, type WorkflowStatus } from '../lib/format';

interface Props {
  submissionId: number;
  status: string;
  onChange: () => void;
}

export default function WorkflowStatusControl({ submissionId, status, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<WorkflowStatus | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSelect = (newStatus: WorkflowStatus) => {
    if (newStatus === status) {
      setOpen(false);
      return;
    }
    setPending(newStatus);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pending, note: note || null }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setOpen(false);
      setPending(null);
      setNote('');
      onChange();
    } catch (err) {
      console.error(err);
      alert('Error al cambiar el estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${workflowStatusColor(status)} hover:opacity-80 transition-opacity`}
      >
        {workflowStatusLabel(status)}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 right-0 w-72 bg-white rounded-xl border border-slate-200 shadow-2xl p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">Cambiar estado</span>
              <button onClick={() => { setOpen(false); setPending(null); setNote(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {!pending ? (
              <div className="grid grid-cols-1 gap-1">
                {WORKFLOW_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSelect(s)}
                    className={`text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors flex items-center justify-between ${s === status ? 'bg-slate-50' : ''}`}
                  >
                    <span className={workflowStatusColor(s).split(' ')[1]}>{workflowStatusLabel(s)}</span>
                    {s === status && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-600 mb-2">
                  Cambiar a <strong>{workflowStatusLabel(pending)}</strong>
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nota (opcional, máximo 500 caracteres)"
                  maxLength={500}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg resize-none h-20 focus:outline-none focus:border-red-400"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setPending(null)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={saving}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verificar lint**

```bash
npm run lint
```

Expected: PASS.

---

### Task 4.2: Columna Estado en tabla del dashboard

**Files:**
- Modify: `src/components/AdminDashboard.tsx`

- [ ] **Step 1: Importar WorkflowStatusControl**

Agregar al bloque de imports de lucide-react existente:

```tsx
import WorkflowStatusControl from './WorkflowStatusControl';
```

- [ ] **Step 2: Agregar columna en thead**

Buscar la fila `<tr>` con los `<th>` de la tabla. Después del último `<th>Decision</th>`, agregar un nuevo `<th>`:

```tsx
<th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
```

- [ ] **Step 3: Agregar celda en tbody**

Localizar el cierre del `</tr>` de la fila mapeada (justo antes del bloque de modales). Antes del `</tr>` final, agregar:

```tsx
<td className="px-6 py-4 whitespace-nowrap">
  <WorkflowStatusControl
    submissionId={sub.id}
    status={sub.workflow_status || 'REGISTRADO'}
    onChange={fetchDashboard}
  />
</td>
```

- [ ] **Step 4: Ajustar colSpan**

Buscar las dos filas donde está `colSpan={6}` y cambiar a `colSpan={7}`.

---

### Task 4.3: ExecutiveSummary component

**Files:**
- Create: `src/components/ExecutiveSummary.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
import { Activity, AlertCircle, CheckCircle2, Clock, Pill, Stethoscope, Users } from 'lucide-react';
import { formatPercent } from '../lib/format';

interface Props {
  summary: any;
}

export default function ExecutiveSummary({ summary }: Props) {
  if (!summary) return null;

  const total = summary.total || 0;
  const estados = summary.por_estado || {};
  const semaforo = (() => {
    const ratio = total > 0 ? (estados.RESUELTO || 0) / total : 0;
    if (ratio >= 0.4) return { color: 'emerald', label: 'Avance saludable', desc: 'Mas del 40% de los casos atendidos.' };
    if (ratio >= 0.2) return { color: 'amber', label: 'Avance moderado', desc: 'Entre 20% y 40% de los casos atendidos.' };
    return { color: 'red', label: 'Atencion requerida', desc: 'Menos del 20% de los casos atendidos.' };
  })();

  const semaforoCls = {
    emerald: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    amber: 'bg-amber-50 border-amber-300 text-amber-900',
    red: 'bg-red-50 border-red-300 text-red-900',
  }[semaforo.color];

  const kpis = [
    { label: 'Total procesados', value: total, icon: Users, color: 'red' },
    { label: 'Prioridad alta', value: summary.por_recomendacion?.APROBADO_PRIORIDAD_ALTA || 0, icon: AlertCircle, color: 'amber' },
    { label: 'Requieren comite', value: summary.por_recomendacion?.REQUIERE_COMITE || 0, icon: Clock, color: 'blue' },
    { label: 'Resueltos', value: estados.RESUELTO || 0, icon: CheckCircle2, color: 'emerald' },
    { label: 'Medicamento cronico', value: summary.total_con_medicamento_cronico || 0, icon: Pill, color: 'rose' },
    { label: 'Cirugia pendiente', value: summary.total_con_cirugia || 0, icon: Stethoscope, color: 'purple' },
    { label: 'Calidad vida promedio', value: `${summary.calidad_vida_promedio}/10`, icon: Activity, color: 'cyan' },
    { label: 'Score promedio', value: summary.score_promedio, icon: Activity, color: 'indigo' },
  ];

  const colorMap: Record<string, string> = {
    red: 'bg-red-50 text-red-600 border-red-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border-2 p-5 ${semaforoCls}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Semaforo institucional</p>
            <p className="text-lg font-bold mt-0.5">{semaforo.label}</p>
            <p className="text-xs mt-1 opacity-80">{semaforo.desc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{k.label}</span>
              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${colorMap[k.color]}`}>
                <k.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Por recomendacion</p>
          <div className="space-y-2">
            {Object.entries(summary.por_recomendacion || {}).map(([key, val]) => {
              const pct = total > 0 ? Number(val) / total : 0;
              const colors: Record<string, string> = {
                APROBADO_PRIORIDAD_ALTA: 'bg-emerald-500',
                APROBADO_CONDICIONAL: 'bg-blue-500',
                REQUIERE_COMITE: 'bg-amber-500',
                NO_ELEGIBLE: 'bg-red-500',
              };
              const labels: Record<string, string> = {
                APROBADO_PRIORIDAD_ALTA: 'Prioridad Alta',
                APROBADO_CONDICIONAL: 'Aprobado Condicional',
                REQUIERE_COMITE: 'Comite',
                NO_ELEGIBLE: 'No Elegible',
              };
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-700">{labels[key]}</span>
                    <span className="font-semibold text-slate-900">{String(val)} ({formatPercent(pct, 0)})</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colors[key]}`} style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Por estado workflow</p>
          <div className="space-y-2">
            {Object.entries(summary.por_estado || {}).map(([key, val]) => {
              const pct = total > 0 ? Number(val) / total : 0;
              const colors: Record<string, string> = {
                REGISTRADO: 'bg-slate-400',
                EN_REVISION: 'bg-blue-500',
                COMITE: 'bg-amber-500',
                RESUELTO: 'bg-emerald-500',
                DESCARTADO: 'bg-slate-300',
              };
              const labels: Record<string, string> = {
                REGISTRADO: 'Registrado',
                EN_REVISION: 'En revision',
                COMITE: 'En comite',
                RESUELTO: 'Resuelto',
                DESCARTADO: 'Descartado',
              };
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-700">{labels[key]}</span>
                    <span className="font-semibold text-slate-900">{String(val)} ({formatPercent(pct, 0)})</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colors[key]}`} style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Top gerencias</p>
          <div className="space-y-2">
            {(summary.top_gerencias || []).slice(0, 5).map((g: any) => (
              <div key={g.gerencia} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 truncate flex-1">{g.gerencia}</span>
                <div className="flex gap-1">
                  {Number(g.ALTO) > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-semibold">{g.ALTO}A</span>}
                  {Number(g.MEDIO) > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">{g.MEDIO}M</span>}
                  {Number(g.BAJO) > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">{g.BAJO}B</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 4.4: Integrar tab "Resumen Ejecutivo" en AdminDashboard

**Files:**
- Modify: `src/components/AdminDashboard.tsx`

- [ ] **Step 1: Importar ExecutiveSummary**

```tsx
import ExecutiveSummary from './ExecutiveSummary';
```

- [ ] **Step 2: Agregar state para tab activo**

```tsx
const [activeTab, setActiveTab] = useState<'operativo' | 'ejecutivo'>('operativo');
```

- [ ] **Step 3: Agregar botones de tab justo antes del grid de StatCards**

```tsx
<div className="flex gap-2 mb-6 border-b border-slate-200">
  <button
    onClick={() => setActiveTab('operativo')}
    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'operativo' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
  >
    Operativo
  </button>
  <button
    onClick={() => setActiveTab('ejecutivo')}
    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'ejecutivo' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
  >
    Resumen Ejecutivo
  </button>
</div>
```

- [ ] **Step 4: Envolver contenido condicional**

Cambiar el bloque que renderiza Stats + charts + tabla para que se muestre solo en tab 'operativo'. Envolver todo el contenido desde los StatCards hasta antes del modal en:

```tsx
{activeTab === 'operativo' && (
  <>
    {/* contenido actual: StatCards, charts, filtros, tabla */}
  </>
)}
```

- [ ] **Step 5: Agregar contenido del tab ejecutivo**

Después del cierre de `</>` operativo, agregar:

```tsx
{activeTab === 'ejecutivo' && (
  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
    <ExecutiveSummary summary={executiveSummary} />
  </div>
)}
```

- [ ] **Step 6: Verificar lint y build**

```bash
npm run lint && npm run build
```

Expected: PASS.

---

## Fase 5 — PDF + Metodología (1 h)

### Task 5.1: Generador de PDF

**Files:**
- Create: `src/lib/pdf.ts`

- [ ] **Step 1: Crear archivo**

```ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateExecutivePdf(summary: any): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFontSize(18);
  doc.setTextColor(220, 38, 38);
  doc.text('CACREF', margin, 50);
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('Censo Socioeconomico y de Salud', margin, 68);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  const date = new Date(summary.fecha_generacion || Date.now()).toLocaleString('es-VE');
  doc.text(`Generado: ${date}`, pageWidth - margin, 50, { align: 'right' });
  doc.text('Resumen Ejecutivo', pageWidth - margin, 68, { align: 'right' });

  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(2);
  doc.line(margin, 80, pageWidth - margin, 80);

  let y = 110;

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Indicadores clave', margin, y);
  y += 18;

  const total = summary.total || 0;
  const semaforo = (() => {
    const r = total > 0 ? (summary.por_estado?.RESUELTO || 0) / total : 0;
    if (r >= 0.4) return 'AVANCE SALUDABLE';
    if (r >= 0.2) return 'AVANCE MODERADO';
    return 'ATENCION REQUERIDA';
  })();

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const kpis = [
    `Total procesados: ${total}`,
    `Prioridad alta: ${summary.por_recomendacion?.APROBADO_PRIORIDAD_ALTA || 0}`,
    `Aprobado condicional: ${summary.por_recomendacion?.APROBADO_CONDICIONAL || 0}`,
    `En comite: ${summary.por_recomendacion?.REQUIERE_COMITE || 0}`,
    `No elegible: ${summary.por_recomendacion?.NO_ELEGIBLE || 0}`,
    `Resueltos: ${summary.por_estado?.RESUELTO || 0}`,
    `Semaforo: ${semaforo}`,
    `Calidad de vida promedio: ${summary.calidad_vida_promedio}/10`,
    `Score promedio: ${summary.score_promedio}`,
    `Requieren medicamento: ${summary.total_con_medicamento_cronico}`,
    `Requieren cirugia: ${summary.total_con_cirugia}`,
    `Con familiar en asistencia: ${summary.total_con_familiar_asistencia}`,
  ];
  kpis.forEach((k) => {
    doc.text(`• ${k}`, margin, y);
    y += 14;
  });

  y += 12;
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Top 10 registros prioritarios', margin, y);
  y += 8;

  const top = (summary.top_gerencias || []).slice(0, 10).map((g: any, i: number) => [
    String(i + 1),
    String(g.gerencia),
    String(g.total),
    String(g.ALTO),
    String(g.MEDIO),
    String(g.BAJO),
  ]);

  autoTable(doc, {
    startY: y + 4,
    head: [['#', 'Gerencia', 'Total', 'Alto', 'Medio', 'Bajo']],
    body: top.length ? top : [['–', 'Sin datos', '–', '–', '–', '–']],
    theme: 'grid',
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: margin, right: margin },
  });

  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento confidencial. Uso interno CACREF. No sustituye evaluacion medica.', margin, footerY);
  doc.text('Generado con metodologia abierta - Y.D.', pageWidth - margin, footerY, { align: 'right' });

  const filename = `censo-ejecutivo-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
```

---

### Task 5.2: PdfExportButton

**Files:**
- Create: `src/components/PdfExportButton.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { generateExecutivePdf } from '../lib/pdf';

interface Props {
  summary: any;
}

export default function PdfExportButton({ summary }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!summary) return;
    setLoading(true);
    try {
      generateExecutivePdf(summary);
    } catch (err) {
      console.error(err);
      alert('Error al generar PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || !summary}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      {loading ? 'Generando...' : 'PDF Ejecutivo'}
    </button>
  );
}
```

---

### Task 5.3: Integrar botón PDF en dashboard

**Files:**
- Modify: `src/components/AdminDashboard.tsx`

- [ ] **Step 1: Importar PdfExportButton**

```tsx
import PdfExportButton from './PdfExportButton';
```

- [ ] **Step 2: Agregar junto al botón Exportar CSV**

Localizar el bloque con el botón "Exportar CSV". Agregar el botón PDF antes:

```tsx
<div className="flex gap-2">
  <PdfExportButton summary={executiveSummary} />
  <button type="button" onClick={exportCsv} ...>
    <Download className="h-4 w-4 mr-2" />
    Exportar CSV
  </button>
</div>
```

---

### Task 5.4: MethodologyPage

**Files:**
- Create: `src/components/MethodologyPage.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
import { Link } from 'react-router-dom';
import { ArrowLeft, Brain, Shield, TrendingUp, Users, FileText } from 'lucide-react';

const SCORING = [
  { name: 'Antiguedad', weight: 22, desc: 'Premia anos de servicio en la industria. Maximo 22 puntos a los 15 anos.' },
  { name: 'Capacidad de pago', weight: 28, desc: 'Cuota mensual declarada vs capacidad teorica. Maximo 28 puntos.' },
  { name: 'Asequibilidad', weight: 24, desc: 'Ratio cuota/ingreso. Optimo entre 18% y 35%.' },
  { name: 'Necesidad de salud', weight: 45, desc: 'Cirugia (25), medicamento (15), familiar (10), calidad de vida (ajuste).' },
  { name: 'Plus cooperativo', weight: 10, desc: 'Afiliado CACREF (6) + ratio de soporte familiar (4).' },
];

const RECOMMENDATIONS = [
  { key: 'Prioridad Alta', desc: 'Score >= 80 y riesgo bajo. Recomendado para aprobacion inmediata.' },
  { key: 'Aprobado Condicional', desc: 'Score 65-79 sin riesgo alto. Aprobado con seguimiento.' },
  { key: 'Comite', desc: 'Score 50-64 o score 65+ con riesgo alto. Requiere revision del comite.' },
  { key: 'No Elegible', desc: 'Score < 50. No cumple criterios administrativos minimos.' },
];

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver al censo
      </Link>

      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 mb-4">
          <Brain className="w-3.5 h-3.5 text-red-600" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-red-700">Metodologia</span>
        </div>
        <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight">Como evaluamos</h1>
        <p className="mt-4 text-lg text-slate-600 leading-relaxed">
          El sistema asigna a cada registro un puntaje administrativo entre 0 y 100 que ordena automaticamente la cola de atencion.
          No es un diagnostico medico ni una decision de aprobacion: es una herramienta de priorizacion institucional.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-red-600" />
          El scoring
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Componente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Peso max.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Descripcion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {SCORING.map((s) => (
                <tr key={s.name}>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-sm font-display font-bold text-red-600">+{s.weight}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="w-6 h-6 text-red-600" />
          Recomendaciones
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RECOMMENDATIONS.map((r) => (
            <div key={r.key} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-1">{r.key}</h3>
              <p className="text-sm text-slate-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-600" />
          Manejo de datos sensibles
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-3">
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>Que recogemos:</strong> datos personales basicos, ingresos estimados, necesidades declaradas de salud y percepcion de calidad de vida.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>Que NO recogemos:</strong> historia clinica, diagnosticos confirmados, documentos medicos, numero de cuenta bancaria, datos de familiares menores.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>Quien tiene acceso:</strong> solo personal autorizado de CACREF, autenticado, con bitacora de cambios.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>Que no hacemos:</strong> no compartimos con terceros, no usamos para scoring medico, no almacenamos fuera de la infraestructura controlada.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-red-600" />
          Decisiones que habilita
        </h2>
        <ul className="space-y-3 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <li className="flex gap-3"><span className="text-red-600 font-bold">→</span><span className="text-sm text-slate-700">Identificar quien requiere atencion prioritaria en medicamentos cronicos de alto costo.</span></li>
          <li className="flex gap-3"><span className="text-red-600 font-bold">→</span><span className="text-sm text-slate-700">Detectar patrones de necesidad por gerencia o unidad operativa para asignar recursos.</span></li>
          <li className="flex gap-3"><span className="text-red-600 font-bold">→</span><span className="text-sm text-slate-700">Construir un orden de atencion objetivo y trazable para el comite de evaluacion.</span></li>
          <li className="flex gap-3"><span className="text-red-600 font-bold">→</span><span className="text-sm text-slate-700">Reportar a la junta directiva con datos agregados, no con casos individuales.</span></li>
        </ul>
      </section>

      <div className="text-center text-xs text-slate-400 pt-8 border-t border-slate-200">
        Metodologia abierta y trazable. CACREF, 2026.
      </div>
    </div>
  );
}
```

---

### Task 5.5: Agregar ruta `/metodologia`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Importar MethodologyPage**

```tsx
import MethodologyPage from './components/MethodologyPage';
```

- [ ] **Step 2: Agregar ruta**

```tsx
<Route path="/metodologia" element={<MethodologyPage />} />
```

---

### Task 5.6: Link visible a `/metodologia`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Agregar link en el header**

En el bloque header, agregar junto al link "← Inicio" o como tooltip en el hero:

```tsx
<Link
  to="/metodologia"
  className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors uppercase tracking-wider hidden sm:block"
>
  Metodologia
</Link>
```

---

## Fase 6 — Marca personal + polish (1 h)

### Task 6.1: Footer institucional

**Files:**
- Create: `src/components/Footer.tsx`

- [ ] **Step 1: Crear archivo**

```tsx
export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          CACREF &middot; Censo Socioeconomico y de Salud &middot; 2026
        </p>
        <p className="text-xs text-slate-400">
          Hecho por <span className="font-semibold text-slate-700">Y.D.</span>
          <span className="mx-2">·</span>
          <span>Metodologia abierta</span>
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Montar en App.tsx**

Modificar `src/App.tsx`. Después del cierre de `</main>`, agregar:

```tsx
<Footer />
```

E importar:

```tsx
import Footer from './components/Footer';
```

---

### Task 6.2: README de portafolio

**Files:**
- Modify: `README.md`

Reemplazar contenido completo con:

```markdown
# CACREF — Censo Socioeconomico y de Salud

Sistema de censo digital para identificar y priorizar necesidades de salud, situación socioeconómica y calidad de vida de trabajadores, afiliados y familiares de la Cooperativa CACREF (Federación Unitaria de Trabajadores del Petróleo, del Gas, sus Similares y Derivados de Venezuela).

## El problema

CACREF atiende a una población dispersa, con data histórica fragmentada y decisiones de apoyo que se tomaban caso a caso. No existía un canal estandarizado para levantar necesidades, ni una forma objetiva de priorizar.

## La solución

Formulario público de 4 pasos con scoring automático, workflow de estados (Registrado → En revisión → Comité → Resuelto/Descartado) y dashboard ejecutivo con visualizaciones, semáforo institucional, exportación PDF y reporte filtrable.

## Stack

- **Frontend:** React 19, Vite 6, Tailwind 4, motion, lucide-react
- **Visualización:** Recharts
- **PDF:** jsPDF + jspdf-autotable
- **Backend local:** Express + better-sqlite3
- **Backend deploy:** Netlify Functions + Turso/libSQL
- **Auth:** HMAC con cookie HttpOnly y rate limiting
- **Tipos:** TypeScript estricto

## Arquitectura

```
┌──────────────────┐                ┌──────────────────┐
│  Formulario      │  POST /census  │   API (Express   │
│  publico (4      │ ─────────────► │   o Netlify Fn)  │
│  pasos)          │                │                  │
└──────────────────┘                └────────┬─────────┘
                                            │
┌──────────────────┐  GET/PATCH /api/*       │
│  Admin           │ ◄────────────────────── ┤
│  Dashboard       │                        │
│  - Charts        │                        ▼
│  - Workflow      │                ┌──────────────────┐
│  - PDF           │                │  SQLite / Turso  │
│  - Filtros       │                │  (libSQL)        │
└──────────────────┘                └──────────────────┘
```

## Seguridad

- Cookies HttpOnly firmadas con HMAC SHA-256 (timing-safe)
- Login con rate limit (7 intentos / 15 min, bloqueo 20 min)
- Edge rate limit (160 req / 60 seg)
- Headers estrictos en Netlify Function (CSP, HSTS, X-Frame-Options)
- Validación de payloads tanto en backend local como en deploy

## Scripts

```bash
npm install
npm run dev          # servidor local en :3000
npm run build        # build de producción
npm run lint         # typecheck
npx tsx scripts/seed.ts --wipe --count=85  # poblar DB
```

## Variables de entorno

```bash
ADMIN_USER=admin
ADMIN_PASS=...
ADMIN_SESSION_SECRET=...
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

## Decisiones de diseño

- **4 pasos fijos** en el formulario público: reduce abandono y mantiene uniformidad.
- **Scoring administrativo, no médico**: el sistema prioriza, el comité decide.
- **Workflow de 5 estados**: refleja el flujo real del comité (revisión → comité → resuelto).
- **Visualizaciones primero**: la junta directiva ve la foto completa en 5 segundos.
- **PDF ejecutivo**: usable en presentaciones sin conexión.
- **Metodología abierta**: publicada en `/metodologia` para auditabilidad institucional.

## Métricas de impacto

- ~80 registros procesados en demostración
- ~5 estados de workflow visibles
- 4 categorías de recomendación
- 3 visualizaciones en dashboard
- 1 PDF ejecutivo descargable
- 100% lint + build verde

## Despliegue

```bash
npm run build
netlify deploy --prod
```

## Licencia

Uso interno CACREF. Metodología abierta para auditoría.
```

---

### Task 6.3: Caso de éxito (markdown)

**Files:**
- Create: `docs/CASO_EXITO_CACREF.md`

- [ ] **Step 1: Crear archivo**

```markdown
# CACREF — Caso de éxito

**Cliente:** CACREF (Cooperativa de Ahorro y Crédito de la FUTPV)
**Sector:** Energético / Cooperativa
**Fecha:** Julio 2026
**Alcance:** Censo socioeconómico y de salud — MVP institucional

## Antes

- Decisiones de apoyo caso a caso, sin línea base.
- Data dispersa entre formularios físicos, llamadas y planillas.
- Comité sin herramienta objetiva de priorización.
- Cero trazabilidad de quién vio qué caso.

## Después

- Formulario digital estandarizado en 4 pasos.
- 80+ registros con scoring automático en una sesión.
- Dashboard con semáforo institucional, charts y PDF ejecutivo.
- Workflow de 5 estados con bitácora de cambios.
- Página de metodología pública para auditoría.

## Capacidad desplegada

- Stack: React 19, Vite, Tailwind, Recharts, jsPDF, Express, SQLite/Turso.
- 3 visualizaciones en dashboard (recomendación, riesgo por gerencia, calidad de vida).
- Generación de PDF ejecutivo de 1 página con autoTable.
- Auth con HMAC y rate limit.
- Deploy dual: local (Express + SQLite) y producción (Netlify Functions + Turso).

## Decisiones clave

- **Scoring administrativo, no médico**: el sistema ordena la cola, el comité decide.
- **Workflow visible en cada fila**: cualquier administrador ve el estado de un caso sin navegar.
- **Metodología pública**: `/metodologia` documenta cómo se calcula, qué datos se usan y qué se decide.

## Próximos pasos sugeridos

- Carga de informes médicos (PDF) por registro.
- Notificaciones por email al cambiar de estado.
- Multi-role (capturista, comité, dirección).
- Migración a padrón real CACREF (vía API interna).
- Reportes trimestrales comparativos para junta directiva.
```

---

### Task 6.4: Smoke test end-to-end

- [ ] **Step 1: Verificar lint**

```bash
npm run lint
```

Expected: PASS sin errores.

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: EXIT 0.

- [ ] **Step 3: Iniciar servidor y probar**

```bash
npm run dev
```

En otra terminal:

```bash
# Login
curl -X POST http://localhost:3000/api/admin/login -H "Content-Type: application/json" -d '{"user":"admin","pass":"censo2025"}' -c cookies.txt

# Verificar sesión
curl -b cookies.txt http://localhost:3000/api/admin/me

# Ver submissions
curl -b cookies.txt "http://localhost:3000/api/admin/submissions?limit=2"

# Ver executive summary
curl -b cookies.txt http://localhost:3000/api/admin/executive-summary

# Cambiar estado del primer registro
curl -b cookies.txt -X PATCH http://localhost:3000/api/admin/submissions/1/status -H "Content-Type: application/json" -d '{"status":"EN_REVISION","note":"Smoke test"}'

# Ver historial
curl -b cookies.txt http://localhost:3000/api/admin/submissions/1/history
```

Expected: todos devuelven 200 con JSON válido.

- [ ] **Step 4: Verificar el formulario público**

Abrir `http://localhost:3000` en navegador, completar el formulario, verificar que llegue al dashboard.

- [ ] **Step 5: Verificar `/metodologia`

Abrir `http://localhost:3000/metodologia`, validar que carga.

- [ ] **Step 6: Verificar PDF**

En el dashboard, tab "Resumen Ejecutivo", click "PDF Ejecutivo". Verificar descarga.

---

## Cierre

Producto listo para demo. Acceptance criteria:

- [ ] Lint + build verde
- [ ] DB con 80+ registros
- [ ] 3 charts en dashboard
- [ ] Tab "Resumen Ejecutivo" funcional
- [ ] Workflow chips clickeables con persistencia
- [ ] PDF descargable
- [ ] `/metodologia` renderiza
- [ ] Footer con firma Y.D.
- [ ] README de portafolio
