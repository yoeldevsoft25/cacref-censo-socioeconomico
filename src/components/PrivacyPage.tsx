import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Lock, Trash2, Download, Database, AlertCircle, Mail, Clock } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-4">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-700">Cumplimiento LOPDP</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight">
            Politica de Privacidad y Tratamiento de Datos
          </h1>
          <p className="mt-3 text-sm text-slate-500">Ultima actualizacion: julio 2026</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8">
          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Database className="w-5 h-5 text-red-600" />
              1. Responsable del tratamiento
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              <strong>CACREF</strong> (Cooperativa de Ahorro y Credito de la Federacion Unitaria de Trabajadores del Petroleo, del Gas, sus Similares y Derivados de Venezuela), identificada con RIF J-00214555-3, con sede principal en el Edificio FUTPV, Los Caobos, Caracas, Distrito Capital, es la responsable del tratamiento de los datos personales recolectados a traves de este sistema.
            </p>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">
              <strong>Responsable de proteccion de datos:</strong> Oficina de Cumplimiento CACREF
              <br />
              <strong>Correo de contacto:</strong> protecciondedatos@cacref.example.com
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5 text-red-600" />
              2. Finalidad del tratamiento
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Los datos personales y de salud recolectados a traves del censo socioeconomico seran utilizados exclusivamente para:
            </p>
            <ul className="text-sm text-slate-700 list-disc pl-5 mt-2 space-y-1">
              <li>Diagnostico socioeconomico de los trabajadores, afiliados y familiares de CACREF</li>
              <li>Identificacion de necesidades de salud, medicamentos cronicos y procedimientos quirurgicos</li>
              <li>Priorizacion administrativa de apoyos y beneficios</li>
              <li>Planificacion de programas de bienestar social y recreativo</li>
              <li>Cumplimiento de obligaciones legales y contractuales de CACREF</li>
              <li>Generacion de estadisticas agregadas anonimas para la junta directiva</li>
            </ul>
            <p className="text-sm text-slate-700 leading-relaxed mt-3">
              <strong>NO se usaran para:</strong> decisiones medicas automaticas, scoring crediticio externo, mercadeo, ni compartirse con terceros sin consentimiento expreso.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-600" />
              3. Base legal del tratamiento
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              El tratamiento se ampara en el <strong>consentimiento libre, expreso e informado</strong> del titular, conforme al articulo 12 y siguientes de la Ley Organica de Proteccion de Datos Personales (LOPDP, Gaceta Oficial 6.079 Extraordinario del 24-11-2021).
            </p>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">
              Para datos de salud (sensibles conforme al articulo 5 de la LOPDP), se requiere consentimiento expreso y por escrito, el cual se obtiene mediante el checkbox de aceptacion al momento de enviar el formulario.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Database className="w-5 h-5 text-red-600" />
              4. Datos recolectados
            </h2>
            <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
              <li><strong>Identificacion:</strong> nombre y apellido, cedula, telefono, correo electronico</li>
              <li><strong>Vinculacion institucional:</strong> gerencia, unidad operativa, cargo, anos de servicio</li>
              <li><strong>Situacion socioeconomica:</strong> ingreso individual y familiar, capacidad de aporte</li>
              <li><strong>Salud (sensibles):</strong> requerimiento de medicamentos, cirugias, asistencia familiar, calidad de vida autoevaluada</li>
              <li><strong>Documentos adjuntos:</strong> copia de cedula, recetas medicas, informes (cuando aplica)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              5. Medidas de seguridad
            </h2>
            <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
              <li>Contrasenas hasheadas con bcrypt (cost factor 10)</li>
              <li>Sesiones con tokens firmados HMAC SHA-256, expiracion por inactividad a 30 minutos</li>
              <li>Cookies HTTPOnly, SameSite=Strict, Secure en produccion</li>
              <li>Acceso segmentado por roles: capturista, vocal, presidente, director</li>
              <li>Bitacora inmutable de todas las acciones administrativas (audit log)</li>
              <li>Rate limiting en login y envio de formularios (proteccion brute force)</li>
              <li>Headers de seguridad: CSP, HSTS, X-Frame-Options, X-Content-Type-Options</li>
              <li>Archivos almacenados con nombres aleatorios; acceso restringido al personal autorizado</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-600" />
              6. Plazo de conservacion
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Los datos se conservaran mientras dure la relacion del titular con CACREF y hasta <strong>5 anos adicionales</strong> despues de su desvinculacion, para efectos de trazabilidad administrativa. Pasado este plazo, los datos seran anonimizados para fines estadisticos.
            </p>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">
              Los registros de auditoria se conservan por <strong>10 anos</strong> conforme a las buenas practicas de conservacion documental.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5 text-red-600" />
              7. Derechos ARCO (Acceso, Rectificacion, Cancelacion, Oposicion)
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              Conforme a los articulos 23 a 28 de la LOPDP, todo titular tiene derecho a:
            </p>
            <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1.5">
              <li><strong>Acceso:</strong> conocer que datos tenemos sobre usted y como los usamos</li>
              <li><strong>Rectificacion:</strong> corregir datos inexactos o incompletos</li>
              <li><strong>Cancelacion:</strong> solicitar la eliminacion de sus datos cuando ya no sean necesarios</li>
              <li><strong>Oposicion:</strong> oponerse a tratamientos especificos</li>
              <li><strong>Portabilidad:</strong> recibir una copia de sus datos en formato portable (JSON)</li>
            </ul>
            <p className="text-sm text-slate-700 leading-relaxed mt-3">
              <strong>Como ejercerlos:</strong>
            </p>
            <ol className="text-sm text-slate-700 list-decimal pl-5 space-y-1 mt-1">
              <li>Vaya a la seccion <Link to="/consulta" className="text-red-600 underline">Consulta de estado</Link> e ingrese su cedula</li>
              <li>Use los botones "Descargar mis datos" o "Solicitar eliminacion" disponibles ahi</li>
              <li>O envie un correo a protecciondedatos@cacref.example.com con su cedula y solicitud</li>
            </ol>
            <p className="text-sm text-slate-700 leading-relaxed mt-3">
              <strong>Plazo de respuesta:</strong> 15 dias habiles conforme al articulo 31 de la LOPDP.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Database className="w-5 h-5 text-red-600" />
              8. Transferencias internacionales
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              CACREF <strong>no realiza transferencias internacionales</strong> de datos personales. Los datos se almacenan en servidores dentro del territorio de la Republica Bolivariana de Venezuela.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              9. Notificacion de incidentes de seguridad
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              En caso de incidente que afecte sus datos personales, CACREF notificara a los titulares afectados y a la Superintendencia de Proteccion de Datos Personales dentro de los plazos establecidos en el articulo 34 de la LOPDP.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Mail className="w-5 h-5 text-red-600" />
              10. Autoridad de control
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              La autoridad de control en materia de proteccion de datos personales en Venezuela es la <strong>Superintendencia de Proteccion de Datos Personales</strong> (creada por la LOPDP). El titular puede presentar quejas ante esta autoridad una vez agotado el recurso interno ante CACREF.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Download className="w-5 h-5 text-red-600" />
              11. Marco legal aplicable
            </h2>
            <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1 mb-3">
              <li>Constitucion de la Republica Bolivariana de Venezuela (art. 28, 60, 61, 143)</li>
              <li>Ley Organica de Proteccion de Datos Personales - LOPDP (Gaceta Oficial 6.079 Ext. del 24-11-2021)</li>
              <li>Ley del Infogobierno (Gaceta Oficial 6.806 Ext. del 22-08-2024)</li>
              <li>Ley Organica de Salud (art. 53: confidencialidad de datos de salud)</li>
              <li>Ley Organica del Trabajo, los Trabajadores y las Trabajadoras - LOTTT (art. 56: prohibicion de divulgacion)</li>
              <li>Ley Contra la Corrupcion (art. 91: uso indebido de datos)</li>
              <li>Codigo Civil Venezolano (arts. 1.133 y 1.165)</li>
              <li>Decretos y resoluciones de la Superintendencia de Proteccion de Datos Personales</li>
            </ul>
            <Link
              to="/legal"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-800"
            >
              <Download className="w-3.5 h-3.5" />
              Ver marco legal completo y analisis por articulo
            </Link>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              12. Revocacion del consentimiento
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Usted puede revocar su consentimiento en cualquier momento sin efectos retroactivos. La revocacion no afectara la licitud del tratamiento previo. Para revocar, contactenos a protecciondedatos@cacref.example.com.
            </p>
          </section>

          <div className="text-center text-xs text-slate-400 pt-6 border-t border-slate-200">
            <p>Documento generado conforme a la LOPDP Venezuela 2021</p>
            <p className="mt-1">CACREF &middot; Censo Socioeconomico y de Salud &middot; 2026</p>
            <Link to="/legal" className="inline-flex items-center gap-1.5 mt-3 text-red-700 hover:text-red-800 font-semibold">
              <Download className="w-3.5 h-3.5" />
              Ver marco legal y normativo completo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
