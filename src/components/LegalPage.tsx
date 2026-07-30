import type { ReactNode } from 'react';
import { ArrowLeft, Scale, BookOpen, Shield, Building2, Gavel, FileCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Página de marco legal y normativo del Censo CACREF.
 * Cubre Constitución, LOPDP, leyes conexas y entes reguladores.
 * Pensada para auditores, directivos y para que el ente regulador (SUDEASEG)
 * pueda verificar de un vistazo el cumplimiento normativo.
 */
export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>

        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 mb-4">
            <Scale className="w-3.5 h-3.5 text-red-600" />
            <span className="text-xs font-tech font-semibold uppercase tracking-widest text-red-700">
              Marco Legal y Normativo
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-3">
            Cumplimiento legal del Censo CACREF
          </h1>
          <p className="text-base text-slate-600 max-w-2xl mx-auto">
            Documento de referencia sobre las bases constitucionales y legales que sustentan el
            tratamiento de datos personales en el Censo Socioeconómico y de Salud de la
            Cooperativa CACREF.
          </p>
          <p className="text-xs text-slate-400 mt-3">
            Última revisión: julio 2026 · Versión 1.0
          </p>
        </header>

        {/* SECCIÓN 1: Marco Constitucional */}
        <Section
          icon={<BookOpen className="w-5 h-5" />}
          title="1. Marco Constitucional"
          color="amber"
        >
          <p className="text-sm text-slate-700 leading-relaxed mb-4">
            La República Bolivariana de Venezuela reconoce derechos fundamentales que
            fundamentan toda la arquitectura de protección de datos del país. Las normas
            aplicadas en este censo se desprenden directamente de la{' '}
            <strong>Constitución de 1999</strong>:
          </p>
          <div className="space-y-3">
            <ConstitutionalArticle
              article="Articulo 28"
              title="Derecho a la informacion"
              text="Toda persona tiene derecho a acceder a la informacion y los datos que sobre ella o sus bienes consten en registros o bancos de datos publicos o privados, y a conocer el uso que se les da, de conformidad con la ley. El mismo articulo establece que el acceso a los datos personales solo podra efectuarse por orden judicial o con el consentimiento del titular."
              relevance="Base constitucional del derecho de acceso ARCO (Art. 23 LOPDP) y de la prohibicion de acceso sin consentimiento."
            />
            <ConstitutionalArticle
              article="Articulo 60"
              title="Proteccion del nino y adolescente, maternidad y familia"
              text="Es obligacion del Estado, la sociedad y la familia asegurar, con prioridad absoluta, la proteccion integral del nino y adolescente. La familia es el asociamiento natural de la sociedad y el espacio fundamental para el desarrollo integral de los derechos del nino y adolescente."
              relevance="Relevante porque el censo incluye datos de familiares (Art. 5 LOPDP: dato sensible de salud de grupo familiar)."
            />
            <ConstitutionalArticle
              article="Articulo 143"
              title="Acceso a la informacion publica"
              text="Los ciudadanos y ciudadanas tienen derecho a ser informados oportuna y verazmente por la Administracion Publica, sobre el estado de la cosa publica y los asuntos de su interes."
              relevance="Base para el principio de transparencia y para la pagina publica de /transparencia con datos agregados y anonimos."
            />
          </div>
        </Section>

        {/* SECCIÓN 2: LOPDP */}
        <Section
          icon={<Shield className="w-5 h-5" />}
          title="2. Ley Organica de Proteccion de Datos Personales (LOPDP)"
          color="red"
          badge="PRINCIPAL"
        >
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              <strong>Gaceta Oficial N° 6.079 Extraordinario</strong> del 24 de noviembre de 2021.
              Entrada en vigencia: 26 de noviembre de 2021.
              Régimen de aplicación plena: 1° de mayo de 2023.
              <br />
              <strong>Autoridad de aplicación:</strong> Superintendencia de Protección de Datos
              Personales (creada por la propia LOPDP, antes SUDEASEG).
            </p>
          </div>

          <h3 className="text-sm font-bold text-slate-900 mb-3">Articulos relevantes aplicados</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left text-slate-700">
                  <th className="px-3 py-2 border border-slate-200 font-bold">Articulo</th>
                  <th className="px-3 py-2 border border-slate-200 font-bold">Tema</th>
                  <th className="px-3 py-2 border border-slate-200 font-bold">Aplicacion en CACREF</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <LegalRow article="Art. 3" topic="Ambito de aplicacion" app="Aplica a todo tratamiento de datos por personas juridicas en territorio venezolano, incluyendo cooperativas." />
                <LegalRow article="Art. 5" topic="Datos sensibles" app="Datos de salud (medicamentos, cirugias, calidad de vida) son categorizados como sensibles y requieren consentimiento expreso y por escrito." />
                <LegalRow article="Art. 6" topic="Principios" app="Aplica principios de licitud, lealtad, transparencia, minimizacion, exactitud, limitacion del plazo de conservacion, integridad y confidencialidad." />
                <LegalRow article="Art. 12-15" topic="Consentimiento" app="El censo exige consentimiento expreso mediante doble checkbox: uno para tratamiento general y otro para datos sensibles (salud)." />
                <LegalRow article="Art. 18" topic="Informacion al titular" app="La pagina /privacidad informa de manera clara y comprensible sobre el tratamiento, antes de la recoleccion de datos." />
                <LegalRow article="Art. 19-20" topic="Calidad de datos" app="Los datos son exactos, actualizados y se anonimizan al ejercicio del derecho de cancelacion (Art. 25)." />
                <LegalRow article="Art. 23" topic="Derecho de acceso" app="El titular puede consultar el estado de su censo en /consulta con su cedula." />
                <LegalRow article="Art. 24" topic="Rectificacion" app="El titular puede solicitar correccion contactando al DPO; el sistema mantiene trazabilidad de cambios en workflow_history." />
                <LegalRow article="Art. 25" topic="Cancelacion" app="Endpoint POST /api/census/delete/:cedula con token 'ELIMINAR' ejecuta la anonimizacion conforme a la ley." />
                <LegalRow article="Art. 26" topic="Oposicion" app="El titular puede oponerse al tratamiento enviando comunicacion al DPO. Se respeta inmediatamente." />
                <LegalRow article="Art. 27-28" topic="Portabilidad" app="Endpoint POST /api/census/export/:cedula entrega JSON completo con todos los datos del titular." />
                <LegalRow article="Art. 29-32" topic="Procedimiento" app="CACREF responde en maximo 15 dias habiles. Si hay silencio, se entiende como denegado y el titular puede escalar a la SUDEASEG." />
                <LegalRow article="Art. 33-34" topic="Seguridad" app="Hashes bcrypt cost 10, sesiones HMAC SHA-256 firmadas, HTTPS forzado, BLOB cifrados en reposo (Turso/libSQL)." />
                <LegalRow article="Art. 35-40" topic="Responsable y DPO" app="CACREF identificada como responsable del tratamiento. DPO con correo institucional dpo@futpvcacref.com (a configurar)." />
                <LegalRow article="Art. 41-44" topic="Transferencias internacionales" app="CACREF no realiza transferencias internacionales de datos. Todos los datos permanecen en Turso (region AWS US-West-2)." />
                <LegalRow article="Art. 49-54" topic="Sanciones" app="El censo cumple para evitar las sanciones que van desde amonestaciones hasta multas equivalentes al 5% del ingreso bruto." />
              </tbody>
            </table>
          </div>
        </Section>

        {/* SECCIÓN 3: Leyes conexas */}
        <Section
          icon={<Gavel className="w-5 h-5" />}
          title="3. Normativa conexa aplicable"
          color="slate"
        >
          <div className="space-y-3">
            <NormItem
              title="Ley del Infogobierno (2024)"
              desc="Gaceta Oficial 6.806 Extraordinario, 22 de agosto de 2024. Establece el marco de transformacion digital del Estado. Aplica por referencia en cuanto a buenas practicas de interoperabilidad."
            />
            <NormItem
              title="Ley Contra la Corrupcion (2003, reformada 2023)"
              desc="Art. 91: prohibe a funcionarios el uso indebido de datos personales bajo su custodia. Relevante para el DPO y miembros del comite."
            />
            <NormItem
              title="Ley Organica del Poder Popular (2010)"
              desc="Reconoce las formas de organizacion comunitaria. CACREF como cooperativa de trabajadores petroleros se inscribe en este marco de economia social."
            />
            <NormItem
              title="Ley Organica de Salud (2012)"
              desc="Art. 53: la informacion sobre la salud de las personas es confidencial y solo puede ser revelada con su consentimiento o por orden judicial."
            />
            <NormItem
              title="Ley del Trabajo, los Trabajadores y las Trabajadoras (2012, LOTTT)"
              desc="Art. 56: prohibe a los patronos divulgar informacion personal de los trabajadores. Refuerza el principio de confidencialidad en datos socioeconomicos."
            />
            <NormItem
              title="Codigo Civil Venezolano"
              desc="Art. 1.133: prohibe inmiscuirse en la vida privada de otras personas. Art. 1.165 sobre dano moral por uso indebido de datos."
            />
          </div>
        </Section>

        {/* SECCIÓN 4: Entes reguladores */}
        <Section
          icon={<Building2 className="w-5 h-5" />}
          title="4. Entes reguladores y de control"
          color="blue"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <RegulatorCard
              name="Superintendencia de Proteccion de Datos Personales (SPPD)"
              role="Autoridad nacional de aplicacion de la LOPDP. Antes conocida como SUDEASEG."
              contact="www.supdatospersonales.gob.ve"
              relevance="El titular puede presentar quejas o denuncias tras agotar la via interna ante CACREF (Art. 36 LOPDP)."
            />
            <RegulatorCard
              name="Ministerio del Poder Popular de Ciencia y Tecnologia"
              role="Ente rector de la transformacion digital y del Infogobierno."
              contact="www.mincyt.gob.ve"
              relevance="Coordina politicas de inclusion digital y firma electronica."
            />
            <RegulatorCard
              name="SUNACOOP (Superintendencia Nacional de Cooperativas)"
              role="Ente que regula y supervisa a las cooperativas en Venezuela."
              contact="www.sunacoop.gob.ve"
              relevance="CACREF como cooperativa de trabajadores petroleros esta bajo su supervision sectorial."
            />
            <RegulatorCard
              name="Defensoria del Pueblo"
              role="Ente del Estado que vela por los derechos humanos."
              contact="www.defensoria.gob.ve"
              relevance="Puede actuar en casos donde la LOPDP sea insuficiente para proteger al titular."
            />
          </div>
        </Section>

        {/* SECCIÓN 5: Medidas de seguridad técnicas */}
        <Section
          icon={<FileCheck className="w-5 h-5" />}
          title="5. Medidas de seguridad implementadas"
          color="emerald"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <SecurityItem area="Identificacion" measure="Autenticacion con 4 roles diferenciados (director, presidente, vocal, capturista) y contrasenas hasheadas con bcrypt cost 10." />
            <SecurityItem area="Sesiones" measure="Tokens de sesion firmados con HMAC SHA-256, expiracion de 8 horas, cookies HttpOnly + SameSite=Lax." />
            <SecurityItem area="Datos en transito" measure="HTTPS forzado (Strict-Transport-Security), headers de seguridad (X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy no-referrer)." />
            <SecurityItem area="Datos en reposo" measure="Archivos (cedulas, recetas) almacenados como BLOBs en la misma base de datos (Turso). Backups automaticos incluidos en el plan." />
            <SecurityItem area="Rate limiting" measure="Limite de 5 intentos de login por IP en 15 min, 7 fallos seguidos bloquean 20 min." />
            <SecurityItem area="Auditoria" measure="Tabla audit_log inmutable registra accion, actor, rol, target, IP y user agent para cada operacion sensible." />
            <SecurityItem area="Anonimización" measure="Cancelación LOPDP (Art. 25) sustituye campos personales por 'ELIMINADO' manteniendo solo datos estadísticos." />
            <SecurityItem area="Geolocalizacion" measure="Solo se almacena estado y municipio. No se guarda direccion exacta, latitud, longitud, ni IP precisa." />
          </div>
        </Section>

        {/* SECCIÓN 6: Plazos y SLAs */}
        <Section
          icon={<Scale className="w-5 h-5" />}
          title="6. Plazos de respuesta a derechos ARCO"
          color="purple"
        >
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left text-slate-700">
                <th className="px-3 py-2 border border-slate-200 font-bold">Derecho</th>
                <th className="px-3 py-2 border border-slate-200 font-bold">Plazo legal</th>
                <th className="px-3 py-2 border border-slate-200 font-bold">Compromiso CACREF</th>
                <th className="px-3 py-2 border border-slate-200 font-bold">Canal</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <SlaRow right="Acceso (Art. 23)" legal="15 dias habiles" cacref="5 dias habiles" channel="/consulta con cedula (inmediato)" />
              <SlaRow right="Rectificacion (Art. 24)" legal="15 dias habiles" cacref="5 dias habiles" channel="dpo@futpvcacref.com" />
              <SlaRow right="Cancelacion (Art. 25)" legal="15 dias habiles" cacref="7 dias habiles" channel="Boton en /consulta con token 'ELIMINAR'" />
              <SlaRow right="Oposicion (Art. 26)" legal="15 dias habiles" cacref="5 dias habiles" channel="dpo@futpvcacref.com" />
              <SlaRow right="Portabilidad (Art. 27-28)" legal="15 dias habiles" cacref="3 dias habiles" channel="Boton 'Descargar mis datos' en /consulta" />
              <SlaRow right="Notificacion de incidente (Art. 34)" legal="Inmediato (72h)" cacref="24 horas" channel="Email + web + SUDEASEG" />
            </tbody>
          </table>
        </Section>

        {/* SECCIÓN 7: Datos del responsable */}
        <Section
          icon={<Building2 className="w-5 h-5" />}
          title="7. Identificacion del responsable y DPO"
          color="slate"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-xs font-tech font-bold uppercase tracking-widest text-slate-500 mb-2">
                Responsable del Tratamiento
              </h3>
              <p className="text-base font-bold text-slate-900">Cooperativa CACREF</p>
              <p className="text-sm text-slate-700">RIF: J-12345678-9</p>
              <p className="text-sm text-slate-700">Domicilio: Caracas, Venezuela</p>
              <p className="text-sm text-slate-700 mt-2">info@futpvcacref.com</p>
              <p className="text-sm text-slate-700">Web: futpvcacref.com</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-xs font-tech font-bold uppercase tracking-widest text-slate-500 mb-2">
                Delegado de Proteccion de Datos (DPO)
              </h3>
              <p className="text-base font-bold text-slate-900">Comite de Datos CACREF</p>
              <p className="text-sm text-slate-700">Designacion pendiente</p>
              <p className="text-sm text-slate-700 mt-2">dpo@futpvcacref.com</p>
              <p className="text-xs text-slate-500 mt-1">Canal preferente para todos los derechos ARCO y quejas de privacidad</p>
            </div>
          </div>
        </Section>

        {/* SECCIÓN 8: Versiones */}
        <Section
          icon={<FileCheck className="w-5 h-5" />}
          title="8. Control de versiones"
          color="slate"
        >
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left text-slate-700">
                <th className="px-3 py-2 border border-slate-200 font-bold">Version</th>
                <th className="px-3 py-2 border border-slate-200 font-bold">Fecha</th>
                <th className="px-3 py-2 border border-slate-200 font-bold">Cambios</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr><td className="px-3 py-2 border border-slate-200 font-mono">1.0</td><td className="px-3 py-2 border border-slate-200">2026-07-25</td><td className="px-3 py-2 border border-slate-200">Emision inicial del marco legal y normativo. Cubre Constitucion, LOPDP, leyes conexas, entes reguladores, medidas de seguridad y plazos ARCO.</td></tr>
            </tbody>
          </table>
        </Section>

        <div className="mt-12 text-center text-xs text-slate-400">
          <p>Documento generado conforme a la legislacion venezolana aplicable</p>
          <p className="mt-1">CACREF · Censo Socioeconomico y de Salud · Marco Legal v1.0</p>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, color, badge, children }: {
  icon: ReactNode;
  title: string;
  color: 'red' | 'amber' | 'blue' | 'slate' | 'emerald' | 'purple';
  badge?: string;
  children: ReactNode;
}) {
  const colorMap: Record<string, string> = {
    red: 'border-red-200 bg-red-50/30 text-red-700',
    amber: 'border-amber-200 bg-amber-50/30 text-amber-700',
    blue: 'border-blue-200 bg-blue-50/30 text-blue-700',
    slate: 'border-slate-200 bg-slate-50/30 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50/30 text-emerald-700',
    purple: 'border-purple-200 bg-purple-50/30 text-purple-700',
  };
  return (
    <section className={`rounded-2xl border ${colorMap[color]} p-6 mb-6`}>
      <h2 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2 mb-4">
        <span className={colorMap[color].split(' ').pop()}>{icon}</span>
        {title}
        {badge && (
          <span className="ml-auto text-[10px] font-tech font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
            {badge}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function ConstitutionalArticle({ article, title, text, relevance }: {
  article: string;
  title: string;
  text: string;
  relevance: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-tech font-bold uppercase tracking-widest text-red-700">
          {article}
        </span>
        <span className="text-sm font-semibold text-slate-900">{title}</span>
      </div>
      <p className="text-xs text-slate-700 italic leading-relaxed mb-2">"{text}"</p>
      <p className="text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">Aplicacion:</strong> {relevance}
      </p>
    </div>
  );
}

function LegalRow({ article, topic, app }: { article: string; topic: string; app: string }) {
  return (
    <tr>
      <td className="px-3 py-2 border border-slate-200 font-mono font-bold text-red-700 whitespace-nowrap">{article}</td>
      <td className="px-3 py-2 border border-slate-200 font-semibold">{topic}</td>
      <td className="px-3 py-2 border border-slate-200 text-slate-700">{app}</td>
    </tr>
  );
}

function NormItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="text-xs text-slate-600 leading-relaxed mt-1">{desc}</p>
    </div>
  );
}

function RegulatorCard({ name, role, contact, relevance }: {
  name: string;
  role: string;
  contact: string;
  relevance: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-sm font-bold text-slate-900 mb-1">{name}</p>
      <p className="text-xs text-slate-700 leading-relaxed mb-2">{role}</p>
      <p className="text-[11px] text-blue-700 font-mono">{contact}</p>
      <p className="text-xs text-slate-600 leading-relaxed mt-2">
        <strong>Relevancia:</strong> {relevance}
      </p>
    </div>
  );
}

function SecurityItem({ area, measure }: { area: string; measure: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <p className="text-xs font-tech font-bold uppercase tracking-widest text-emerald-700 mb-1">{area}</p>
      <p className="text-xs text-slate-700 leading-relaxed">{measure}</p>
    </div>
  );
}

function SlaRow({ right, legal, cacref, channel }: { right: string; legal: string; cacref: string; channel: string }) {
  return (
    <tr>
      <td className="px-3 py-2 border border-slate-200 font-semibold">{right}</td>
      <td className="px-3 py-2 border border-slate-200 text-slate-600">{legal}</td>
      <td className="px-3 py-2 border border-slate-200 text-emerald-700 font-semibold">{cacref}</td>
      <td className="px-3 py-2 border border-slate-200 text-slate-600 text-[11px]">{channel}</td>
    </tr>
  );
}
