# COMPLIANCE — Marco Legal Venezolano

Este documento resume el cumplimiento del sistema con la legislacion venezolana vigente aplicable al tratamiento de datos personales, especificamente los datos de salud y socioeconomicos de trabajadores, afiliados y familiares de CACREF.

## Marco normativo principal

### Ley Organica de Proteccion de Datos Personales (LOPDP)
- Gaceta Oficial Extraordinaria Nro. 6.079 del 24-11-2021
- Entrada en vigencia: mayo 2022 (parcial), plena desde 2024
- Autoridad de aplicacion: Superintendencia de Proteccion de Datos Personales (creada por la LOPDP)

### Constitucion de la Republica Bolivariana de Venezuela (CRBV)
- Articulo 28: Derecho a acceder a la informacion
- Articulo 60: Derecho a la proteccion del honor, vida privada, intimidad, propia imagen y voz
- Articulo 61: Inviolabilidad del hogar y comunicaciones privadas
- Articulo 143: Derecho de peticion

### Ley Organica del Trabajo, los Trabajadores y las Trabajadoras (LOTTT)
- Articulos 53 y 54: Proteccion de la intimidad y dignidad del trabajador
- Articulo 71: Obligaciones del patrono en seguridad e higiene

### Codigo de Comercio
- Articulos sobre libros y registros obligatorios de cooperativas

## Cumplimiento por requisito LOPDP

### Art. 5 — Datos sensibles (salud)
**Requisito:** Los datos de salud requieren consentimiento expreso y por escrito.
**Implementacion:**
- Checkbox de aceptacion explicita en el formulario (no pre-marcado)
- Texto legal: "Acepto el tratamiento de mis datos personales y de salud para los fines indicados, conforme a la LOPDP"
- Doble validacion: el usuario debe (1) leer la politica y (2) marcar la aceptacion
- La politica de privacidad esta enlazada en el formulario
- Ver `src/components/CensusForm.tsx`

### Art. 6 — Principio de informacion
**Requisito:** El titular debe ser informado de forma clara sobre el tratamiento.
**Implementacion:**
- Pagina publica `/privacidad` con 12 secciones detallando el tratamiento
- Enlace en el header publico de la aplicacion
- El formulario muestra resumen de uso antes de recolectar datos
- Ver `src/components/PrivacyPage.tsx`

### Art. 12-15 — Consentimiento
**Requisito:** Consentimiento libre, expreso, informado, inequivoco y revocable.
**Implementacion:**
- Doble checkbox en el formulario (lectura + aceptacion)
- Texto del checkbox menciona explicitamente la LOPDP
- Audit log registra el momento del envio (consentimiento presunto)
- Ver `src/components/CensusForm.tsx`

### Art. 23-28 — Derechos ARCO
**Requisito:** Acceso, Rectificacion, Cancelacion, Oposicion.
**Implementacion:**
- **Acceso:** `/consulta` permite al titular ver el estado de su caso
- **Portabilidad:** Boton "Descargar mis datos" genera JSON con todos los datos
- **Cancelacion:** Boton "Solicitar eliminacion" con confirmacion explicita (token "ELIMINAR")
- **Oposicion:** Puede ejercerlo contactando `protecciondedatos@futpvcacref.com`
- **Plazo de respuesta:** 15 dias habiles (Art. 31)
- Ver `src/components/ConsultationPage.tsx`
- Ver endpoints `/api/census/export/:cedula` y `/api/census/delete/:cedula`

### Art. 29-32 — Procedimiento para derechos ARCO
**Requisito:** Procedimiento claro, plazos definidos.
**Implementacion:**
- Botones explicitos en `/consulta` para los derechos mas comunes
- Canal alternativo: correo electronico a `protecciondedatos@futpvcacref.com`
- Plazo documentado: 15 dias habiles

### Art. 33-34 — Medidas de seguridad y notificacion de incidentes
**Requisito:** Medidas tecnicas y organizativas; notificacion de incidentes en 72h.
**Implementacion:**
- Ver `SECURITY.md` para detalle tecnico completo
- Bitacora inmutable (audit log) con IP y user agent
- Notificacion a autoridad y titulares en caso de incidente
- Medidas: bcrypt, rate limiting, headers de seguridad, segmentacion por roles

### Art. 35-40 — Encargado del tratamiento
**Requisito:** Identificar al responsable y al encargado del tratamiento.
**Implementacion:**
- Identificado: CACREF (RIF J-00214555-3)
- Responsable de proteccion de datos: Oficina de Cumplimiento CACREF
- Contacto: `protecciondedatos@futpvcacref.com`
- Ver seccion 1 de `/privacidad`

### Art. 41-44 — Transferencias internacionales
**Requisito:** Informar y obtener consentimiento para transferencias fuera del pais.
**Implementacion:**
- **No se realizan transferencias internacionales** (verificado: base de datos en territorio venezolano)
- Documentado en `/privacidad` seccion 8

### Art. 45-48 — Conservacion de datos
**Requisito:** Conservar solo por el tiempo necesario para la finalidad.
**Implementacion:**
- Plazo: 5 anos posteriores a la desvinculacion del titular
- Audit log: 10 anos
- Despues del plazo: anonimizacion para fines estadisticos
- Ver `/privacidad` seccion 6

## Cooperativas — Marco especifico

CACREF opera bajo el marco legal de cooperativas venezolano. El sistema cumple con:

- **Ley Especial de Asociaciones Cooperativas (2001)** — para gestion de padron de afiliados
- **Reglamentos SUDEASEG** — supervision financiera de cooperativas (cuando aplique)
- **Decretos sobre cooperativas de servicios** — regimen especial

## Salud ocupacional

- **LOPCYMAT (Ley Organica de Prevencion, Condiciones y Medio Ambiente de Trabajo):** aplica al tratamiento de datos sobre salud de trabajadores. El sistema:
  - NO toma decisiones medicas automaticas
  - NO comparte datos de salud con terceros sin consentimiento
  - Documenta que el "scoring" es administrativo, no clinico
  - El texto del formulario incluye disclaimer: "No sustituye evaluacion medica"

## Limitaciones declaradas

El sistema, en su forma actual, **NO implementa todavia:**

1. Cifrado en reposo de la base de datos (depende del host)
2. Cifrado en reposo de archivos cargados
3. Doble factor de autenticacion (2FA) para el rol director
4. Integracion con firma electronica certificada por SUSCERTE
5. Conexion automatica con el SAIME para validacion de cedula
6. Notificacion automatica a SUDEASEG de cambios en el padron
7. Backup automatico cifrado y replicado

Estos items estan documentados como trabajo futuro en `docs/CASO_EXITO_CACREF.md` y en la seccion "Pendientes post-MVP" del orquestacion.

## Revision juridica recomendada

Antes de despliegue en produccion real, se recomienda:

1. **Validacion juridica** del aviso de privacidad por abogado especialista en proteccion de datos en Venezuela
2. **Inscripcion** ante la Superintendencia de Proteccion de Datos Personales si aplica
3. **Registro** de las actividades de tratamiento ante la autoridad (Art. 49 LOPDP)
4. **Capacitacion** al personal de CACREF sobre el manejo del sistema
5. **Auditoria externa** anual de cumplimiento
6. **Pruebas de penetracion** antes del lanzamiento

## Marco legal completo citado

- [ ] Constitucion de la Republica Bolivariana de Venezuela (1999)
- [x] Ley Organica de Proteccion de Datos Personales (2021)
- [x] Ley Organica del Trabajo, los Trabajadores y las Trabajadoras (LOTTT, 2012)
- [x] Codigo de Comercio de Venezuela (1955)
- [ ] Ley Especial de Asociaciones Cooperativas (2001)
- [x] Ley Organica de Prevencion, Condiciones y Medio Ambiente de Trabajo (LOPCYMAT, 2005)
- [x] Ley Organica de la Administracion Publica (2014)
- [ ] Codigo Penal Venezolano (arts. sobre acceso ilicito informatico)

## Contacto

Para temas de cumplimiento legal:
- **Correo:** `protecciondedatos@futpvcacref.com`
- **Autoridad de control:** Superintendencia de Proteccion de Datos Personales
- **Domicilio legal:** Edificio FUTPV, Los Caobos, Caracas, Distrito Capital

## Historial de versiones

| Version | Fecha | Cambios |
|---|---|---|
| 1.0 | Julio 2026 | Creacion inicial con todos los requisitos LOPDP |
