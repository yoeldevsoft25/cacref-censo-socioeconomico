# Diseño — Upgrade "wow" CACREF Censo Socioeconómico y Salud

**Fecha:** 2026-07-25
**Ventana de entrega:** Hoy (un día)
**Autor (placeholder):** Y.D.
**Estado:** Aprobado para implementación

---

## 1. Contexto

CACREF (Cooperativa de Ahorro y Crédito de la Federación Unitaria de Trabajadores del Petróleo, del Gas, sus Similares y Derivados de Venezuela) requiere un sistema de censo socioeconómico y de salud para trabajadores, afiliados y familiares. El proyecto existe como MVP funcional con formulario público de 4 pasos, scoring automático y dashboard con priorización.

**Situación:** El MVP se presenta HOY a través de un aval personal (familiar del solicitante, ex-VP de PDVSA Gas) ante el jefe de la cooperativa, con el objetivo de conseguir un puesto. Simultáneamente, el sistema se concibe como pieza de portafolio para futuras oportunidades con corporaciones venezolanas.

**Restricción crítica:** Una sesión de trabajo. Cada minuto cuenta. El efecto wow debe ser visible a los 30 segundos de demo y la profundidad técnica debe sostenerse a los 5 minutos de revisión.

---

## 2. Goals (lo que SÍ entra)

| # | Capacidad | Criterio de éxito |
|---|---|---|
| G1 | Workflow de estados en cada registro | Cambiar estado haciendo click en el chip, persiste, queda en historial |
| G2 | Visualización con datos en el dashboard | 3 charts renderizan con seed data sin flicker ni estado vacío |
| G3 | Tab "Resumen Ejecutivo" para la junta | KPIs principales + semáforo de decision readiness |
| G4 | PDF ejecutivo imprimible | 1 página, header con branding, semáforo, top críticos, fecha |
| G5 | Página `/metodologia` pública | Scoring explicado, decisiones que habilita, manejo de datos sensibles |
| G6 | Seed data con historia | 80+ registros con gerencias, cargos, variabilidad de salud realista |
| G7 | Firma personal discreta | Iniciales en footer + frase de metodología |
| G8 | README como case study | Arquitectura, decisiones, métricas, cómo se mide, deploy |

---

## 3. Non-Goals (lo que NO entra)

- Audit log detallado de accesos (queda solo workflow_history simple)
- Multi-role (admin, capturista, comité) — todos los admins son iguales
- Tests automatizados (validación manual al final)
- Migración de sistemas legacy
- Integración con nómina o padrón de afiliados
- Carga de informes médicos
- Firma digital formal
- Notificaciones email/WhatsApp
- Análisis de IA sobre datos capturados (aunque `@google/genai` está instalado, no se usa en esta entrega)

---

## 4. Arquitectura

### 4.1 Stack

**Se añade:**
- `recharts` — charts declarativos React (~30KB gzip)
- `jspdf` + `jspdf-autotable` — PDF cliente-side, sin servidor

**Se mantiene:**
- `react`, `react-dom`, `react-router-dom`
- `tailwindcss` v4 + `@tailwindcss/vite`
- `motion` (animaciones)
- `lucide-react` (iconos)
- `vite` + `tsx`
- `better-sqlite3` (local) / `@libsql/client` (deploy Turso)
- `express` (servidor local)

### 4.2 Estructura de carpetas (cambios)

```
src/
├── components/
│   ├── AdminDashboard.tsx          (refactor: tabla + charts + tab ejecutivo)
│   ├── AdminLogin.tsx              (sin cambios)
│   ├── CensusForm.tsx              (sin cambios)
│   ├── Hero.tsx                    (sin cambios)
│   ├── Charts/
│   │   ├── RecommendationPie.tsx   (nuevo)
│   │   ├── GerenciaBar.tsx         (nuevo)
│   │   └── QualityOfLifeHistogram.tsx (nuevo)
│   ├── ExecutiveSummary.tsx        (nuevo)
│   ├── WorkflowStatusControl.tsx   (nuevo)
│   ├── PdfExportButton.tsx         (nuevo)
│   ├── MethodologyPage.tsx         (nuevo)
│   └── Footer.tsx                  (nuevo)
├── lib/
│   ├── pdf.ts                      (nuevo, generación PDF)
│   ├── seedData.ts                 (nuevo, generador de registros)
│   └── format.ts                   (nuevo, helpers de formato)
└── App.tsx                         (refactor: nueva ruta /metodologia)
```

### 4.3 Flujo de datos

```
[Form público] → POST /api/census → DB → scoring automático
                                              ↓
[Admin Dashboard] → GET /api/admin/submissions → DB
                → GET /api/admin/insights → DB agregados
                → GET /api/admin/executive-summary → DB agregados ricos
                → PATCH /api/admin/submissions/:id/status → DB + workflow_history
                → GET /api/admin/submissions/:id/history → DB
```

---

## 5. Modelo de datos

### 5.1 Tabla `census_submissions` (cambios)

Se agregan 3 columnas (con migración idempotente vía `ensureColumn`):

```sql
workflow_status TEXT NOT NULL DEFAULT 'REGISTRADO'
workflow_notes TEXT
workflow_updated_at DATETIME
```

**Estados posibles:**
- `REGISTRADO` — recién llegado (default)
- `EN_REVISION` — capturista/admin lo está mirando
- `COMITE` — derivado al comité de evaluación
- `RESUELTO` — caso cerrado con decisión final
- `DESCARTADO` — no procede (data inválida, duplicado, etc.)

### 5.2 Tabla nueva `workflow_history`

```sql
CREATE TABLE workflow_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES census_submissions(id)
);
CREATE INDEX idx_history_submission ON workflow_history(submission_id, changed_at);
```

### 5.3 Índices adicionales

```sql
CREATE INDEX idx_census_workflow_status ON census_submissions(workflow_status);
CREATE INDEX idx_census_priority_score ON census_submissions(priority_bucket, score DESC);
```

---

## 6. API surface

### 6.1 Endpoints nuevos

| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| PATCH | `/api/admin/submissions/:id/status` | admin | Cambiar estado, escribe workflow_history |
| GET | `/api/admin/submissions/:id/history` | admin | Devuelve historial del registro |
| GET | `/api/admin/executive-summary` | admin | Agregados para PDF y resumen |

### 6.2 `PATCH /api/admin/submissions/:id/status`

**Body:**
```json
{ "status": "EN_REVISION", "note": "Llamar al afiliado para confirmar cirugía" }
```

**Validación:**
- `status` debe ser uno de los 5 estados válidos
- `note` opcional, máximo 500 caracteres
- Devuelve 200 con el historial actualizado

**Errores:**
- 400: estado inválido
- 404: id no existe
- 401: no autenticado

### 6.3 `GET /api/admin/submissions/:id/history`

**Response:**
```json
[
  { "from_status": null, "to_status": "REGISTRADO", "note": null, "changed_at": "..." },
  { "from_status": "REGISTRADO", "to_status": "EN_REVISION", "note": "Llamar...", "changed_at": "..." }
]
```

### 6.4 `GET /api/admin/executive-summary`

**Response:**
```json
{
  "total": 80,
  "por_estado": { "REGISTRADO": 30, "EN_REVISION": 20, "COMITE": 15, "RESUELTO": 10, "DESCARTADO": 5 },
  "por_recomendacion": { "APROBADO_PRIORIDAD_ALTA": 12, "APROBADO_CONDICIONAL": 25, ... },
  "top_gerencias_criticas": [{ "gerencia": "Refinación", "ALTO": 5, "MEDIO": 8 }, ...],
  "calidad_vida_promedio": 5.4,
  "score_promedio": 62.3,
  "total_con_medicamento_cronico": 35,
  "total_con_cirugia": 18,
  "total_con_familiar_asistencia": 22,
  "ratio_cuota_ingreso_promedio": 0.28,
  "fecha_generacion": "2026-07-25T..."
}
```

---

## 7. UI / Componentes

### 7.1 AdminDashboard (refactor)

**Estructura nueva:**
1. Header con título + botón PDF ejecutivo
2. Fila de 4 KPIs (registros, prioridad alta, medicamentos, cirugías) — igual
3. Tab "Operativo" (default): tabla + filtros — igual
4. Tab nuevo "Resumen Ejecutivo": grid de KPIs + semáforo + 3 charts
5. Tab mantenido por defecto: charts primero, tabla después

**Fila de tabla cambia:**
- Nueva columna "Estado" con chip clickeable que abre mini-popover para cambiar
- Click en chip → popover con 5 opciones + textarea para nota

### 7.2 Charts (Recharts)

**RecommendationPie** — Pie chart con colores:
- Verde: APROBADO_PRIORIDAD_ALTA
- Azul: APROBADO_CONDICIONAL
- Amarillo: REQUIERE_COMITE
- Rojo: NO_ELEGIBLE

**GerenciaBar** — Bar chart horizontal, top 8 gerencias con más casos. Cada barra segmentada por nivel de riesgo (BAJO/MEDIO/ALTO).

**QualityOfLifeHistogram** — Bar chart, distribución de 1-10 en el eje X, count en Y.

**Responsive:** containers se ajustan, altura fija 280px en desktop, 220px en móvil.

### 7.3 WorkflowStatusControl

**Componente:**
```tsx
<WorkflowStatusControl submissionId={sub.id} status={sub.workflow_status} onChange={refetch} />
```

**Visual:**
- Chip con color según estado (gris/azul/amber/verde/rojo)
- Click → popover con 5 botones + textarea + botón "Confirmar"
- Al confirmar: PATCH + refetch + animación de cambio

### 7.4 ExecutiveSummary

**Layout:**
- Grid 2x2 de tarjetas grandes con número grande + label + sparkline
- Semáforo institucional: verde si `RESUELTO/total > 0.5`, amarillo si `EN_REVISION/total > 0.3`, rojo si `REGISTRADO/total > 0.6`
- 3 charts abajo
- Botón "Descargar PDF" al fondo

### 7.5 PdfExportButton

**Comportamiento:**
- Click → llama `/api/admin/executive-summary`
- Genera PDF client-side con `jspdf` + `jspdf-autotable`
- Contenido: header CACREF, fecha, semáforo, KPIs, tabla top 10 críticos
- Descarga como `censo-ejecutivo-2026-07-25.pdf`

### 7.6 MethodologyPage (ruta `/metodologia`)

**Contenido:**
1. Hero corto: "Cómo evaluamos"
2. Sección "El scoring" — tabla con los 5 componentes (antigüedad, capacidad pago, asequibilidad, salud, plus cooperativo) y sus pesos
3. Sección "Riesgo" — explicación de los 3 niveles
4. Sección "Recomendación" — los 4 buckets y cuándo aplica cada uno
5. Sección "Manejo de datos sensibles" — qué hacemos, qué NO hacemos
6. Sección "Decisiones que habilita" — 4 bullets concretos
7. Footer institucional

### 7.7 Footer

**Visible en toda la app:**
- Línea izquierda: "CACREF · Censo Socioeconómico y Salud · 2026"
- Línea derecha: "Hecho por Y.D. · Metodología abierta"

---

## 8. Seed data

### 8.1 Generador (`src/lib/seedData.ts`)

**Función:** `generateSeedSubmissions(count: number): CensusInput[]`

**Gerencias (10):**
- Refinación
- Producción
- Exploración
- Comercialización
- Gas
- Logística y Transporte
- Mantenimiento
- Seguridad Industrial
- Recursos Humanos
- Tecnología e Información

**Cargos (rotación):** Operador, Supervisor, Técnico, Analista, Especialista, Coordinador, Gerente, Jefe de Unidad, Profesional Asociado, Asistente Administrativo.

**Patrón de variabilidad intencional:**
- 35% con medicamento crónico (detalles variados: hipertensión, diabetes, asma, cáncer, etc.)
- 18% con cirugía pendiente
- 22% con familiar asistencia
- Distribución de calidad de vida sesgada a la izquierda (media ~5)
- Ingresos individuales en USD: 200-3500
- Algunos `REGISTRADO` con score alto (casos listos para aprobar)
- Algunos `DESCARTADO` con data inválida (demuestra el uso del estado)

### 8.2 Script (`scripts/seed.ts`)

```bash
npx tsx scripts/seed.ts [--count=80] [--wipe]
```

- `--wipe` borra tabla antes
- Sin `--wipe` agrega a existentes
- Genera workflow_history inicial para cada uno (1 entrada: null → REGISTRADO)

### 8.3 Datos sembrados manualmente

- 1 registro "destacado" para que el boss lo vea primero al abrir el dashboard — score 90, recomendación PRIORIDAD_ALTA, status COMITE, con todos los detalles de salud marcados (ej: "Juan Pérez, Refinación, requiere cirugía cardíaca, medicamento crónico, familiar con asistencia, calidad de vida 2/10").
- 1 registro "no elegible" para mostrar el extremo inferior.

---

## 9. Fases de implementación

### Fase 1 — Foundation (1.5 h)

**Tareas:**
1. `npm install recharts jspdf jspdf-autotable`
2. `src/lib/format.ts` — helpers (formatMoney, formatDate, etc.)
3. `server.ts` — agregar columnas, tabla workflow_history, índices, init/ensureColumn
4. `netlify/functions/api.ts` — mismas adiciones
5. Endpoints nuevos en ambos backends
6. `npm run lint` y `npm run build` pasan

**Definición de hecho:** schema actualizado, 3 endpoints responden correctamente con `curl`/fetch manual.

### Fase 2 — Seed data (30 min)

**Tareas:**
1. `src/lib/seedData.ts` — generador
2. `scripts/seed.ts` — runner
3. Ejecutar `npx tsx scripts/seed.ts --wipe`
4. Verificar conteo en DB y que los charts tengan variabilidad

**Definición de hecho:** DB tiene 80+ registros, distribución por recomendación cubre las 4 categorías, hay variabilidad en calidad de vida.

### Fase 3 — Dashboard charts (1 h)

**Tareas:**
1. `src/components/Charts/RecommendationPie.tsx`
2. `src/components/Charts/GerenciaBar.tsx`
3. `src/components/Charts/QualityOfLifeHistogram.tsx`
4. Integrar en `AdminDashboard.tsx` arriba de la tabla
5. Cargar datos desde `/api/admin/insights` (extender endpoint si hace falta)

**Definición de hecho:** 3 charts renderizan, son responsive, no rompen la tabla.

### Fase 4 — Workflow + ejecutivo (1.5 h)

**Tareas:**
1. `src/components/WorkflowStatusControl.tsx` con popover
2. Columna "Estado" en tabla con chip clickeable
3. `src/components/ExecutiveSummary.tsx` con KPIs + semáforo
4. Tab nuevo en AdminDashboard
5. Endpoint `/api/admin/executive-summary` consumido

**Definición de hecho:** Click en chip cambia estado, persiste, aparece en historial; tab ejecutivo muestra KPIs reales.

### Fase 5 — PDF + metodología (1 h)

**Tareas:**
1. `src/lib/pdf.ts` — generador PDF con jspdf
2. `src/components/PdfExportButton.tsx`
3. `src/components/MethodologyPage.tsx`
4. Ruta `/metodologia` en App.tsx
5. Link en footer/nav

**Definición de hecho:** Botón PDF genera archivo descargable; `/metodologia` renderiza correctamente.

### Fase 6 — Marca personal + polish (1 h)

**Tareas:**
1. `src/components/Footer.tsx` con firma Y.D.
2. Footer en App.tsx
3. `README.md` reescrito como case study
4. `docs/CASO_EXITO_CACREF.md` (opcional, 1 página)
5. Smoke test completo: lint + build + flujo end-to-end

**Definición de hecho:** README actualizado, footer visible, lint y build pasan, demo end-to-end funcional.

---

## 10. Acceptance criteria

Producto se considera "wow listo" cuando:

- [ ] `npm run lint` pasa sin errores
- [ ] `npm run build` pasa sin errores
- [ ] DB tiene 80+ registros con variabilidad
- [ ] Formulario público envía y recibe confirmación
- [ ] Dashboard muestra 3 charts con datos
- [ ] Tab "Resumen Ejecutivo" muestra KPIs reales y semáforo
- [ ] Click en chip de estado abre popover y permite cambiar
- [ ] Cambio de estado persiste y aparece en historial
- [ ] PDF ejecutivo se descarga y abre correctamente
- [ ] `/metodologia` renderiza con scoring y manejo de datos explicado
- [ ] Footer con firma visible en toda la app
- [ ] Flujo end-to-end funciona en local sin errores

**Fuera de acceptance (no requerido hoy):**
- Animaciones avanzadas más allá de las existentes
- Tests automatizados
- Deploy real a Netlify (se puede hacer pero no es requisito)
- Mobile perfecto en todos los breakpoints (debe ser usable, no perfecto)

---

## 11. Riesgos del diseño

| Riesgo | Mitigación |
|---|---|
| Recharts tarde en renderizar con 80 registros | Usar ResponsiveContainer, datos pre-agregados del backend |
| PDF incompleto por límite de jspdf | Limitar a 1 página, máximo 10 filas críticas, autoTable con page break |
| jspdf no soporte bien caracteres acentuados | Usar `setLanguage('es')` o configurar font que soporte UTF-8 |
| Workflow breaking change en DB existente | Migración idempotente con `ensureColumn`, default `'REGISTRADO'` |
| Tiempo se extienda | Fases 1-3 son obligatorias (no negociables); 4-6 pueden ajustarse |

---

## 12. Orden de ejecución final

```
Fase 1 (Foundation) → Fase 2 (Seed) → Fase 3 (Charts) → Fase 4 (Workflow+Ejecutivo) → Fase 5 (PDF+Metodología) → Fase 6 (Marca+Polish)
```

Cada fase debe cerrar con `npm run lint` + `npm run build` verde antes de seguir.

---

## 13. Mensaje final

El objetivo no es features. Es **transmitir en 30 segundos**:

> "Esto es un producto vivo, entiende cómo funciona una cooperativa, y la junta directiva puede tomar decisiones con la data que sale aquí."

Si eso se siente al usarlo, el objetivo está cumplido.
