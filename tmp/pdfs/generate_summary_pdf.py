from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT_RIGHT_MARGIN = 0.55 * 72
TOP_BOTTOM_MARGIN = 0.45 * 72
COLUMN_GAP = 0.25 * 72
COLUMN_WIDTH = (PAGE_WIDTH - (2 * LEFT_RIGHT_MARGIN) - COLUMN_GAP) / 2

TITLE_SIZE = 18
SUBTITLE_SIZE = 8.5
HEADER_SIZE = 11
BODY_SIZE = 8.5
BULLET_SIZE = 8.25
LINE_HEIGHT = BODY_SIZE * 1.2
BULLET_LINE_HEIGHT = BULLET_SIZE * 1.18

OUTPUT_PATH = Path("/Users/sahmey/Codes/xtern/output/pdf/supply-chain-po-automation-summary.pdf")


CONTENT = {
    "title": "Supply Chain PO Automation",
    "subtitle": "One-page summary derived from repository code and setup docs.",
    "what_it_is": [
        "Supply Chain PO Automation is a multi-agent purchase order system with a Next.js frontend and a FastAPI backend.",
        "It analyzes inventory and forecasts, selects suppliers, plans container usage, creates draft POs, and records an audit trail for human review.",
    ],
    "who_for": [
        "Primary user: supply chain planners and approvers managing replenishment and purchase-order review.",
    ],
    "what_it_does": [
        "Shows system health and live operational counts from Supabase.",
        "Runs a 4-step PO pipeline for selected or auto-detected SKUs.",
        "Calculates net demand from inventory, forecasts, safety stock, and MOQ rules.",
        "Scores suppliers, chooses recommended vendors, and estimates container plans.",
        "Creates draft purchase orders with line items, totals, and AI-written notes.",
        "Supports human approval/rejection and a full decision log with rationale and confidence.",
    ],
    "how_it_works": [
        "Next.js frontend calls the FastAPI backend via NEXT_PUBLIC_BACKEND_URL; the dashboard also reads directly from Supabase.",
        "FastAPI backend exposes health, pipeline run, approval, PO listing, and log endpoints.",
        "LangGraph runs DemandAnalyst -> SupplierSelector -> ContainerOptimizer -> POCompiler, with early exits on errors or empty results.",
        "A Python MCP client launches Node-based MCP servers over stdio JSON-RPC for ERP, supplier, logistics, and PO operations.",
        "Supabase stores operational data, purchase orders, line items, and decision logs; OpenRouter powers LLM rationales and summaries.",
    ],
    "how_to_run": [
        "Create root .env and frontend/.env.local with Supabase, OpenRouter, and backend URL values.",
        "Apply supabase/schema.sql and seed data with data/seed_data.py.",
        "Start the backend from backend/ with uvicorn main:app --reload.",
        "Start the frontend from frontend/ with npm install, then npm run dev, then open http://localhost:3000.",
    ],
}


def wrap_text(text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    words = text.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if stringWidth(trial, font_name, font_size) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def draw_section_header(pdf: canvas.Canvas, x: float, y: float, title: str) -> float:
    pdf.setFont("Helvetica-Bold", HEADER_SIZE)
    pdf.setFillColorRGB(0.08, 0.13, 0.25)
    pdf.drawString(x, y, title)
    pdf.setLineWidth(0.75)
    pdf.setStrokeColorRGB(0.73, 0.79, 0.9)
    pdf.line(x, y - 3, x + COLUMN_WIDTH, y - 3)
    return y - 12


def draw_wrapped_lines(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    lines: list[str],
    font_name: str = "Helvetica",
    font_size: float = BODY_SIZE,
    line_height: float = LINE_HEIGHT,
) -> float:
    pdf.setFont(font_name, font_size)
    pdf.setFillColorRGB(0.13, 0.16, 0.22)
    for line in lines:
        pdf.drawString(x, y, line)
        y -= line_height
    return y


def draw_paragraph(pdf: canvas.Canvas, x: float, y: float, sentences: list[str]) -> float:
    wrapped_lines: list[str] = []
    for sentence in sentences:
        wrapped_lines.extend(wrap_text(sentence, "Helvetica", BODY_SIZE, COLUMN_WIDTH))
    return draw_wrapped_lines(pdf, x, y, wrapped_lines)


def draw_bullet_list(pdf: canvas.Canvas, x: float, y: float, items: list[str]) -> float:
    bullet_indent = 10
    text_width = COLUMN_WIDTH - bullet_indent - 4
    pdf.setFont("Helvetica", BULLET_SIZE)
    pdf.setFillColorRGB(0.13, 0.16, 0.22)

    for item in items:
        wrapped = wrap_text(item, "Helvetica", BULLET_SIZE, text_width)
        pdf.drawString(x, y, "-")
        line_y = y
        for line in wrapped:
            pdf.drawString(x + bullet_indent, line_y, line)
            line_y -= BULLET_LINE_HEIGHT
        y = line_y - 1
    return y


def draw_numbered_list(pdf: canvas.Canvas, x: float, y: float, items: list[str]) -> float:
    number_width = 12
    text_width = COLUMN_WIDTH - number_width - 4
    pdf.setFont("Helvetica", BULLET_SIZE)
    pdf.setFillColorRGB(0.13, 0.16, 0.22)

    for index, item in enumerate(items, start=1):
        wrapped = wrap_text(item, "Helvetica", BULLET_SIZE, text_width)
        pdf.drawString(x, y, f"{index}.")
        line_y = y
        for line in wrapped:
            pdf.drawString(x + number_width, line_y, line)
            line_y -= BULLET_LINE_HEIGHT
        y = line_y - 1
    return y


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    pdf = canvas.Canvas(str(OUTPUT_PATH), pagesize=letter)
    pdf.setTitle(CONTENT["title"])

    top_y = PAGE_HEIGHT - TOP_BOTTOM_MARGIN
    left_x = LEFT_RIGHT_MARGIN
    right_x = LEFT_RIGHT_MARGIN + COLUMN_WIDTH + COLUMN_GAP

    pdf.setFillColorRGB(0.94, 0.97, 1.0)
    pdf.roundRect(
        LEFT_RIGHT_MARGIN,
        PAGE_HEIGHT - TOP_BOTTOM_MARGIN - 48,
        PAGE_WIDTH - (2 * LEFT_RIGHT_MARGIN),
        42,
        8,
        fill=1,
        stroke=0,
    )

    pdf.setFillColorRGB(0.08, 0.13, 0.25)
    pdf.setFont("Helvetica-Bold", TITLE_SIZE)
    pdf.drawString(left_x + 10, top_y - 18, CONTENT["title"])
    pdf.setFont("Helvetica", SUBTITLE_SIZE)
    pdf.setFillColorRGB(0.26, 0.34, 0.49)
    pdf.drawString(left_x + 10, top_y - 31, CONTENT["subtitle"])

    left_y = PAGE_HEIGHT - TOP_BOTTOM_MARGIN - 64
    right_y = left_y

    left_y = draw_section_header(pdf, left_x, left_y, "What it is")
    left_y = draw_paragraph(pdf, left_x, left_y, CONTENT["what_it_is"])
    left_y -= 6

    left_y = draw_section_header(pdf, left_x, left_y, "Who it's for")
    left_y = draw_paragraph(pdf, left_x, left_y, CONTENT["who_for"])
    left_y -= 6

    left_y = draw_section_header(pdf, left_x, left_y, "How to run")
    left_y = draw_numbered_list(pdf, left_x, left_y, CONTENT["how_to_run"])

    right_y = draw_section_header(pdf, right_x, right_y, "What it does")
    right_y = draw_bullet_list(pdf, right_x, right_y, CONTENT["what_it_does"])
    right_y -= 4

    right_y = draw_section_header(pdf, right_x, right_y, "How it works")
    right_y = draw_bullet_list(pdf, right_x, right_y, CONTENT["how_it_works"])

    min_y = TOP_BOTTOM_MARGIN
    if left_y < min_y or right_y < min_y:
        raise RuntimeError(f"Content overflowed the page: left_y={left_y:.2f}, right_y={right_y:.2f}")

    pdf.save()


if __name__ == "__main__":
    main()
