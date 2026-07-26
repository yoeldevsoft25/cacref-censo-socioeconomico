// Catálogo de opciones para el formulario del censo CACREF.
// Datos validados contra Convención Colectiva PDVSA 2017-2019 y
// organigrama PDVSA 2020-2024. Ver docs/options-catalog.md.
//
// Todas las listas terminan con una opción "Otra" (no listada explícitamente)
// para que el formulario pueda recoger valores que no estén en el catálogo.
// Los años de servicio se mantienen como número libre + select de rango,
// porque la Convención Colectiva usa rangos pero el scoring usa el valor exacto.

export type AffiliationStatus =
  | 'socio_activo'
  | 'socio_moroso'
  | 'beneficiario'
  | 'trabajador_no_socio'
  | 'jubilado'
  | 'pensionado'
  | 'externo';

export const AFFILIATION_OPTIONS: { value: AffiliationStatus; label: string }[] = [
  { value: 'socio_activo', label: 'Socio activo con cuota al día' },
  { value: 'socio_moroso', label: 'Socio activo con cuota pendiente' },
  { value: 'beneficiario', label: 'Familiar beneficiario de socio' },
  { value: 'trabajador_no_socio', label: 'Trabajador del sector, no afiliado' },
  { value: 'jubilado', label: 'Jubilado del sector petrolero' },
  { value: 'pensionado', label: 'Pensionado (invalidez o sobrevivencia)' },
  { value: 'externo', label: 'Personal externo / contratista' },
];

// Empresas / filiales que pueden aparecer en el campo Empresa.
export const COMPANY_OPTIONS: string[] = [
  'PDVSA (Petróleos de Venezuela, S.A.)',
  'PDVSA Petróleo, S.A.',
  'PDVSA Gas, S.A.',
  'PDVSA Industrial, S.A.',
  'PDVSA Servicios Petroleros, S.A.',
  'PDVSA Ingeniería y Construcción, S.A.',
  'PDVSA Naval, S.A.',
  'PDVSA Agrícola, S.A.',
  'PDVSA Desarrollos Urbanos, S.A.',
  'PDVSA Gas Comunal, S.A.',
  'Corporación Venezolana del Petróleo (CVP)',
  'INTEVEP, S.A.',
  'BARIVEN, S.A.',
  'PDV Marina, S.A.',
  'PDV Holding, Inc. (Delaware)',
  'PDV Insurance Company Ltd.',
  'PDVSA Social',
  'PDVSA TV',
  'Empresa Estatal (holding)',
  'Filial no petrolera',
  'Empresa mixta (asociada)',
  'Empresa contratista / conexa',
];

export const REGIMEN_OPTIONS: string[] = [
  'Personal propio de PDVSA / filial',
  'Personal contratado',
  'Personal jubilado',
  'Personal pensionado',
];

// Vicepresidencias vigentes según decretos 2020-2024.
// El string vacío '' representa "No aplica" (jubilados, otras empresas).
export const VICEPRESIDENCY_OPTIONS: string[] = [
  '',
  'Vicepresidencia Ejecutiva',
  'Vicepresidencia de Planificación e Ingeniería',
  'Vicepresidencia de Exploración y Producción',
  'Vicepresidencia de Refinación',
  'Vicepresidencia de Comercio y Suministro Internacional',
  'Vicepresidencia de Comercio y Suministro Nacional',
  'Vicepresidencia de Gas',
  'Vicepresidencia de Finanzas',
  'Vicepresidencia de Asuntos Internacionales',
];

// Direcciones Ejecutivas indexadas por Vicepresidencia.
// Una Vicepresidencia vacía (no aplica) no tiene DEs.
// '' dentro de un grupo representa "No aplica / Otra DE dentro de esta VP".
export const DIRECTIONS_BY_VP: Record<string, string[]> = {
  'Vicepresidencia Ejecutiva': ['', 'Dirección Ejecutiva Corporativa'],
  'Vicepresidencia de Planificación e Ingeniería': [
    '',
    'Dirección Ejecutiva de Planificación',
    'Dirección Ejecutiva de Ingeniería y Proyectos',
  ],
  'Vicepresidencia de Exploración y Producción': [
    '',
    'Producción Oriente',
    'Producción Occidente',
    'Producción Costa Afuera',
    'Producción Faja Petrolífera del Orinoco (FPO) Hugo Chávez',
    'Nuevos Desarrollos Faja Petrolífera del Orinoco',
    'Apoyo y Gestión Faja Petrolífera del Orinoco',
    'Proyecto Socialista Orinoco',
    'Exploración y Estudios Integrados',
  ],
  'Vicepresidencia de Refinación': [
    '',
    'Refinería Puerto La Cruz',
    'Refinería Cardón',
    'Refinería Amuay',
    'Refinería El Palito',
    'Refinería Bajo Grande',
    'Refinería San Roque',
    'Complejo Refinador Paraguana (CRP)',
    'Mejoramiento y Procesamiento',
  ],
  'Vicepresidencia de Comercio y Suministro Internacional': [
    '',
    'Comercialización Internacional',
    'Logística Internacional',
    'Terminales y Muelles',
  ],
  'Vicepresidencia de Comercio y Suministro Nacional': [
    '',
    'Comercialización Nacional',
    'Logística y Transporte Nacional',
    'Almacenamiento y Despacho',
  ],
  'Vicepresidencia de Gas': [
    '',
    'Producción de Gas',
    'Procesamiento de Gas',
    'Distribución de Gas',
    'Plantas de Compresión',
    'PDVSA Gas Comunal',
  ],
  'Vicepresidencia de Finanzas': [
    '',
    'Tesorería',
    'Contabilidad',
    'Presupuesto',
    'Auditoría Interna',
    'Gestión Financiera',
    'Tecnología de Información',
  ],
  'Vicepresidencia de Asuntos Internacionales': [
    '',
    'Negocios Internacionales',
    'Asuntos Gubernamentales',
  ],
};

// Gerencias funcionales (de apoyo).
export const GERENCIA_OPTIONS: string[] = [
  '',
  'Gerencia de Planificación y Gestión',
  'Gerencia de Desarrollo Social',
  'Gerencia de Asuntos Jurídicos',
  'Gerencia de Seguridad e Higiene',
  'Gerencia de Finanzas',
  'Gerencia de Recursos Humanos',
  'Gerencia de Ingeniería',
  'Gerencia de Mantenimiento',
  'Gerencia de Operaciones de Producción',
  'Gerencia de Servicios Generales',
  'Gerencia de Logística',
  'Gerencia de Compras y Contrataciones',
  'Gerencia de Tecnología de Información',
  'Gerencia de Auditoría',
  'Gerencia de Salud Ocupacional',
  'Gerencia de Relaciones Institucionales',
  'Gerencia de Comunicaciones',
  'Gerencia General División Furrial',
  'Gerencia General División Costa Afuera',
  'Gerencia General División Costa Occidental del Lago',
  'Gerencia General División Costa Oriental del Lago',
  'Gerencia General División Sur del Lago',
  'Gerencia General División Ayacucho',
  'Gerencia General División Junín',
  'Gerencia General División Carabobo',
  'Gerencia General División Boyacá',
  'Gerencia General División Lago',
  'Gerencia General Distrito Norte',
  'Gerencia General Distrito Centro',
  'Gerencia General Distrito Sur',
  'Gerencia General Distrito Gas',
];

// Unidades operativas: refinerías, campos, terminales, etc.
export const UNIT_OPTIONS: string[] = [
  '',
  'Refinería Puerto La Cruz',
  'Refinería Cardón',
  'Refinería Amuay',
  'Complejo Refinador Paraguana',
  'Refinería El Palito',
  'Refinería Bajo Grande',
  'Refinería San Roque',
  'Mejoradora Petropiar',
  'Mejoradora Petromonagas',
  'Complejo Petroquímico Ana María Campos',
  'Centro de Refinación Oriente',
  'Campo Furrial',
  'Campo Jusepín',
  'Campo Carito',
  'Campo Orocual',
  'Campo Temblador',
  'Campo Morichal',
  'Campo Cerro Negro',
  'Campo Hamaca',
  'Campo Zuata',
  'Campo Merey',
  'Campo Sincrudo',
  'Campo Bachaquero',
  'Campo Lama',
  'Campo Barua',
  'Campo Mene Grande',
  'Campo Cabimas',
  'Campo La Paz',
  'Campo Tía Juana',
  'Campo Lagunillas',
  'Campo Ceuta',
  'Campo Lejos',
  'Campo Urdaneta',
  'Campo Boscán',
  'Campo Concepción',
  'Campo Silvestre',
  'Campo San Joaquín',
  'Campo Pedernales',
  'Campo Guanoco',
  'Campo Ostra',
  'Campo Terecay',
  'División Costa Afuera Oriental',
  'División Costa Afuera Occidental',
  'Yacimiento Ayacucho',
  'Yacimiento Junín',
  'Yacimiento Boyacá',
  'Yacimiento Carabobo',
  'Base Petrolera San Tomé',
  'Base Petrolera Puerto Ayacucho',
  'Base Petrolera Maracaibo',
  'Centro de Servicios Industriales',
  'Talleres Centrales',
  'Almacén General',
  'Planta de Tratamiento de Crudo',
  'Planta de Inyección de Agua',
  'Planta de Vapor',
  'Planta de Compresión de Gas',
  'Planta de Generación Eléctrica',
  'Sistema de Oleoductos',
  'Sistema de Gasoductos',
  'Terminal de Almacenamiento',
  'Muelle de Embarque',
];

// Rangos de antigüedad usados en la Convención Colectiva.
// El campo principal sigue siendo el número exacto, pero el rango
// permite reportes agregados y elegibilidad de beneficios.
export const YEARS_OF_SERVICE_RANGES: { value: string; label: string; min: number; max: number }[] = [
  { value: '0-2', label: '0-2 años (ingreso reciente / probación)', min: 0, max: 2 },
  { value: '3-5', label: '3-5 años (operador / técnico junior)', min: 3, max: 5 },
  { value: '6-10', label: '6-10 años (experiencia inicial)', min: 6, max: 10 },
  { value: '11-15', label: '11-15 años (personal consolidado)', min: 11, max: 15 },
  { value: '16-20', label: '16-20 años (personal senior)', min: 16, max: 20 },
  { value: '21-25', label: '21-25 años (veterano)', min: 21, max: 25 },
  { value: '26-30', label: '26-30 años (pre-jubilación)', min: 26, max: 30 },
  { value: '31-35', label: '31-35 años (jubilación anticipada)', min: 31, max: 35 },
  { value: '36+', label: '36+ años (longevidad)', min: 36, max: 99 },
];

// Cargos típicos del sector petrolero, jerárquicamente agrupados.
// Cada string es un valor seleccionable.
export const CARGO_OPTIONS: string[] = [
  // Operativo
  'Obrero',
  'Operador de equipo',
  'Operador de planta',
  'Operador de campo',
  'Operador de producción',
  'Operador de mantenimiento',
  'Operador de turno',
  'Operador de planta compresora',
  'Técnico de mantenimiento',
  'Técnico electricista',
  'Técnico instrumentista',
  'Técnico mecánico',
  'Técnico de instrumentos',
  'Técnico de procesos',
  'Técnico de operaciones',
  'Técnico de servicios',
  'Técnico de seguridad',
  'Auxiliar',
  'Ayudante',
  'Mecánico',
  'Soldador',
  'Electricista',
  'Tubero',
  'Lantero',
  // Táctico
  'Supervisor',
  'Supervisor de turno',
  'Supervisor de operaciones',
  'Supervisor de mantenimiento',
  'Supervisor de seguridad',
  'Supervisor de producción',
  'Supervisor de campo',
  'Supervisor administrativo',
  'Capataz',
  'Maestro mecánico',
  'Maestro electricista',
  'Maestro de obras',
  'Maestro de mantenimiento',
  'Maestro de planta',
  'Líder de cuadrilla',
  'Coordinador',
  'Coordinador de turno',
  'Coordinador de operaciones',
  'Coordinador administrativo',
  // Profesional
  'Ingeniero de producción',
  'Ingeniero de mantenimiento',
  'Ingeniero de proyectos',
  'Ingeniero de procesos',
  'Ingeniero de perforación',
  'Ingeniero de yacimientos',
  'Ingeniero eléctrico',
  'Ingeniero mecánico',
  'Ingeniero civil',
  'Ingeniero de instrumentación',
  'Ingeniero de seguridad',
  'Ingeniero de calidad',
  'Ingeniero ambiental',
  'Ingeniero de planificación',
  'Ingeniero de operaciones',
  'Médico',
  'Enfermero(a)',
  'Psicólogo(a)',
  'Trabajador(a) social',
  'Analista administrativo',
  'Analista de recursos humanos',
  'Analista de planificación',
  'Analista de presupuesto',
  'Analista de costos',
  'Analista de compras',
  'Analista de sistemas',
  'Contador(a)',
  'Auditor(a)',
  'Abogado(a)',
  'Administrador(a)',
  'Economista',
  'Sociólogo(a)',
  'Comunicador(a) social',
  'Periodista',
  'Relacionista industrial',
  // Gerencial
  'Gerente',
  'Gerente de distrito',
  'Gerente general',
  'Gerente de operaciones',
  'Gerente de mantenimiento',
  'Gerente administrativo',
  'Gerente de seguridad',
  'Gerente de recursos humanos',
  'Gerente de finanzas',
  'Gerente de planificación',
  'Gerente de proyectos',
  'Jefe de departamento',
  'Jefe de división',
  'Jefe de unidad',
  'Coordinador general',
  'Director',
  'Director ejecutivo',
  'Superintendente',
  'Superintendente de operaciones',
  'Superintendente de mantenimiento',
  // Ejecutivo alto
  'Vicepresidente',
  'Presidente',
  'Director General',
  'Gerente General de División',
  'Gerente Corporativo',
];

// Opciones del campo "Soy socio activo de CACREF" en el formulario público.
export const SOCIO_OPTIONS: { value: 'si' | 'no' | 'en_proceso'; label: string }[] = [
  { value: 'si', label: 'Sí, soy socio activo con cuota al día' },
  { value: 'no', label: 'No, pero estoy en proceso de afiliación' },
  { value: 'no', label: 'No, no estoy afiliado' },
];

// Helpers para queries: extracción de valor en cascada.
export function getDirectionsForVP(vp: string | null | undefined): string[] {
  if (!vp) return [];
  return DIRECTIONS_BY_VP[vp] ?? [''];
}
