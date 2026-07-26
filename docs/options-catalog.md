# Catálogo de Opciones — Formulario CACREF

Investigación para convertir los campos del censo en selects (seleccionables) en lugar de texto libre. Datos basados en:
- Convención Colectiva PDVSA Petróleo 2017-2019 (Cláusula 59 sobre CACREF)
- Estructura orgánica de PDVSA (Gaceta Oficial, decretos 2020-2024)
- Organigrama de PDVSA 2023-2024
- Informes de Gestión Anual PDVSA 2014-2015
- Conocimiento de la industria petrolera venezolana

> **Nota importante:** CACREF agrupa a trabajadores petroleros, gasíferos y similares. La mayoría viene de PDVSA y filiales, pero también hay trabajadores de empresas conexas (CVP, INTEVEP, PDVSA Gas, etc.) y jubilados. Las listas están dimensionadas para cubrir todos esos casos.

---

## 1. VINCULACIÓN CACREF

| Valor | Descripción |
|---|---|
| `socio_activo` | Socio activo con cuota al día |
| `socio_moroso` | Socio con cuotas pendientes |
| `beneficiario` | Familiar beneficiario de socio |
| `trabajador_no_socio` | Trabaja en sector pero no está afiliado |
| `jubilado` | Trabajador jubilado del sector petrolero |
| `pensionado` | Pensionado por invalidez o sobrevivencia |
| `externo` | Personal externo / contratista |

---

## 2. DATOS LABORALES E INSTITUCIONALES

### 2.1 Empresa / Filial

PDVSA matriz y sus filiales operativas más conocidas. Para que el usuario encuentre rápido la suya.

```
PDVSA (Petróleos de Venezuela, S.A.)
PDVSA Petróleo, S.A.
PDVSA Gas, S.A.
PDVSA Industrial, S.A.
PDVSA Servicios Petroleros, S.A. (PDVSA Servicios)
PDVSA Ingeniería y Construcción, S.A. (PDVSA ICO)
PDVSA Naval, S.A.
PDVSA Agrícola, S.A.
PDVSA Desarrollos Urbanos, S.A.
PDVSA Gas Comunal, S.A.
Corporación Venezolana del Petróleo (CVP)
INTEVEP, S.A.
BARIVEN, S.A.
PDV Marina, S.A.
PDV Holding, Inc. (Delaware)
PDV Insurance Company Ltd.
PDVSA Social
PDVSA TV
Empresa Estatal (holding)
Filial no petrolera
Empresa mixta (asociada)
Empresa contratista / conexa
Otra
```

### 2.2 Régimen de Trabajo

```
Personal propio de PDVSA / filial
Personal contratado
Personal jubilado
Personal pensionado
```

---

## 3. VICEPRESIDENCIAS (Estructura PDVSA vigente 2020-2024 según decretos)

Solo la Vicepresidencia Ejecutiva, luego las VPs por área de negocio:

```
Vicepresidencia Ejecutiva
Vicepresidencia de Planificación e Ingeniería
Vicepresidencia de Exploración y Producción
Vicepresidencia de Refinación
Vicepresidencia de Comercio y Suministro Internacional
Vicepresidencia de Comercio y Suministro Nacional
Vicepresidencia de Gas
Vicepresidencia de Finanzas
Vicepresidencia de Asuntos Internacionales
No aplica (jubilado/pensionado/otra empresa)
```

> Fuente: Decreto N° 4.138 del 29/02/2020, complementado por designaciones posteriores.

---

## 4. DIRECCIONES EJECUTIVAS

Por Vicepresidencia, según Informe de Gestión 2014-2015 y reorganizaciones:

### Exploración y Producción
```
Producción Oriente
Producción Occidente
Producción Costa Afuera
Producción Faja Petrolífera del Orinoco (FPO) Hugo Chávez
Nuevos Desarrollos Faja Petrolífera del Orinoco
Apoyo y Gestión Faja Petrolífera del Orinoco
Proyecto Socialista Orinoco
Exploración y Estudios Integrados
Costa Afuera Oriental
Costa Afuera Occidental
```

### Refinación
```
Refinería Puerto La Cruz
Refinería Cardón
Refinería Amuay
Refinería El Palito
Refinería Bajo Grande
Refinería San Roque
Mejoramiento y Procesamiento
Complejo Refinador Paraguana (CRP)
Complejo Refinador Centro-Occidental
Refinería Isla (Curazao)
```

### Comercio y Suministro
```
Comercialización Nacional
Comercialización Internacional
Logística y Transporte
Almacenamiento y Despacho
Terminales y Muelles
```

### Gas
```
Producción de Gas
Procesamiento de Gas
Distribución de Gas
PDVSA Gas Comunal
Plantas de Compresión
```

### Finanzas / Administración
```
Tesorería
Contabilidad
Presupuesto
Auditoría Interna
Gestión Financiera
Tecnología de Información
Recursos Humanos
Asuntos Jurídicos
Seguridad y Salud Laboral
```

### No aplica
```
No aplica (mi cargo no está bajo una Dirección Ejecutiva)
```

---

## 5. GERENCIAS

Gerencias más comunes en el sector petrolero. La idea es que el usuario pueda tipear y que el campo tenga un datalist con sugerencias, o seleccionar de un combo jerárquico.

### Gerencias de Distrito / Producción
```
Gerencia General División Furrial
Gerencia General División Costa Afuera
Gerencia General División Costa Occidental del Lago
Gerencia General División Costa Oriental del Lago
Gerencia General División Sur del Lago
Gerencia General División Ayacucho
Gerencia General División Junín
Gerencia General División Carabobo
Gerencia General División Boyacá
Gerencia General División Lago
Gerencia General Distrito Norte
Gerencia General Distrito Centro
Gerencia General Distrito Sur
Gerencia General Distrito Gas
```

### Gerencias Funcionales (de apoyo)
```
Gerencia de Planificación y Gestión
Gerencia de Desarrollo Social
Gerencia de Asuntos Jurídicos
Gerencia de Seguridad e Higiene
Gerencia de Finanzas
Gerencia de Recursos Humanos
Gerencia de Ingeniería
Gerencia de Mantenimiento
Gerencia de Operaciones de Producción
Gerencia de Servicios Generales
Gerencia de Logística
Gerencia de Compras y Contrataciones
Gerencia de Tecnología de Información
Gerencia de Auditoría
Gerencia de Salud Ocupacional
Gerencia de Relaciones Institucionales
Gerencia de Comunicaciones
```

---

## 6. UNIDADES OPERATIVAS (Plantas, Refinerías, Campos)

Las más conocidas y operativas en Venezuela:

### Refinerías y complejos
```
Refinería Puerto La Cruz
Refinería Cardón
Refinería Amuay
Complejo Refinador Paraguana (Amuay + Cardón)
Refinería El Palito
Refinería Bajo Grande
Refinería San Roque
Mejoradora Petropiar
Mejoradora Petromonagas
Complejo Petroquímico Ana María Campos
Centro de Refinación Oriente
Planta de Compresión de Gas (varias)
Planta de Extracción de Líquidos (varias)
```

### Campos petroleros / Divisiones operativas
```
Campo Furrial
Campo El Furrial / Musipán
Campo Jusepín
Campo Carito
Campo Orocual
Campo Temblador
Campo Morichal
Campo Cerro Negro
Campo Hamaca
Campo Zuata
Campo Merey
Campo Sincrudo
Campo Bachaquero
Campo Lama
Campo Barua
Campo Mene Grande
Campo Cabimas
Campo La Paz
Campo Tía Juana
Campo Lagunillas
Campo Ceuta
Campo Lejos
Campo Urdaneta
Campo Boscán
Campo Concepción
Campo Barinas
Campo Silvestre
Campo San Joaquín
Campo Pedernales
Campo Guanoco
Campo Ostra
Campo Terecay
Campo Yopales
Campo SanviGua
Campo Budare
Campo Corocoro
Campo Taparito
División Costa Afuera Oriental
División Costa Afuera Occidental
Yacimiento Ayacucho
Yacimiento Junín
Yacimiento Boyacá
Yacimiento Carabobo
```

### Unidades de servicio
```
Base Petrolera San Tomé
Base Petrolera Puerto Ayacucho
Base Petrolera Maracaibo
Centro de Servicios Industriales
Talleres Centrales
Almacén General
Planta de Tratamiento de Crudo
Planta de Inyección de Agua
Planta de Vapor
Planta de Compresión de Gas
Planta de Generación Eléctrica
Sistema de Oleoductos
Sistema de Gasoductos
Terminal de Almacenamiento
Muelle de Embarque
```

### Si no está operativo
```
No aplica (jubilado, pensionado, administrativo central, otra sede)
```

---

## 7. AÑOS DE SERVICIO

Rangos típicos usados en PDVSA y en CACREF (basado en Convención Colectiva 2017-2019, Cláusula sobre beneficios por antigüedad):

| Rango | Descripción |
|---|---|
| `0-2` | Ingreso reciente (probación) |
| `3-5` | Operador/técnico junior |
| `6-10` | Personal con experiencia inicial |
| `11-15` | Personal consolidado |
| `16-20` | Personal senior |
| `21-25` | Veterano |
| `26-30` | Pre-jubilación |
| `31-35` | Jubilación anticipada |
| `36+` | Más de 35 años (referencia de longevidad) |

> El formulario actual pide el número exacto. **Recomendación:** mantener el número libre (0-50) para scoring, pero añadir un select de "rango" para reportes agregados y elegibilidad de beneficios (la Convención usa rangos, no números exactos).

---

## 8. CARGOS (Top más comunes en industria petrolera)

Para el campo "Cargo Actual". Lista jerárquica de menor a mayor responsabilidad:

### Nivel operativo (base)
```
Obrero
Operador de equipo
Operador de planta
Operador de campo
Operador de producción
Operador de mantenimiento
Operador de turno
Técnico de mantenimiento
Técnico electricista
Técnico instrumentista
Técnico mecánico
Técnico de instrumentos
Técnico de procesos
Técnico de operaciones
Técnico de servicios
Técnico de seguridad
Auxiliar
Ayudante
Mecánico
Soldador
Electricista
Tubero
Lantero
Operador de planta compresora
```

### Nivel táctico (supervisión)
```
Supervisor
Supervisor de turno
Supervisor de operaciones
Supervisor de mantenimiento
Supervisor de seguridad
Supervisor de producción
Supervisor de campo
Supervisor administrativo
Capataz
Maestro mecánico
Maestro electricista
Maestro de obras
Maestro de mantenimiento
Maestro de planta
Líder de cuadrilla
Coordinador
Coordinador de turno
Coordinador de operaciones
Coordinador administrativo
```

### Nivel profesional
```
Ingeniero
Ingeniero de producción
Ingeniero de mantenimiento
Ingeniero de proyectos
Ingeniero de procesos
Ingeniero de perforación
Ingeniero de yacimientos
Ingeniero eléctrico
Ingeniero mecánico
Ingeniero civil
Ingeniero de instrumentación
Ingeniero de seguridad
Ingeniero de calidad
Ingeniero ambiental
Ingeniero de planificación
Ingeniero de operaciones
Médico
Enfermero(a) / Licenciado(a) en Enfermería
Psicólogo(a)
Trabajador(a) social
Analista
Analista administrativo
Analista de recursos humanos
Analista de planificación
Analista de presupuesto
Analista de costos
Analista de compras
Analista de sistemas / TI
Contador(a)
Auditor(a)
Abogado(a)
Administrador(a)
Economista
Sociólogo(a)
Comunicador(a) social
Periodista
Relacionista industrial
```

### Nivel gerencial
```
Gerente
Gerente de distrito
Gerente general
Gerente de operaciones
Gerente de mantenimiento
Gerente administrativo
Gerente de seguridad
Gerente de recursos humanos
Gerente de finanzas
Gerente de planificación
Gerente de proyectos
Jefe de departamento
Jefe de división
Jefe de unidad
Coordinador general
Director
Director ejecutivo
Superintendente
Superintendente de operaciones
Superintendente de mantenimiento
```

### Nivel ejecutivo (alto)
```
Vicepresidente
Presidente
Director General
Gerente General de División
Gerente Corporativo
```

### Si no encaja
```
Profesional independiente
Consultor
Contratista
Otro
```

---

## 9. AFILIACIÓN CACREF

Para el campo "Soy socio activo de CACREF":

```
Sí, socio activo con cuota al día
Sí, socio activo con cuota pendiente
No, pero estoy en proceso de afiliación
No, no estoy afiliado
No aplica (jubilado/pensionado/familiar beneficiario)
```

---

## IMPLEMENTACIÓN SUGERIDA EN EL CÓDIGO

1. **Crear archivo `src/data/catalog.ts`** con constantes exportadas para cada lista
2. **Para el formulario público**: cambiar inputs de texto a `<select>` con la lista correspondiente, o `<datalist>` si quieren permitir texto libre con sugerencias
3. **Para el admin**: filtros existentes se vuelven combos con búsqueda
4. **Validación adicional**: si el usuario selecciona "PDVSA", forzar selección de VP y DE; si es jubilado, marcar campos como N/A
5. **Mostrar jerarquía**: usar un patrón de cascada (VP → DE → Gerencia → Unidad) donde seleccionar VP filtra las DE disponibles

### Patrón de cascada sugerido (UX)

```
Empresa: [PDVSA] [select]
  ↓ (filtra el siguiente select)
VP: [VP Exploración y Producción] [select]
  ↓
Dirección Ejecutiva: [Producción Oriente] [select]
  ↓
Gerencia: [Gerencia Distrito Norte] [select]
  ↓
Unidad Operativa: [Campo Furrial] [select]
```

Esto da velocidad al usuario + datos consistentes para reportes.

---

## VALIDACIÓN DE DATOS

Antes de implementar, **recomendación importante**: validar esta información con la directiva de CACREF o con PDVSA. La estructura cambia con cada reorganización (la última fue 2020 y ha habido ajustes en 2024). El campo "Unidad Operativa" en particular puede tener cientos de subdivisiones, así que es importante priorizar las más comunes y dejar fallback a "Otra" para casos no listados.

---

## CÓMO USAR ESTE DOCUMENTO

1. **Comparte con la directiva de CACREF** para validar
2. **Ajusta las listas** si falta algo o sobra (especialmente "Unidad Operativa")
3. **Cuando esté validado**, pídeme implementar el formulario con selects en cascada
4. Para casos no contemplados, **siempre dejar campo "Otra"** al final de cada select con opción de texto libre
