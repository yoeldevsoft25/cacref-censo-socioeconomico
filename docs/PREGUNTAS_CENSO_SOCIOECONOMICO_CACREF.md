# Matriz de preguntas — Censo Socioeconómico y de Salud CACREF

> Documento de referencia. Sirve para validar que cada campo del formulario cumple un objetivo claro y para entrenar al equipo que atenderá dudas durante la campaña.
> Versión borrador para revisión.

---

## 1. Cómo leer esta matriz

Cada fila responde a cuatro preguntas:

- **¿Qué preguntamos?** Texto que ve la persona que llena el formulario.
- **¿Para qué lo preguntamos?** Objetivo concreto. Si una pregunta no tiene objetivo claro, sobra.
- **¿Es dato sensible?** Indica si la respuesta implica manejo restringido.
- **¿Cómo se usa?** Destino en el sistema: cálculo, filtro, reporte, o solo identificación.

**Leyenda de sensibilidad:**
- **No sensible**: dato administrativo o de contacto.
- **Sensible (económico)**: ingresos, capacidad de pago.
- **Sensible (salud)**: condiciones médicas, medicamentos, cirugías, calidad de vida.

---

## 2. Matriz completa

### Paso 1 — Datos personales

| # | Pregunta al censado | Objetivo | Sensible | Cómo se usa |
|---|---|---|---|---|
| 1.1 | Nombre y apellido | Identificar al censado y evitar duplicados | No sensible | Identificación + dashboard |
| 1.2 | Cédula de identidad | Llave única de la persona, evita duplicados y conecta con padrón CACREF | No sensible | Identificación única + cruce con padrón |
| 1.3 | Teléfono celular | Canal de contacto para seguimiento por parte del comité | No sensible | Contacto administrativo |
| 1.4 | Correo electrónico | Canal formal de contacto y notificación | No sensible | Contacto administrativo |

### Paso 2 — Vinculación institucional

| # | Pregunta al censado | Objetivo | Sensible | Cómo se usa |
|---|---|---|---|---|
| 2.1 | ¿Es afiliado activo a CACREF? | Determinar si la persona entra al padrón y qué reglas de cuota aplican | No sensible | Scoring (plus cooperativo) y elegibilidad |
| 2.2 | Vicepresidencia | Ubicar orgánicamente al censado | No sensible | Filtro y reporte agregado |
| 2.3 | Dirección ejecutiva | Ubicar orgánicamente al censado | No sensible | Filtro y reporte agregado |
| 2.4 | Gerencia | Ubicar orgánicamente al censado y habilitar filtro prioritario | No sensible | Filtro prioritario del dashboard |
| 2.5 | Unidad operativa | Ubicar orgánicamente al censado | No sensible | Filtro y reporte agregado |
| 2.6 | Cargo actual | Conocer la responsabilidad y rol institucional | No sensible | Reporte agregado |
| 2.7 | Años de servicio | Calcular seniority (antigüedad) y plus por estabilidad | No sensible | Score de antigüedad |

### Paso 3 — Situación socioeconómica

| # | Pregunta al censado | Objetivo | Sensible | Cómo se usa |
|---|---|---|---|---|
| 3.1 | Ingreso individual mensual (Bs.) | Dimensionar la capacidad económica del censado | Sensible (económico) | Score de capacidad de pago + filtro de ingreso |
| 3.2 | Ingreso familiar mensual (Bs.) | Dimensionar la capacidad económica del núcleo familiar | Sensible (económico) | Score de capacidad de pago + ratio de asequibilidad |
| 3.3 | Capacidad estimada de aporte mensual a CACREF (Bs.) | Calibrar la cuota sostenible y detectar brecha de aporte | Sensible (económico) | Score de asequibilidad + cuota máxima sugerida |

### Paso 4 — Salud y calidad de vida

| # | Pregunta al censado | Objetivo | Sensible | Cómo se usa |
|---|---|---|---|---|
| 4.1 | ¿Requiere medicamento crónico? | Identificar necesidad permanente de tratamiento | Sensible (salud) | Score de necesidad de salud |
| 4.2 | Indique medicamento, condición o frecuencia | Concretar la necesidad para evaluar cobertura y prioridad | Sensible (salud) | Reporte y priorización; **no** se usa para diagnóstico |
| 4.3 | ¿Requiere cirugía o procedimiento? | Detectar necesidad quirúrgica pendiente | Sensible (salud) | Score de necesidad de salud |
| 4.4 | Describa el procedimiento o necesidad | Concretar la necesidad para evaluar cobertura y prioridad | Sensible (salud) | Reporte y priorización; **no** se usa para diagnóstico |
| 4.5 | ¿Algún familiar directo requiere asistencia médica o apoyo? | Detectar carga familiar adicional y priorizar | Sensible (salud) | Score de necesidad de salud |
| 4.6 | En escala del 1 al 10, ¿cómo evalúa su calidad de vida actual? | Lectura subjetiva del bienestar percibido | Sensible (salud) | Score de necesidad de salud + reporte |

---

## 3. Campos calculados (no se preguntan)

Estos valores los produce el sistema, no la persona:

| Campo calculado | ¿Qué representa? | Se usa para |
|---|---|---|
| `score` | Puntaje total combinado | Ordenar la cola de atención |
| `score_seniority` | Puntaje por antigüedad | Reconocer estabilidad |
| `score_payment_capacity` | Capacidad económica | Calificar sostenibilidad |
| `score_affordability` | Asequibilidad (cuota vs ingreso) | Ajustar recomendación |
| `score_health_need` | Necesidad de salud agregada | Priorizar atención |
| `score_cooperative_bonus` | Plus por ser afiliado CACREF activo | Bonificar pertenencia |
| `affordability_ratio` | Proporción de la cuota sobre el ingreso | Calibración |
| `suggested_max_quota` | Cuota máxima sugerida al comité | Referencia administrativa |
| `risk_level` | BAJO / MEDIO / ALTO | Filtro principal del dashboard |
| `recommendation` | APROBADO_PRIORIDAD_ALTA / APROBADO_CONDICIONAL / REQUIERE_COMITÉ / NO_ELEGIBLE | Recomendación administrativa |
| `priority_bucket` | Prioridad numérica | Orden en la cola |

---

## 4. Reglas de oro para el equipo

1. **No se pide historia clínica completa.** Solo lo mínimo para priorizar. Si el censado aporta más, se agradece pero no se captura en el MVP.
2. **El puntaje no aprueba beneficios.** Es un orden de atención. La palabra final es del comité.
3. **Los datos sensibles no salen del dashboard administrativo.** No se exportan a terceros, no se imprimen, no se comparten por correo.
4. **Toda duda se escala al comité.** Si un censado pide orientación médica, se redirige a consulta profesional. El formulario no es un canal clínico.
5. **El aviso de privacidad es obligatorio.** Está integrado en el formulario; no se debe remover ni reescribir sin pasar por jurídica.

---

## 5. Preguntas frecuentes (FAQ para la campaña)

**¿Es obligatorio responder?**
La obligatoriedad depende de lo que decida el Jefe y el área jurídica. Por defecto, se trata como voluntario.

**¿Quién verá mi información?**
Solo personal autorizado con acceso al dashboard administrativo. No se comparte con terceros.

**¿Esto me da derecho a un beneficio?**
No. Es una herramienta de priorización. La decisión final la toma el comité institucional.

**¿Puedo corregir mis datos después?**
En el MVP, no. En una segunda iteración se habilitará edición o reenvío.

**¿Van a usar mis datos de salud para algo más?**
No. Solo se usan para priorizar tu caso dentro de CACREF.

---

## 6. Pendientes de esta matriz

- [ ] Confirmar con el Jefe si la unidad de registro es individual o por núcleo familiar.
- [ ] Confirmar periodicidad de la campaña (trimestral, anual, por evento).
- [ ] Definir ventana de retención de datos sensibles.
- [ ] Validar redacción final de cada pregunta con el área de comunicación interna.
- [ ] Revisar este documento con jurídica antes de la campaña.

---

*Matriz preparada como insumo del MVP. Sujeta a revisión con el Jefe y el área jurídica de CACREF.*
