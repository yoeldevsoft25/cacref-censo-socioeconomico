# CACREF — Caso de exito

**Cliente:** CACREF (Cooperativa de Ahorro y Credito de la FUTPV)
**Sector:** Energetico / Cooperativa
**Fecha:** Julio 2026
**Alcance:** Censo socioeconomico y de salud — MVP institucional

## Antes

- Decisiones de apoyo caso a caso, sin linea base.
- Data dispersa entre formularios fisicos, llamadas y planillas.
- Comite sin herramienta objetiva de priorizacion.
- Cero trazabilidad de quien vio que caso.

## Despues

- Formulario digital estandarizado en 4 pasos.
- 85+ registros con scoring automatico en una sesion.
- Dashboard con semaforo institucional, charts y PDF ejecutivo.
- Workflow de 5 estados con bitacora de cambios.
- Pagina de metodologia publica para auditoria.

## Capacidad desplegada

- Stack: React 19, Vite, Tailwind, Recharts, jsPDF, Express, SQLite/Turso.
- 3 visualizaciones en dashboard (recomendacion, riesgo por gerencia, calidad de vida).
- Generacion de PDF ejecutivo de 1 pagina con autoTable.
- Auth con HMAC y rate limit.
- Deploy dual: local (Express + SQLite) y produccion (Netlify Functions + Turso).

## Decisiones clave

- **Scoring administrativo, no medico**: el sistema ordena la cola, el comite decide.
- **Workflow visible en cada fila**: cualquier administrador ve el estado de un caso sin navegar.
- **Metodologia publica**: `/metodologia` documenta como se calcula, que datos se usan y que se decide.

## Proximos pasos sugeridos

- Carga de informes medicos (PDF) por registro.
- Notificaciones por email al cambiar de estado.
- Multi-role (capturista, comite, direccion).
- Migracion a padron real CACREF (via API interna).
- Reportes trimestrales comparativos para junta directiva.
