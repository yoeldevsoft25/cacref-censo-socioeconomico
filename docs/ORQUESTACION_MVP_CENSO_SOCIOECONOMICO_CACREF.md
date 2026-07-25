# Orquestacion MVP - Censo Socioeconomico y Salud CACREF

Fecha: 23 de junio de 2026  
Ventana objetivo: 2 horas  
Meta de presentacion: borrador funcional y propuesta para mostrar al jefe hoy

## 1. Contexto ejecutivo

Solicitud original:

> "Me puedes ayudar con un enlace como el de los vehiculos para un censo socioeconomico? Creo que ese mismo lo puedes modificar para saber si los trabajadores o afiliados a CACREF y sus familiares requieren medicamento de cronocismo o cirugia, medir como esta su calidad de vida. Cuando puedas. Me gustaria mostrarle por lo menos el borrador de la propuesta al Jefe hoy."

Interpretacion operativa:

Crear un MVP basado en la app actual del censo de vehiculos, pero reorientado a un censo socioeconomico y de salud para trabajadores, afiliados CACREF y familiares. El MVP debe permitir levantar datos, identificar necesidades de medicamentos cronicos o cirugias, medir calidad de vida y entregar al area directiva una vista inicial de priorizacion.

## 2. Resultado esperado del MVP

Al finalizar la ventana de 2 horas debe existir:

1. Un enlace o app local/deployable con formulario publico.
2. Un flujo de registro para trabajadores o afiliados CACREF.
3. Campos de salud y calidad de vida incluidos en el formulario.
4. Persistencia de respuestas en la base de datos existente.
5. Dashboard administrativo con listado, filtros y priorizacion basica.
6. Texto de propuesta listo para presentar: objetivo, alcance, datos capturados, beneficios y siguientes pasos.

## 3. Estado actual del proyecto

Stack detectado:

- Frontend: React 19, Vite 6, Tailwind, Motion, lucide-react.
- Backend local: Express en `server.ts`.
- Persistencia local: SQLite con `better-sqlite3` en `census.db`.
- Persistencia deploy: Turso/libSQL por variables `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
- Deploy preparado: Netlify Functions en `netlify/functions/api.ts`.

Hallazgos relevantes:

- `server.ts` ya tiene modelo y scoring para salud:
  - `requiere_medicamento_cronico`
  - `medicamento_detalle`
  - `requiere_cirugia`
  - `cirugia_detalle`
  - `familiar_requiere_asistencia`
  - `calidad_vida_escala`
  - `risk_level`
  - `recommendation`
  - `priority_bucket`
- `src/components/CensusForm.tsx` todavia esta orientado a vehiculos.
- `src/components/AdminDashboard.tsx` todavia muestra secciones de vehiculos.
- `netlify/functions/api.ts` todavia conserva el modelo de vehiculos para produccion.

Conclusion tecnica:

El MVP se puede cerrar rapido si se alinea el frontend y la funcion de Netlify con el modelo de salud que ya existe en `server.ts`.

## 4. Alcance funcional MVP

### Incluido

- Formulario publico "Censo Socioeconomico y Salud CACREF".
- Datos personales:
  - nombre y apellido
  - cedula
  - telefono
  - correo
- Datos de vinculacion:
  - trabajador o afiliado CACREF
  - vicepresidencia
  - direccion ejecutiva
  - gerencia
  - unidad operativa
  - cargo
  - anos de servicio
- Capacidad socioeconomica:
  - ingreso individual
  - ingreso familiar
  - capacidad de aporte/cuota estimada
- Necesidad de salud:
  - requiere medicamento cronico
  - detalle del medicamento o condicion
  - requiere cirugia
  - detalle de cirugia o procedimiento
  - familiar requiere asistencia
  - escala de calidad de vida del 1 al 10
- Evaluacion automatica:
  - score total
  - nivel de riesgo: bajo, medio, alto
  - recomendacion: prioridad alta, condicional, comite, no elegible
- Dashboard admin:
  - listado de registros
  - filtros por gerencia, ingreso, recomendacion y riesgo
  - detalle completo del registro

### No incluido en MVP de 2 horas

- Historia clinica completa.
- Carga de informes medicos.
- Verificacion documental.
- Integracion con inventario real de medicamentos.
- Gestion de citas medicas.
- Firma digital formal.
- Automatizacion de aprobaciones.

## 5. Criterios de aceptacion

El MVP se considera listo para demo cuando:

1. La pagina inicial ya no comunica vehiculos como proposito principal.
2. El formulario captura las variables de salud y calidad de vida.
3. El envio `POST /api/census` guarda un registro sin errores.
4. El dashboard admin muestra esos campos o, como minimo, muestra riesgo, recomendacion y detalle suficiente para priorizar.
5. La version local compila con `npm run build` o al menos pasa `npm run lint`.
6. Existe un texto breve de propuesta para explicar al jefe:
   - para que sirve
   - a quienes censara
   - que decision facilita
   - que datos sensibles se manejan con cuidado

## 6. Orquestacion por agentes

### Codex

Responsabilidad principal: implementacion tecnica, integracion y verificacion.

Archivos objetivo:

- `src/components/CensusForm.tsx`
- `src/components/AdminDashboard.tsx`
- `src/components/Hero.tsx`
- `server.ts`
- `netlify/functions/api.ts`
- `README.md`

Tareas:

1. Cambiar copy y flujo del formulario de vehiculos a socioeconomico/salud.
2. Enviar payload compatible con `server.ts`.
3. Actualizar dashboard para mostrar salud, calidad de vida y prioridad.
4. Alinear `netlify/functions/api.ts` con el esquema de salud si el deploy Netlify se usara hoy.
5. Ejecutar `npm run lint` y `npm run build`.
6. Levantar servidor local y entregar URL.

Prompt sugerido:

```text
Revisa el repo CACREF-SALUD y convierte el censo de vehiculos en un MVP de censo socioeconomico y salud CACREF. Alinea el formulario, dashboard y Netlify function con el modelo de salud ya presente en server.ts. Mantén el scope de 2 horas, verifica con npm run lint/build y deja una nota breve de cambios.
```

### Antigravity

Responsabilidad principal: experiencia de usuario, copy visual y prueba manual.

Archivos objetivo:

- `src/components/Hero.tsx`
- `src/components/CensusForm.tsx`
- `src/index.css`
- `public/*` solo si hace falta ajustar branding

Tareas:

1. Cambiar hero de producto vehicular a censo institucional CACREF.
2. Mejorar labels, microcopy y agrupacion de pasos.
3. Verificar responsive en movil y desktop.
4. Asegurar que el formulario se entienda sin instrucciones largas.
5. Mantener identidad CACREF y tono institucional.

Prompt sugerido:

```text
Toma la app React de CACREF-SALUD y pule la UX del MVP de censo socioeconomico y salud. Enfocate en claridad, confianza institucional, mobile-first y labels accionables. No cambies contratos de API sin coordinar con Codex.
```

### Minimax

Responsabilidad principal: contenido ejecutivo, propuesta y matriz de preguntas.

Archivos objetivo:

- `docs/PROPUESTA_BORRADOR_CENSO_SOCIOECONOMICO_CACREF.md`
- `docs/PREGUNTAS_CENSO_SOCIOECONOMICO_CACREF.md`
- opcional: texto para `README.md`

Tareas:

1. Redactar propuesta para presentar al jefe.
2. Crear matriz de preguntas con objetivo de cada campo.
3. Redactar aviso de uso de datos sensibles en lenguaje simple.
4. Preparar resumen de 1 pagina:
   - problema
   - solucion
   - alcance MVP
   - decisiones que habilita
   - proximos pasos

Prompt sugerido:

```text
Redacta una propuesta ejecutiva para un MVP de censo socioeconomico y salud CACREF. Debe servir para mostrar hoy al jefe. Incluye objetivo, alcance, poblacion objetivo, datos a recolectar, proteccion de datos sensibles, tablero de priorizacion y plan de siguientes pasos. Tono institucional, concreto y no medico.
```

## 7. Plan de 2 horas

### 0:00 - 0:15 | Alineacion rapida

Responsable: Codex

- Confirmar estado de archivos.
- Identificar contratos frontend/backend.
- Definir campos obligatorios minimos.
- Congelar alcance: salud + calidad de vida + dashboard.

Entregable:

- Checklist tecnico y mapa de archivos.

### 0:15 - 0:50 | Formulario publico

Responsables: Codex + Antigravity

- Renombrar pasos:
  - Datos personales
  - Vinculacion CACREF
  - Situacion socioeconomica
  - Salud y calidad de vida
- Sustituir vehiculos por salud.
- Validar campos obligatorios.
- Enviar payload compatible con backend.

Entregable:

- Registro funcional desde la pagina principal.

### 0:50 - 1:20 | Backend/deploy y dashboard

Responsable: Codex

- Verificar `server.ts`.
- Alinear `netlify/functions/api.ts` si se va a publicar en Netlify.
- Actualizar dashboard:
  - quitar vehiculos como foco
  - mostrar medicamento/cirugia/calidad de vida
  - conservar filtros de riesgo y recomendacion

Entregable:

- Admin puede ver y priorizar registros.

### 1:20 - 1:40 | Propuesta ejecutiva

Responsable: Minimax

- Redactar propuesta en Markdown.
- Incluir texto breve de privacidad y alcance no medico.
- Crear version corta para WhatsApp/correo.

Entregable:

- Documento listo para compartir internamente.

### 1:40 - 1:55 | Verificacion

Responsables: Codex + Antigravity

- Ejecutar `npm run lint`.
- Ejecutar `npm run build`.
- Probar alta de un registro.
- Probar dashboard admin.
- Revisar mobile/desktop.

Entregable:

- Lista de checks completados y riesgos restantes.

### 1:55 - 2:00 | Cierre para demo

Responsable: Codex

- Entregar URL local o deploy.
- Resumir estado para el jefe.
- Registrar pendientes post-MVP.

Entregable:

- Demo + propuesta + pendientes.

## 8. Division segura de archivos

Para evitar conflictos:

- Codex edita contratos, backend, dashboard y verificacion.
- Antigravity edita experiencia visual del formulario y hero.
- Minimax solo crea documentos Markdown, salvo acuerdo explicito.
- Nadie cambia `package.json` sin avisar.
- Nadie elimina `census.db` durante la ventana MVP.

Bloqueo recomendado por archivo:

| Archivo | Duenio primario | Nota |
|---|---|---|
| `src/components/CensusForm.tsx` | Codex | Antigravity puede sugerir copy, pero evitar edicion simultanea |
| `src/components/AdminDashboard.tsx` | Codex | Prioridad funcional |
| `src/components/Hero.tsx` | Antigravity | Coordinar textos principales |
| `server.ts` | Codex | Contrato fuente local |
| `netlify/functions/api.ts` | Codex | Contrato deploy |
| `docs/*.md` | Minimax | Codex revisa si afecta implementacion |

## 9. Modelo de datos MVP

Campos minimos para guardar:

```ts
{
  nombre_apellido: string;
  cedula: string;
  telefono: string;
  correo: string;
  vicepresidencia?: string;
  direccion_ejecutiva?: string;
  gerencia: string;
  unidad_operativa?: string;
  anos_servicio: number;
  cargo: string;
  ingreso_individual: number;
  ingreso_familiar: number;
  afiliado_cacref: boolean;
  capacidad_cuota: number;
  requiere_medicamento_cronico: boolean;
  medicamento_detalle?: string;
  requiere_cirugia: boolean;
  cirugia_detalle?: string;
  familiar_requiere_asistencia: boolean;
  calidad_vida_escala: number;
}
```

Campos calculados:

```ts
{
  score: number;
  score_seniority: number;
  score_payment_capacity: number;
  score_affordability: number;
  score_health_need: number;
  score_cooperative_bonus: number;
  affordability_ratio: number;
  suggested_max_quota: number;
  risk_level: 'BAJO' | 'MEDIO' | 'ALTO';
  recommendation:
    | 'APROBADO_PRIORIDAD_ALTA'
    | 'APROBADO_CONDICIONAL'
    | 'REQUIERE_COMITE'
    | 'NO_ELEGIBLE';
  priority_bucket: number;
}
```

## 10. Preguntas del formulario

### Datos personales

- Nombre y apellido
- Cedula de identidad
- Telefono celular
- Correo electronico

### Vinculacion institucional

- Es afiliado activo de CACREF?
- Vicepresidencia
- Direccion ejecutiva
- Gerencia
- Unidad operativa
- Cargo actual
- Anos de servicio

### Situacion socioeconomica

- Ingreso global individual mensual
- Ingreso integral familiar mensual
- Capacidad estimada de aporte mensual

### Salud y calidad de vida

- Requiere medicamento cronico?
- Indique medicamento, condicion o frecuencia requerida
- Requiere cirugia o procedimiento?
- Describa el procedimiento o necesidad
- Algun familiar directo requiere asistencia medica o apoyo?
- En escala del 1 al 10, como evalua su calidad de vida actual?

## 11. Aviso de privacidad MVP

Texto sugerido para el formulario:

```text
La informacion suministrada sera utilizada por CACREF unicamente para fines de diagnostico socioeconomico, identificacion de necesidades de salud y priorizacion interna de apoyo. Este formulario no sustituye una evaluacion medica ni constituye aprobacion automatica de beneficios. Los datos sensibles seran tratados con acceso restringido.
```

## 12. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion MVP |
|---|---:|---|
| Manejo de datos sensibles de salud | Alto | Aviso claro, acceso admin protegido, no pedir historia clinica completa |
| Formulario demasiado largo | Medio | 4 pasos, campos estrictamente necesarios |
| Diferencia entre backend local y Netlify | Alto | Alinear `server.ts` y `netlify/functions/api.ts` |
| Scoring interpretado como decision medica | Alto | Etiquetarlo como priorizacion administrativa |
| Demo sin datos | Medio | Crear 2 registros de prueba |
| Exportar CSV no implementado | Bajo | Marcar como pendiente si no cabe en 2 horas |

## 13. Definition of Done

- [ ] Formulario reorientado a censo socioeconomico y salud.
- [ ] Payload del formulario coincide con backend.
- [ ] Registro se guarda correctamente.
- [ ] Dashboard muestra priorizacion y riesgo.
- [ ] Netlify Function alineada si se requiere deploy.
- [ ] Validacion local ejecutada.
- [ ] Propuesta ejecutiva creada.
- [ ] URL local o deploy lista para demo.

## 14. Mensaje corto para presentar el borrador

```text
Jefe, preparamos un borrador funcional de censo socioeconomico y salud para trabajadores, afiliados CACREF y familiares. El objetivo es levantar informacion basica de situacion economica, medicamentos cronicos, cirugias pendientes y calidad de vida, para priorizar casos y construir una base inicial de decision. El MVP ya contempla formulario, almacenamiento y tablero administrativo con riesgo y recomendacion. No sustituye evaluacion medica; es una herramienta de diagnostico y priorizacion institucional.
```

## 15. Pendientes post-MVP

- Validacion juridica del aviso de datos sensibles.
- Definir responsables internos con acceso al dashboard.
- Exportacion CSV real si no se termina en la ventana inicial.
- Campos de soporte documental opcionales.
- Reporte agregado por gerencia/unidad.
- Integracion futura con inventario o proveedores de salud.
- Auditoria de accesos administrativos.

