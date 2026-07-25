# Propuesta borrador — Censo Socioeconómico y de Salud CACREF

> Documento ejecutivo. Versión borrador para presentación al Jefe.
> Estado: MVP funcional en ventana de 2 horas.
> Fecha: 23 de junio de 2026.

---

## 1. Resumen ejecutivo (1 página)

**Problema.**
CACREF necesita una primera lectura objetiva de la situación socioeconómica y de salud de sus trabajadores, afiliados y familiares directos. Hoy no existe un canal estandarizado ni una base única que permita priorizar apoyos, medicamentos crónicos, procedimientos quirúrgicos o asistencia familiar. Las decisiones se toman caso a caso y la información llega incompleta.

**Solución propuesta.**
Un censo digital, anónimo en su manejo interno y de autollenado, dividido en cuatro pasos:

1. Datos personales
2. Vinculación institucional con CACREF
3. Situación socioeconómica
4. Salud y calidad de vida

El registro alimenta automáticamente un tablero administrativo con un puntaje de priorización y una recomendación administrativa. **No es una evaluación médica.** Es una herramienta de diagnóstico y priorización institucional.

**¿Qué decisión habilita?**
Priorizar con base en evidencia quién requiere atención más urgente en medicamento crónico, cirugía, asistencia familiar o apoyo socioeconómico, y reportar agregados por gerencia y unidad operativa.

**Alcance del MVP.**
Formulario público funcional, persistencia en base de datos local y/o Turso, dashboard administrativo con filtros, scoring automático y vista de detalle. Salida de demo en 2 horas.

**Lo que NO es este MVP.**
No es historia clínica. No es aprobación automática de beneficios. No sustituye evaluación médica. No reemplaza entrevistas personales.

---

## 2. Población objetivo

- Trabajadores activos de la organización.
- Afiliados CACREF.
- Familiares directos de ambos, cuando la consulta los involucre (sección específica en el formulario, no como sujeto principal separado).

---

## 3. Datos que se recolectan

### Personales
- Nombre y apellido
- Cédula de identidad
- Teléfono celular
- Correo electrónico

### Vinculación institucional
- ¿Es afiliado activo a CACREF?
- Vicepresidencia
- Dirección ejecutiva
- Gerencia
- Unidad operativa
- Cargo actual
- Años de servicio

### Situación socioeconómica
- Ingreso individual mensual
- Ingreso familiar mensual
- Capacidad estimada de aporte mensual (cuota CACREF)

### Salud y calidad de vida
- ¿Requiere medicamento crónico?
- Detalle del medicamento o condición
- ¿Requiere cirugía o procedimiento?
- Detalle del procedimiento
- ¿Algún familiar directo requiere asistencia médica o apoyo?
- Autoevaluación de calidad de vida, escala 1–10

### Calculados (no se preguntan, los produce el sistema)
- Puntaje total y desglose: antigüedad, capacidad de pago, asequibilidad, necesidad de salud, plus cooperativo.
- Ratio de asequibilidad.
- Cuota máxima sugerida.
- **Nivel de riesgo:** BAJO / MEDIO / ALTO.
- **Recomendación administrativa:** APROBADO_PRIORIDAD_ALTA / APROBADO_CONDICIONAL / REQUIERE_COMITÉ / NO_ELEGIBLE.
- Prioridad numérica para ordenar la cola.

---

## 4. Tablero de priorización

El dashboard administrativo entrega, por registro:

- Datos básicos del censado.
- Nivel de riesgo (BAJO / MEDIO / ALTO) y color asociado.
- Recomendación administrativa y prioridad numérica.
- Filtros: gerencia, ingreso, recomendación, riesgo.
- Vista de detalle con todos los campos capturados.

Interpretación obligatoria: **el puntaje es administrativo**. Es un orden de atención, no un diagnóstico ni una aprobación de beneficio. La decisión final sigue siendo humana, institucional y, cuando aplique, de comité.

---

## 5. Privacidad y manejo de datos sensibles

Los datos recolectados incluyen **datos sensibles** (salud, condición económica detallada, identificación personal). Por eso el MVP incorpora, desde el día uno:

- **Aviso de privacidad** mostrado antes y durante el formulario, en lenguaje simple.
- **Acceso restringido al dashboard**: solo personal autorizado, autenticado.
- **No se pide historia clínica completa**: solo lo mínimo para priorizar.
- **Persistencia cifrada en tránsito** (HTTPS en deploy).
- **Base de datos con acceso interno**: Turso/libSQL en deploy, SQLite local en desarrollo.
- **No se comparte con terceros** en el MVP.
- **Retención**: indefinida por ahora; pendiente definir política de retención en fase post-MVP.

Texto de aviso sugerido, ya integrado en el formulario:

> La información suministrada será utilizada por CACREF únicamente para fines de diagnóstico socioeconómico, identificación de necesidades de salud y priorización interna de apoyo. Este formulario no sustituye una evaluación médica ni constituye aprobación automática de beneficios. Los datos sensibles serán tratados con acceso restringido.

---

## 6. Entregables ya construidos en la ventana de 2 horas

- Formulario público "Censo Socioeconómico y Salud CACREF" en 4 pasos.
- Persistencia con `POST /api/census` validada.
- Scoring y recomendación automáticos.
- Dashboard administrativo con listado, filtros y detalle.
- Texto de propuesta (este documento).
- Matriz de preguntas del formulario (`PREGUNTAS_CENSO_SOCIOECONOMICO_CACREF.md`).
- Aviso de privacidad visible en el formulario.

---

## 7. Siguientes pasos (post-MVP)

Ordenados por valor y dependencia:

1. **Validación jurídica del aviso de datos sensibles** con el área legal de CACREF.
2. **Definir responsables internos** con acceso al dashboard y bitácora de accesos.
3. **Reporte agregado por gerencia y unidad** para junta directiva.
4. **Exportación CSV/PDF** real de los registros.
5. **Soporte documental opcional** (receta, informe, referencia) en una segunda iteración.
6. **Integración futura** con inventario de medicamentos y red de proveedores de salud.
7. **Auditoría de accesos administrativos** y revisión periódica de permisos.

---

## 8. Riesgos identificados y mitigación

| Riesgo | Mitigación |
|---|---|
| Manejo de datos sensibles de salud | Aviso claro, acceso admin protegido, no se pide historia clínica |
| Formulario percibido como largo | 4 pasos, solo lo mínimo para priorizar |
| Discrepancia backend local vs deploy | Alineación explícita entre `server.ts` y `netlify/functions/api.ts` |
| Scoring malinterpretado como decisión médica | Etiqueta visible de "priorización administrativa" en el dashboard |
| Demo sin datos | 2 registros de prueba precargados |
| Cumplimiento regulatorio venezolano (Ley de Protección de Datos) | Pendiente: revisión jurídica formal antes de campaña masiva |

---

## 9. Mensaje corto para presentar al Jefe

### Versión WhatsApp / correo (lista para enviar)

> Jefe, preparamos un borrador funcional de censo socioeconómico y de salud para trabajadores, afiliados CACREF y familiares.
>
> El objetivo es levantar información básica de situación económica, medicamentos crónicos, cirugías pendientes y calidad de vida, para priorizar casos y construir una base inicial de decisión.
>
> El MVP ya contempla: formulario, almacenamiento y tablero administrativo con riesgo y recomendación.
>
> **No sustituye evaluación médica**; es una herramienta de diagnóstico y priorización institucional.
>
> Quedo atento para mostrárselo cuando me indique.

### Versión de 30 segundos (si lo explica en persona)

> Es un censo digital para trabajadores y afiliados CACREF. Recoge en cuatro pasos: datos personales, vínculo institucional, situación económica y salud. El sistema calcula un puntaje administrativo y ordena los registros por prioridad. Sirve para que el comité tenga una primera lectura objetiva de dónde concentrar la ayuda. No es historia clínica y no aprueba beneficios. Esa decisión sigue siendo del comité.

---

## 10. Preguntas abiertas para el Jefe

1. ¿La unidad de análisis serán **personas individuales** o **núcleos familiares** como una sola unidad de registro?
2. ¿La cuota CACREF actual es **proporcional al ingreso** o un valor fijo por afiliado? Necesitamos esto para calibrar el scoring.
3. ¿La campaña de censo será **interna y voluntaria** o tendremos obligación contractual de responder?
4. ¿Qué **ventana de tiempo** manejamos para la primera campaña? (Esto impacta el plan de despliegue.)
5. ¿Quién es el **responsable del área jurídica** que validará el aviso de datos sensibles?
6. ¿El dashboard debe ser **visible para todas las gerencias** o restringido a presidencia y comité?
7. ¿Necesitamos **integración** con el sistema de nómina o con el padrón de afiliados CACREF, o arrancamos con censo manual?

---

## 11. Criterios de cierre del MVP

- [x] Formulario reorientado a censo socioeconómico y salud.
- [x] Payload del formulario coincide con backend.
- [x] Registro se guarda correctamente.
- [x] Dashboard muestra priorización y riesgo.
- [x] Netlify Function alineada con el esquema de salud.
- [x] Validación local ejecutada (`npm run lint` y `npm run build`).
- [x] Propuesta ejecutiva creada (este documento).
- [x] Matriz de preguntas creada.
- [x] URL local o deploy lista para demo.

---

*Documento preparado para presentación interna. No divulgar fuera de CACREF sin aprobación.*
