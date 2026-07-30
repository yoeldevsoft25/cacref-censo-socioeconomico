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

const UNIDADES = ['Norte', 'Sur', 'Oriental', 'Occidental', 'Central'];

const CARGOS = ['Operador', 'Tecnico', 'Supervisor', 'Analista', 'Especialista', 'Coordinador', 'Profesional Asociado', 'Asistente Administrativo', 'Jefe de Unidad', 'Gerente'];

const NOMBRES = ['Juan', 'Maria', 'Carlos', 'Ana', 'Luis', 'Pedro', 'Jose', 'Rosa', 'Carmen', 'Miguel', 'Jorge', 'Patricia', 'Daniela', 'Andres', 'Sofia', 'Eduardo', 'Gabriela', 'Francisco', 'Isabel', 'Manuel', 'Laura', 'Ricardo', 'Teresa', 'Rafael', 'Beatriz', 'Alejandro', 'Monica', 'Roberto', 'Cristina'];
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
  'Madre de 78 años con diabetes y movilidad reducida',
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
    const quota = Math.round(individual * 0.02 * 100) / 100;

    records.push({
      nombre_apellido: `${rand(NOMBRES)} ${rand(APELLIDOS)} ${rand(APELLIDOS)}`,
      cedula,
      telefono: `04${randInt(12, 26)}${randInt(1000000, 9999999)}`,
      correo: `${rand(NOMBRES).toLowerCase()}.${rand(APELLIDOS).toLowerCase()}${i}@pdvsa.com.ve`,
      region_sede: rand(['Caracas', 'Maracaibo', 'Valencia', 'Puerto La Cruz', 'Barinas', 'Maturin']),
      vicepresidencia: ger.vp,
      direccion_ejecutiva: ger.dir,
      gerencia: ger.gerencia,
      unidad_operativa: `Unidad ${rand(UNIDADES)}`,
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
    capacidad_cuota: 17,
    requiere_medicamento_cronico: true,
    medicamento_detalle: 'Losartan 50mg diario para hipertension + Atorvastatina 40mg',
    requiere_cirugia: true,
    cirugia_detalle: 'Cardiaca: cateterismo pendiente',
    familiar_requiere_asistencia: true,
    calidad_vida_escala: 2,
  };

  return records;
}
