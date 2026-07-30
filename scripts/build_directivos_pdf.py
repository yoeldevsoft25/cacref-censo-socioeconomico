from __future__ import annotations

import sqlite3
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DB_PATH = ROOT / "census.db"
PDF_OUT = DOCS / "CACREF_Salud_Propuesta_Directivos.pdf"
LOGO_CACREF = ROOT / "public" / "Logo_Original.png"
LOGO_FUTPV = ROOT / "public" / "logo2.jpeg"
FONT_PATH = Path("C:/Windows/Fonts/arial.ttf")
BOLD_FONT_PATH = Path("C:/Windows/Fonts/arialbd.ttf")

NAVY = colors.HexColor("#0F2340")
BLUE = colors.HexColor("#2E74B5")
RED = colors.HexColor("#BE123C")
GRAY = colors.HexColor("#5B687C")
LIGHT_BLUE = colors.HexColor("#E8EEF5")
LIGHT_GRAY = colors.HexColor("#F4F6F9")
LIGHT_RED = colors.HexColor("#FDEEEF")
BORDER = colors.HexColor("#D7DEE8")


def register_fonts():
    if FONT_PATH.exists() and BOLD_FONT_PATH.exists():
        pdfmetrics.registerFont(TTFont("CACREF", str(FONT_PATH)))
        pdfmetrics.registerFont(TTFont("CACREF-Bold", str(BOLD_FONT_PATH)))
        return "CACREF", "CACREF-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def get_metrics() -> dict:
    fallback = {
        "total": 0,
        "medicamentos": 0,
        "cirugias": 0,
        "familiares": 0,
        "alto": 0,
        "medio": 0,
        "bajo": 0,
        "score_promedio": 0,
        "calidad_promedio": 0,
        "aporte_promedio": 0,
    }
    if not DB_PATH.exists():
        return fallback
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            """
            SELECT
              COUNT(*) total,
              SUM(CASE WHEN requiere_medicamento_cronico = 1 THEN 1 ELSE 0 END) medicamentos,
              SUM(CASE WHEN requiere_cirugia = 1 THEN 1 ELSE 0 END) cirugias,
              SUM(CASE WHEN familiar_requiere_asistencia = 1 THEN 1 ELSE 0 END) familiares,
              SUM(CASE WHEN risk_level = 'ALTO' THEN 1 ELSE 0 END) alto,
              SUM(CASE WHEN risk_level = 'MEDIO' THEN 1 ELSE 0 END) medio,
              SUM(CASE WHEN risk_level = 'BAJO' THEN 1 ELSE 0 END) bajo,
              ROUND(AVG(score), 2) score_promedio,
              ROUND(AVG(calidad_vida_escala), 2) calidad_promedio,
              ROUND(AVG(capacidad_cuota), 2) aporte_promedio
            FROM census_submissions
            """
        ).fetchone()
    result = dict(fallback)
    result.update({k: row[k] if row[k] is not None else 0 for k in row.keys()})
    return result


def styles():
    base = getSampleStyleSheet()
    base.add(
        ParagraphStyle(
            name="CoverTitle",
            parent=base["Title"],
            fontName=FONT_BOLD,
            fontSize=31,
            leading=35,
            textColor=NAVY,
            alignment=TA_CENTER,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            name="CoverSubtitle",
            parent=base["Normal"],
            fontName=FONT,
            fontSize=13,
            leading=18,
            textColor=GRAY,
            alignment=TA_CENTER,
            spaceAfter=18,
        )
    )
    base.add(
        ParagraphStyle(
            name="H1X",
            parent=base["Heading1"],
            fontName=FONT_BOLD,
            fontSize=17,
            leading=21,
            textColor=BLUE,
            spaceBefore=8,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            name="H2X",
            parent=base["Heading2"],
            fontName=FONT_BOLD,
            fontSize=12.5,
            leading=15,
            textColor=NAVY,
            spaceBefore=7,
            spaceAfter=5,
        )
    )
    base.add(
        ParagraphStyle(
            name="BodyX",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=10.4,
            leading=14,
            textColor=colors.HexColor("#1F2937"),
            spaceAfter=7,
            alignment=TA_LEFT,
        )
    )
    base.add(
        ParagraphStyle(
            name="SmallX",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=8.8,
            leading=11.5,
            textColor=GRAY,
            spaceAfter=4,
        )
    )
    base.add(
        ParagraphStyle(
            name="BulletX",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=10.1,
            leading=13,
            leftIndent=14,
            firstLineIndent=-8,
            textColor=colors.HexColor("#1F2937"),
            spaceAfter=4,
        )
    )
    base.add(
        ParagraphStyle(
            name="CalloutTitle",
            parent=base["BodyText"],
            fontName=FONT_BOLD,
            fontSize=10.6,
            leading=13,
            textColor=NAVY,
            spaceAfter=3,
        )
    )
    return base


S = styles()


def p(text: str, style="BodyX"):
    return Paragraph(text, S[style])


def bullet(text: str):
    return p(f"• {text}", "BulletX")


def callout(title: str, body: str, fill=LIGHT_BLUE):
    content = [[p(title, "CalloutTitle"), p(body, "BodyX")]]
    t = Table(content, colWidths=[1.55 * inch, 5.0 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return KeepTogether([t, Spacer(1, 7)])


def matrix(headers, rows, widths, header_fill=LIGHT_GRAY):
    data = [[p(h, "CalloutTitle") for h in headers]]
    for row in rows:
        data.append([p(str(value), "SmallX") for value in row])
    t = Table(data, colWidths=[w * inch for w in widths], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), header_fill),
        ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.55, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    t.setStyle(TableStyle(style))
    return KeepTogether([t, Spacer(1, 8)])


def metric_strip(items):
    data = [[]]
    for label, value, fill in items:
        data[0].append(
            Paragraph(
                f"<font name='{FONT_BOLD}' size='17' color='#0F2340'>{value}</font><br/><font name='{FONT_BOLD}' size='7.8' color='#5B687C'>{label}</font>",
                S["BodyX"],
            )
        )
    t = Table(data, colWidths=[6.55 * inch / len(items)] * len(items))
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.55, BORDER),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]
    for idx, (_, _, fill) in enumerate(items):
        commands.append(("BACKGROUND", (idx, 0), (idx, 0), fill))
    t.setStyle(TableStyle(commands))
    return KeepTogether([t, Spacer(1, 10)])


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.setFillColor(GRAY)
    canvas.drawString(0.72 * inch, 10.45 * inch, "CACREF Salud | Propuesta ejecutiva")
    canvas.drawRightString(7.78 * inch, 10.45 * inch, f"Página {doc.page}")
    canvas.line(0.72 * inch, 10.32 * inch, 7.78 * inch, 10.32 * inch)
    canvas.drawCentredString(4.25 * inch, 0.45 * inch, "Documento de trabajo para directivos CACREF - Uso interno")
    canvas.restoreState()


def logo_row():
    left = Image(str(LOGO_CACREF), width=0.82 * inch, height=0.82 * inch) if LOGO_CACREF.exists() else ""
    right = Image(str(LOGO_FUTPV), width=0.82 * inch, height=0.82 * inch) if LOGO_FUTPV.exists() else ""
    t = Table([[left, right]], colWidths=[3.275 * inch, 3.275 * inch])
    t.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (0, 0), "LEFT"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0, colors.white),
            ]
        )
    )
    return t


def build():
    metrics = get_metrics()
    DOCS.mkdir(exist_ok=True)
    doc = SimpleDocTemplate(
        str(PDF_OUT),
        pagesize=letter,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.7 * inch,
        title="CACREF Salud - Propuesta Directivos",
        author="CACREF",
    )

    story = []
    story.append(logo_row())
    story.append(Spacer(1, 0.55 * inch))
    story.append(p("CACREF Salud", "CoverTitle"))
    story.append(p("Censo socioeconómico, salud y bienestar para colaboradores PDVSA/FUTPV", "CoverSubtitle"))
    story.append(
        callout(
            "Mensaje central",
            "La plataforma permite pasar de una ayuda reactiva y dispersa a una gestión ordenada, auditable y financieramente responsable: ayudar mejor, priorizar con evidencia y construir programas recurrentes sin comprometer el equilibrio económico de CACREF.",
            LIGHT_BLUE,
        )
    )
    story.append(
        metric_strip(
            [
                ("Registros demo", metrics["total"], LIGHT_GRAY),
                ("Medicamentos", metrics["medicamentos"], LIGHT_BLUE),
                ("Cirugías", metrics["cirugias"], LIGHT_RED),
                ("Riesgo alto", metrics["alto"], LIGHT_RED),
            ]
        )
    )
    story.append(p("Preparado para Junta Directiva / Directivos CACREF", "H2X"))
    story.append(p(f"Fecha: {date.today().strftime('%d/%m/%Y')} | Versión ejecutiva", "SmallX"))
    story.append(Spacer(1, 0.18 * inch))
    story.append(p("Decisión solicitada", "H1X"))
    for item in [
        "Aprobar el uso del censo como herramienta institucional de diagnóstico y priorización.",
        "Autorizar un piloto controlado con responsables, reglas de acceso y tablero directivo.",
        "Ratificar aporte base de 2% para inscritos y definir topes, reserva y cálculos posteriores.",
        "Iniciar negociación con proveedores de medicamentos, laboratorios, clínicas y servicios asociados.",
    ]:
        story.append(bullet(item))
    story.append(PageBreak())

    story.append(p("1. Objetivo y norte institucional", "H1X"))
    story.append(
        callout(
            "Objetivo",
            "Crear una base única y confiable para identificar necesidades reales de trabajadores, afiliados CACREF y familiares, priorizar casos por urgencia administrativa y construir programas sostenibles de apoyo.",
            LIGHT_BLUE,
        )
    )
    story.append(
        p(
            "El norte no es entregar ayudas sin control. El norte es combinar solidaridad cooperativa con data, aporte base de 2% para inscritos, convenios y trazabilidad. Los préstamos u otros programas se calculan luego según política, capacidad y aprobación."
        )
    )
    story.append(
        matrix(
            ["Situación actual", "Con CACREF Salud"],
            [
                ["Solicitudes dispersas por llamadas, planillas o mensajes", "Formulario único con datos comparables"],
                ["Decisiones caso a caso con información incompleta", "Scoring administrativo y cola priorizada"],
                ["Poca trazabilidad de revisión y aprobación", "Workflow, auditoría e historial por caso"],
                ["Riesgo de prometer más de lo financiable", "Topes, reserva técnica y decisión por comité"],
            ],
            [3.05, 3.5],
        )
    )
    story.append(p("2. Capacidad ya desplegada", "H1X"))
    for item in [
        "Formulario público de cuatro pasos: identidad, vinculación, economía, salud y calidad de vida.",
        "Dashboard administrativo con KPIs, filtros, detalle de casos, documentos, comentarios y workflow.",
        "Roles diferenciados: capturista, vocal, presidente y director.",
        "Consulta pública por cédula, transparencia agregada y políticas de privacidad.",
        "Backend local y producción: SQLite/Turso, Express/Netlify Functions, autenticación y bitácora.",
    ]:
        story.append(bullet(item))
    story.append(callout("Alcance correcto", "La plataforma no diagnostica, no sustituye evaluación médica y no aprueba beneficios automáticamente. Ordena información y prepara decisiones para el comité.", LIGHT_RED))
    story.append(PageBreak())

    story.append(p("3. Datos, score y lógica de priorización", "H1X"))
    story.append(p("El score es administrativo. Su función es ordenar la cola y transparentar por qué un caso requiere atención antes que otro. La decisión final sigue siendo humana, institucional y documentada."))
    story.append(
        matrix(
            ["Componente", "Uso en la decisión", "Resultado esperado"],
            [
                ["Antigüedad y vinculación", "Reconoce trayectoria y pertenencia cooperativa", "Prioridad con sentido institucional"],
                ["Capacidad de aporte", "Evita cuotas impagables", "Sostenibilidad y menor mora"],
                ["Medicamento crónico", "Identifica necesidad recurrente", "Programas de abastecimiento y convenios"],
                ["Cirugía/procedimiento", "Detecta casos de alto impacto", "Revisión por comité y topes"],
                ["Calidad de vida", "Mide vulnerabilidad percibida", "Semáforo social de bienestar"],
            ],
            [1.55, 2.55, 2.45],
        )
    )
    story.append(p("Salidas del sistema: riesgo bajo/medio/alto, recomendación administrativa, prioridad numérica, cuota máxima sugerida y estado del workflow."))
    story.append(p("4. Lectura de la base de demostración", "H1X"))
    story.append(
        metric_strip(
            [
                ("Total casos", metrics["total"], LIGHT_GRAY),
                ("Riesgo alto", metrics["alto"], LIGHT_RED),
                ("Riesgo medio", metrics["medio"], LIGHT_BLUE),
                ("Riesgo bajo", metrics["bajo"], LIGHT_GRAY),
            ]
        )
    )
    story.append(
        matrix(
            ["Indicador demo", "Valor", "Lectura directiva"],
            [
                ["Medicamentos crónicos", metrics["medicamentos"], "Demanda recurrente que puede negociarse por volumen"],
                ["Cirugías/procedimientos", metrics["cirugias"], "Casos de alto impacto que requieren topes y comité"],
                ["Familiares con asistencia", metrics["familiares"], "Carga familiar que afecta calidad de vida y estabilidad"],
                ["Calidad de vida promedio", metrics["calidad_promedio"], "Línea base para medir mejora trimestral"],
                ["Aporte mensual promedio", metrics["aporte_promedio"], "Referencia para calibrar programas sostenibles"],
            ],
            [2.0, 0.95, 3.6],
        )
    )
    story.append(p("Nota: los datos son de demostración local para validar capacidad operativa; la campaña real debe iniciar con piloto controlado.", "SmallX"))
    story.append(PageBreak())

    story.append(p("5. Modelo recurrente sin números rojos", "H1X"))
    story.append(
        callout(
            "Regla financiera de control",
            "El 2% opera como aporte base de inscritos. Ingresos recurrentes - ayudas directas - costos operativos - reserva técnica >= 0. Préstamos y programas especiales se calculan aparte.",
            LIGHT_BLUE,
        )
    )
    story.append(
        matrix(
            ["Palanca", "Cómo crea valor", "Control de riesgo"],
            [
                ["Aporte base 2%", "Financia operación inicial y reserva", "Base recurrente para inscritos"],
                ["Cálculos posteriores", "Préstamos y programas especiales", "Según capacidad, topes y aprobación"],
                ["Convenios proveedores", "Más casos atendidos con el mismo fondo", "Precios negociados y cupos"],
                ["Fondo solidario", "Cubre casos de alto impacto", "Reserva mínima obligatoria"],
                ["Scoring y workflow", "Evita asignaciones improvisadas", "Comité, SLA y auditoría"],
            ],
            [1.55, 2.5, 2.5],
        )
    )
    story.append(p("6. Ejemplo financiero referencial", "H1X"))
    story.append(
        matrix(
            ["Variable", "Escenario ilustrativo", "Uso directivo"],
            [
                ["Participantes", "1.500 afiliados", "Dimensionar recaudación potencial"],
                ["Aporte base inscritos", "2%", "Referencia institucional recurrente"],
                ["Base promedio ilustrativa", "300 USD equivalentes", "Permite estimar recaudación"],
                ["Aporte resultante", "6 USD equivalentes", "2% de la base ilustrativa"],
                ["Recaudación mensual", "9.000 USD equivalentes", "Techo mensual de gestión"],
                ["Reserva técnica", "20% = 1.800", "Protección contra picos de demanda"],
                ["Operación/plataforma", "10% = 900", "Costo de administrar bien"],
                ["Fondo de ayudas", "6.300", "Monto disponible antes de convenios"],
            ],
            [1.75, 2.15, 2.65],
        )
    )
    story.append(p("El ejemplo no cambia la política: usa 2% como aporte base y deja préstamos o programas especiales para cálculo posterior.", "SmallX"))
    story.append(PageBreak())

    story.append(p("7. Métricas para dirigir el programa", "H1X"))
    story.append(
        matrix(
            ["Categoría", "Indicadores clave"],
            [
                ["Impacto social", "Personas censadas, familias alcanzadas, medicamentos, cirugías, casos resueltos, variación de calidad de vida"],
                ["Gestión operativa", "Tiempo registro-comité, tiempo comité-resolución, SLA vencidos, carga por miembro, documentos completos"],
                ["Sostenibilidad", "Aporte promedio, recaudación mensual, mora, costo por caso, descuento proveedor, reserva, siniestralidad"],
                ["Transparencia", "Casos por estado, auditoría, decisiones documentadas, métricas agregadas sin datos personales"],
            ],
            [1.7, 4.85],
        )
    )
    story.append(p("8. Hoja de ruta", "H1X"))
    for idx, item in enumerate(
        [
            "Piloto controlado: validar preguntas, consentimiento, roles y primer tablero directivo.",
            "Operación del comité: estados, comentarios, archivos, SLA y reportes.",
            "Convenios y programas: medicamentos crónicos, cirugías, apoyo familiar y bienestar.",
            "Modelo recurrente: aporte base 2%, reserva técnica, topes y medición trimestral.",
            "Escala: padrón real, proveedores integrados y reportes comparativos por periodo.",
        ],
        start=1,
    ):
        story.append(p(f"{idx}. {item}", "BulletX"))
    story.append(p("9. Gobernanza mínima", "H1X"))
    for item in [
        "Responsables con permisos definidos y trazabilidad.",
        "Política de topes por tipo de apoyo.",
        "Reserva técnica mínima antes de comprometer nuevos desembolsos.",
        "Revisión jurídica del tratamiento de datos sensibles.",
        "Reporte directivo mensual durante piloto y trimestral en operación.",
    ]:
        story.append(bullet(item))
    story.append(PageBreak())

    story.append(p("10. Cierre para directivos", "H1X"))
    story.append(
        p(
            "CACREF Salud permite pasar de ayuda reactiva a gestión institucional: medir, priorizar, decidir, ejecutar y auditar. Para los colaboradores PDVSA/FUTPV representa una ruta clara para presentar necesidades reales. Para CACREF representa una plataforma para construir programas recurrentes con reglas financieras, reserva, convenios y control de riesgo."
        )
    )
    story.append(
        callout(
            "Mensaje final",
            "Ayudar más no debe significar gastar sin control. Con datos y gestión, CACREF puede ampliar impacto social y proteger la sostenibilidad económica de la cooperativa.",
            LIGHT_BLUE,
        )
    )
    story.append(p("Decisiones inmediatas", "H1X"))
    for idx, item in enumerate(
        [
            "Aprobar piloto institucional.",
            "Nombrar comité y perfiles de acceso.",
            "Validar legalmente privacidad y consentimiento.",
            "Ratificar 2% base, topes y reserva inicial.",
            "Autorizar negociación con proveedores de salud.",
        ],
        start=1,
    ):
        story.append(p(f"{idx}. {item}", "BulletX"))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(PDF_OUT)


if __name__ == "__main__":
    build()
