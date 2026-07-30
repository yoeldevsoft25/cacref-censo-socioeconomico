# CACREF — Censo Socioeconomico y de Salud

Sistema institucional de censo digital para la Cooperativa de Ahorro y Credito de la Federacion Unitaria de Trabajadores del Petroleo, del Gas, sus Similares y Derivados de Venezuela (FUTPV).

Captura, prioriza y gestiona las necesidades de salud, situacion socioeconomica y calidad de vida de trabajadores, afiliados y familiares, con cumplimiento de la **Ley Organica de Proteccion de Datos Personales (LOPDP, 2021)** de Venezuela.

---

## El problema

CACREF atendia a una poblacion dispersa con data historica fragmentada. Las decisiones de apoyo se tomaban caso a caso, sin trazabilidad ni prioridad. La informacion sensible de salud llegaba incompleta, sin supervision etica ni cumplimiento normativo.

## La solucion

- **Formulario publico de 4 pasos** con scoring automatico, carga de archivos (cedula, recetas, informes) y consentimiento expreso LOPDP.
- **Workflow de 5 estados** (Registrado → En revision → Comite → Resuelto/Descartado) con historial inmutable.
- **Asignacion a miembros del comite** con SLA tracking y semaforo de vencimiento.
- **4 roles** con permisos diferenciados (capturista, vocal, presidente, director) y autenticacion con bcrypt.
- **Audit log inmutable** con IP, user agent, detalles — cumple con Art. 33 LOPDP.
- **Dashboard ejecutivo** con 3 charts, KPIs, semaforo institucional y export PDF.
- **Notificaciones in-app** (campanita con badge) + email via Resend.
- **Hilo de discusion por caso** estilo Linear/Slack.
- **Landing publica de transparencia** con metricas agregadas anonimas.
- **Pagina publica de privacidad** completa (12 secciones, marco legal venezolano).
- **Derechos ARCO del titular**: consulta, exportacion JSON, eliminacion con confirmacion.

## Stack

- **Frontend:** React 19, Vite 6, Tailwind 4, motion, lucide-react, recharts
- **PDF:** jsPDF + jspdf-autotable (cliente, sin servidor)
- **Backend local:** Express + better-sqlite3 + bcryptjs
- **Backend deploy:** Netlify Functions + Turso/libSQL
- **Auth:** HMAC SHA-256 con cookies HttpOnly + bcrypt cost 10
- **Email:** Resend (modo mock sin API key)

## Capturas de pantalla del flujo

```
/                   Formulario publico de 4 pasos
/admin              Login (4 usuarios con roles)
/admin              Dashboard operativo + tab Resumen Ejecutivo
/admin              Modal de detalle con timeline + comentarios + decision + archivos
/auditoria          Bitacora completa (solo director)
/consulta           Estado publico por cedula
/metodologia        Scoring y recomendaciones explicados
/privacidad         Politica de privacidad LOPDP (12 secciones)
/transparencia      Dashboard publico de metricas agregadas
```

## Credenciales de demo

Todas las cuentas tienen la misma clave hasheada con bcrypt: `censo2025`

| Usuario | Rol | Puede |
|---|---|---|
| `admin` | Director | Todo + audit log |
| `presidente` | Presidente del comite | Decisiones + reasignacion |
| `vocal` | Vocal del comite | Decisiones + cambios de estado |
| `capturista` | Capturista | Lectura + mover a EN_REVISION |

## Setup local

```bash
npm install
npx tsx scripts/seed.ts --wipe --count=85  # poblar con 85 registros realistas
npm run dev
```

Disponible en `http://localhost:7842`

### Generar hash de password

```bash
npx tsx scripts/hash-password.ts "nueva-clave-segura"
```

## Setup para Netlify (produccion)

1. Fork/clone del repo
2. Conectar a Netlify
3. Configurar variables de entorno (ver `.env.example`):
   - `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` (recomendado para produccion)
   - `ADMIN_PASS_HASH` (generado con el script arriba)
   - `PRES_PASS_HASH`, `VOCAL_PASS_HASH`, `CAPT_PASS_HASH`
   - `ADMIN_SESSION_SECRET` (generar con `crypto.randomBytes(48).toString('base64url')`)
   - `RESEND_API_KEY` (opcional, sin esto funciona en modo mock)
4. Deploy

## Compliance LOPDP

| Requisito LOPDP | Implementacion |
|---|---|
| Art. 5 — Datos sensibles | Doble checkbox de consentimiento expreso |
| Art. 6 — Informacion | Pagina `/privacidad` publica |
| Art. 12-15 — Consentimiento | Aceptacion verificable antes de enviar |
| Art. 23-28 — Derechos ARCO | Acceso (`/consulta`), Portabilidad (export JSON), Cancelacion (delete) |
| Art. 29-32 — Procedimiento ARCO | Confirmacion con token + plazo 15 dias |
| Art. 33-34 — Seguridad | Ver `SECURITY.md` (bcrypt, rate limit, headers, audit log) |
| Art. 35-40 — Responsable | CACREF identificado + DPO de contacto |
| Art. 41-44 — Transferencias | Ninguna fuera de Venezuela |
| Art. 45-48 — Conservacion | 5 anos (datos) + 10 anos (audit) |

Ver `COMPLIANCE.md` para detalle completo por articulo.

## Seguridad

Ver `SECURITY.md` para detalle tecnico completo. Resumen:

- **Auth:** bcrypt cost 10 (~30ms/verify)
- **Sesiones:** HMAC SHA-256, 8h TTL, 30 min idle timeout
- **Cookies:** HttpOnly + SameSite=Strict + Secure (prod)
- **Rate limiting:** login 5/15min, form 20/hr, export 5/hr, delete 3/hr
- **Headers:** HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **SQLi:** 100% queries parametrizadas
- **XSS:** React auto-escape, sin `dangerouslySetInnerHTML`
- **Uploads:** MIME + extension whitelist, nombres aleatorios
- **Audit log:** inmutable (solo INSERT)

## Arquitectura

```
┌──────────────────┐                ┌──────────────────┐
│  Form publico    │  POST /census  │   API (Express   │
│  (4 pasos)       │ ─────────────► │   o Netlify Fn)  │
└──────────────────┘                └────────┬─────────┘
                                            │
┌──────────────────┐  GET/PATCH /api/*       │
│  Admin           │ ◄────────────────────── ┤
│  Dashboard       │                        │
│  - Charts        │                        ▼
│  - Workflow      │                ┌──────────────────┐
│  - PDF           │                │  SQLite / Turso  │
│  - Audit log     │                │  (libSQL)        │
└──────────────────┘                └──────────────────┘
```

## Modelo de datos

```sql
-- censo_submissions: tabla principal
nombre_apellido, cedula (UNIQUE), telefono, correo
region_sede, vicepresidencia, direccion_ejecutiva
gerencia, unidad_operativa, cargo, anos_servicio
ingreso_individual, ingreso_familiar, capacidad_cuota
afiliado_cacref
requiere_medicamento_cronico, medicamento_detalle
requiere_cirugia, cirugia_detalle
familiar_requiere_asistencia, calidad_vida_escala (1-10)
score, score_seniority, score_payment_capacity
score_affordability, score_health_need, score_cooperative_bonus
affordability_ratio, suggested_max_quota
risk_level (BAJO/MEDIO/ALTO)
recommendation (APROBADO_PRIORIDAD_ALTA/CONDICIONAL/REQUIERE_COMITE/NO_ELEGIBLE)
priority_bucket (1-4)
workflow_status (REGISTRADO/EN_REVISION/COMITE/RESUELTO/DESCARTADO)
workflow_notes, workflow_updated_at
decision_tipo, decision_monto, decision_observaciones, decision_at
assigned_to
has_document
created_at

-- workflow_history: cada cambio de estado
-- submission_files: archivos adjuntos (cedula, recetas, informes)
-- case_comments: hilo de discusion del comite
-- audit_log: bitacora inmutable con IP y user agent
-- notifications: campanita in-app
```

## Decisiones de diseno

- **4 pasos fijos** en el formulario publico: reduce abandono, mantiene uniformidad
- **Scoring administrativo, no medico**: el sistema prioriza, el comite decide
- **Workflow de 5 estados**: refleja el flujo real del comite
- **Visualizaciones primero**: la junta directiva ve la foto completa en 5 segundos
- **PDF ejecutivo + PDF por caso**: usables en presentaciones e instancias individuales
- **Metodologia abierta**: `/metodologia` documenta como se calcula, que datos se usan
- **LOPDP primero**: privacidad y derechos ARCO como feature central, no como afterthought
- **Audit log inmutable**: trazabilidad legal completa, no como auditoria opcional
- **Anonimizacion en lugar de eliminacion fisica**: preserva integridad de los indices, cumple con LOPDP al perder PII

## Scripts

```bash
npm install
npm run dev          # servidor local en :7842
npm run build        # build de produccion
npm run lint         # typecheck

npx tsx scripts/seed.ts --wipe --count=85  # poblar DB
npx tsx scripts/hash-password.ts <password>  # generar hash bcrypt para usuario
```

## Variables de entorno

Ver `.env.example` para la lista completa. Minimo requerido para produccion:

```
ADMIN_PASS_HASH=<bcrypt-hash>
PRES_PASS_HASH=<bcrypt-hash>
VOCAL_PASS_HASH=<bcrypt-hash>
CAPT_PASS_HASH=<bcrypt-hash>
ADMIN_SESSION_SECRET=<48-bytes-base64url>
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
RESEND_API_KEY=re_...
```

## Tests

No incluidos en esta entrega. Validacion manual:
- Form publico: completar 4 pasos, verificar que scoring se aplica
- Login: 4 usuarios con 4 roles
- PATCH status: capturista no puede (403), vocal puede
- Audit log: director ve todos los eventos
- Export PDF: caso individual + ejecutivo
- Email: cambio de estado con `send_email: true` (mock sin API key)
- ARCO: export JSON, anonimizacion con token "ELIMINAR"

## Pendientes post-MVP (recomendado)

1. Cifrado en reposo de DB (Turso tier encriptado o LUKS)
2. 2FA para director (TOTP via otplib o speakeasy)
3. Integracion con firma electronica SUSCERTE
4. Conexion con SAIME para validacion automatica de cedula
5. Inscripcion ante la Superintendencia de Proteccion de Datos
6. Auditoria juridica formal del aviso de privacidad
7. Penetracion testing externo
8. Backup automatico cifrado y replicado geograficamente

## Documentacion

- `README.md` (este archivo) — overview y setup
- `SECURITY.md` — politica de seguridad tecnica detallada
- `COMPLIANCE.md` — cumplimiento LOPDP articulo por articulo
- `docs/CASO_EXITO_CACREF.md` — narrativa de caso de uso
- `docs/superpowers/specs/2026-07-25-cacref-wow-upgrade-design.md` — spec original
- `docs/superpowers/plans/2026-07-25-cacref-wow-upgrade.md` — plan de implementacion

## Licencia

Uso interno CACREF. Codigo propietario.
Metodologia de scoring y arquitectura abiertas para auditoria.

## Contacto

- **Tecnico:** dev@futpvcacref.com
- **Seguridad:** seguridad@futpvcacref.com
- **Proteccion de datos:** protecciondedatos@futpvcacref.com

---

**CACREF** — Censo Socioeconomico y de Salud — 2026
Hecho con metodologia abierta · Cumple LOPDP Venezuela 2021
