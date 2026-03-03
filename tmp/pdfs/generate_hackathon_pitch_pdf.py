from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas


PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_X = 42
MARGIN_Y = 40
CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN_X)

TITLE_SIZE = 20
SUBTITLE_SIZE = 10
HEADER_SIZE = 13
BODY_SIZE = 9
SMALL_SIZE = 8

BODY_LEADING = 12
SECTION_GAP = 10

OUTPUT_PATH = Path("/Users/sahmey/Codes/xtern/output/pdf/hackathon-pitch-supply-chain-po-automation.pdf")


class PDFWriter:
    def __init__(self, pdf: canvas.Canvas) -> None:
        self.pdf = pdf
        self.page_number = 0
        self.y = 0
        self._new_page()

    def _draw_page_frame(self) -> None:
        self.pdf.setFillColor(colors.HexColor("#F8FAFC"))
        self.pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)

        self.pdf.setFillColor(colors.white)
        self.pdf.roundRect(MARGIN_X - 10, MARGIN_Y - 10, CONTENT_WIDTH + 20, PAGE_HEIGHT - (2 * MARGIN_Y) + 12, 12, fill=1, stroke=0)

        self.pdf.setStrokeColor(colors.HexColor("#D9E2EC"))
        self.pdf.setLineWidth(0.7)
        self.pdf.roundRect(MARGIN_X - 10, MARGIN_Y - 10, CONTENT_WIDTH + 20, PAGE_HEIGHT - (2 * MARGIN_Y) + 12, 12, fill=0, stroke=1)

    def _new_page(self) -> None:
        if self.page_number:
            self._draw_footer()
            self.pdf.showPage()
        self.page_number += 1
        self._draw_page_frame()
        self.y = PAGE_HEIGHT - MARGIN_Y

    def _draw_footer(self) -> None:
        self.pdf.setFont("Helvetica", SMALL_SIZE)
        self.pdf.setFillColor(colors.HexColor("#52606D"))
        self.pdf.drawRightString(PAGE_WIDTH - MARGIN_X, 22, f"Page {self.page_number}")
        self.pdf.drawString(MARGIN_X, 22, "Hackathon pitch brief - generated from repo evidence plus cited external research")

    def _ensure_space(self, required_height: float) -> None:
        if self.y - required_height < MARGIN_Y:
            self._new_page()

    def title_block(self, title: str, subtitle: str) -> None:
        band_height = 54
        self._ensure_space(band_height + 8)
        self.pdf.setFillColor(colors.HexColor("#EAF2FF"))
        self.pdf.roundRect(MARGIN_X, self.y - band_height, CONTENT_WIDTH, band_height, 10, fill=1, stroke=0)

        self.pdf.setFillColor(colors.HexColor("#102A43"))
        self.pdf.setFont("Helvetica-Bold", TITLE_SIZE)
        self.pdf.drawString(MARGIN_X + 12, self.y - 22, title)

        self.pdf.setFillColor(colors.HexColor("#334E68"))
        self.pdf.setFont("Helvetica", SUBTITLE_SIZE)
        self.pdf.drawString(MARGIN_X + 12, self.y - 38, subtitle)

        self.y -= band_height + 14

    def section_header(self, text: str) -> None:
        self._ensure_space(20)
        self.pdf.setFillColor(colors.HexColor("#0F172A"))
        self.pdf.setFont("Helvetica-Bold", HEADER_SIZE)
        self.pdf.drawString(MARGIN_X, self.y, text)
        self.pdf.setStrokeColor(colors.HexColor("#BFDBFE"))
        self.pdf.setLineWidth(1)
        self.pdf.line(MARGIN_X, self.y - 4, PAGE_WIDTH - MARGIN_X, self.y - 4)
        self.y -= 18

    def paragraph(self, text: str, *, font_size: int = BODY_SIZE, color: str = "#1F2937") -> None:
        lines = simpleSplit(text, "Helvetica", font_size, CONTENT_WIDTH)
        needed = (len(lines) * BODY_LEADING) + 2
        self._ensure_space(needed)
        self.pdf.setFont("Helvetica", font_size)
        self.pdf.setFillColor(colors.HexColor(color))
        for line in lines:
            self.pdf.drawString(MARGIN_X, self.y, line)
            self.y -= BODY_LEADING
        self.y -= 2

    def bullet_list(self, items: Iterable[str]) -> None:
        for item in items:
            lines = simpleSplit(item, "Helvetica", BODY_SIZE, CONTENT_WIDTH - 14)
            needed = max(16, (len(lines) * BODY_LEADING) + 2)
            self._ensure_space(needed)
            self.pdf.setFillColor(colors.HexColor("#1F2937"))
            self.pdf.setFont("Helvetica", BODY_SIZE)
            self.pdf.drawString(MARGIN_X, self.y, "-")
            line_y = self.y
            for line in lines:
                self.pdf.drawString(MARGIN_X + 12, line_y, line)
                line_y -= BODY_LEADING
            self.y = line_y - 1
        self.y -= 2

    def numbered_list(self, items: Iterable[str]) -> None:
        for index, item in enumerate(items, start=1):
            lines = simpleSplit(item, "Helvetica", BODY_SIZE, CONTENT_WIDTH - 18)
            needed = max(16, (len(lines) * BODY_LEADING) + 2)
            self._ensure_space(needed)
            self.pdf.setFillColor(colors.HexColor("#1F2937"))
            self.pdf.setFont("Helvetica", BODY_SIZE)
            self.pdf.drawString(MARGIN_X, self.y, f"{index}.")
            line_y = self.y
            for line in lines:
                self.pdf.drawString(MARGIN_X + 16, line_y, line)
                line_y -= BODY_LEADING
            self.y = line_y - 1
        self.y -= 2

    def source_list(self, items: Iterable[str]) -> None:
        for item in items:
            lines = simpleSplit(item, "Helvetica", SMALL_SIZE, CONTENT_WIDTH)
            needed = max(14, (len(lines) * 10) + 1)
            self._ensure_space(needed)
            self.pdf.setFont("Helvetica", SMALL_SIZE)
            self.pdf.setFillColor(colors.HexColor("#334155"))
            for line in lines:
                self.pdf.drawString(MARGIN_X, self.y, line)
                self.y -= 10
            self.y -= 1

    def finish(self) -> None:
        self._draw_footer()
        self.pdf.save()


def build_pdf() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT_PATH), pagesize=letter)
    pdf.setTitle("Hackathon Pitch - Supply Chain PO Automation")

    doc = PDFWriter(pdf)
    doc.title_block(
        "Supply Chain PO Automation",
        "Hackathon pitch brief for a non-supply-chain audience. Current as of February 28, 2026.",
    )

    doc.section_header("1. The problem in plain English")
    doc.paragraph(
        "A purchase order, or PO, is a formal document a company sends to a supplier that says: "
        "what we want to buy, how much we want, what price we expect, and when we need it. "
        "In many companies, this still happens through a mix of ERP screens, spreadsheets, emails, and approvals in inboxes."
    )
    doc.bullet_list([
        "If teams guess demand badly, they can run out of parts (stockout) or buy too much and tie up cash in inventory.",
        "If approvals are slow, the order is delayed and operations wait on missing materials.",
        "If data is copied by hand, errors can create wrong quantities, wrong vendors, duplicate orders, or invoice mismatches.",
        "If information lives across tools, finance and operations lose real-time visibility into committed spend and delivery risk.",
    ])
    doc.paragraph(
        "External procurement guidance consistently describes manual PO workflows as slow, error-prone, harder to audit, "
        "and harder to scale as purchase volume grows."
    )

    doc.section_header("2. How purchase orders are usually handled today")
    doc.paragraph(
        "A standard purchase-to-pay process usually follows this chain: request a purchase, get approval, issue the PO, "
        "receive goods, match the PO against the invoice, and then pay the supplier."
    )
    doc.numbered_list([
        "A planner or buyer notices stock is low or a team needs something.",
        "They check demand, budgets, supplier options, and lead times, often across separate systems.",
        "They create the PO manually or semi-manually, route it for approval, and send it to the supplier.",
        "Later, finance has to reconcile the PO, the receiving record, and the invoice before payment.",
    ])
    doc.paragraph(
        "This works, but it often depends on experienced people stitching together facts from multiple systems. "
        "That makes the process hard to scale and vulnerable to delays when any one person or document becomes the bottleneck."
    )

    doc.section_header("3. What this software is trying to achieve")
    doc.paragraph(
        "This application is not trying to replace the entire ERP or fully automate procurement end-to-end. "
        "Based on the repo, its goal is narrower and more practical: produce a fast, AI-assisted draft purchase order "
        "for replenishment, then hand that draft to a human for review and approval."
    )
    doc.bullet_list([
        "It checks inventory and forecasts to find which SKUs likely need replenishment.",
        "It selects suppliers for those SKUs using scoring logic.",
        "It estimates container planning and freight at the draft stage.",
        "It creates a draft PO, stores it, and surfaces it in an approval queue.",
        "It records an audit trail so reviewers can see what each agent decided and why.",
    ])

    doc.section_header("4. Scope of the current application (repo evidence)")
    doc.paragraph(
        "The repo shows a Next.js frontend, a FastAPI backend, a LangGraph pipeline with four agents, Supabase for data, "
        "OpenRouter for LLM calls, and four MCP servers for ERP data, supplier data, logistics, and PO management."
    )
    doc.bullet_list([
        "Frontend scope: dashboard, pipeline runner, approval queue, and decision log.",
        "Backend scope: run the multi-agent pipeline, approve or reject draft POs, list POs, and fetch logs.",
        "Agent scope: DemandAnalyst, SupplierSelector, ContainerOptimizer, and POCompiler.",
        "Business scope: draft creation and review support, not autonomous vendor payment or contract negotiation.",
        "Control scope: human-in-the-loop approval is built in before the PO is finalized.",
    ])

    doc.section_header("5. Why AI matters here")
    doc.paragraph(
        "Traditional software automation is good at fixed rules. AI becomes useful when the system needs to synthesize "
        "multiple business signals, explain its reasoning, and turn structured data into decision-ready summaries."
    )
    doc.bullet_list([
        "The AI can summarize why a SKU needs replenishment instead of just outputting a number.",
        "It can explain why a supplier was chosen, which makes the draft easier for humans to trust and review.",
        "It can turn logistics results into a business-readable recommendation instead of raw calculations.",
        "It can generate an executive summary for the PO so approvers do not have to read every low-level field first.",
    ])
    doc.paragraph(
        "In this repo, AI is being used as a decision-support layer on top of structured business data, not as a blind chatbot."
    )

    doc.section_header("6. Why MCP servers matter, and how this differs from old methods")
    doc.paragraph(
        "The Model Context Protocol, or MCP, is a standard way for an AI client to call tools and access structured resources. "
        "In simple terms: instead of asking the model to guess from pasted text, you give it a clean way to query the right system."
    )
    doc.bullet_list([
        "Here, the Python backend can call MCP servers for ERP, supplier, logistics, and PO tasks over a standard interface.",
        "That means the AI is grounded in live business data and purpose-built tools, not just free-form text prompts.",
        "This is safer than traditional chat-only AI because the model can use constrained tool schemas instead of improvising data formats.",
        "It is also easier to extend than a monolith: each business domain can expose its own tool set without rewriting the whole app.",
        "Official MCP guidance also assumes human oversight, which matches this app's approval workflow.",
    ])

    doc.section_header("7. What improvements this software can bring")
    doc.paragraph(
        "The repo does not include measured ROI, so the benefits below are expected improvements, not proven project metrics yet. "
        "They are grounded in both the app's design and broader procurement automation research."
    )
    doc.bullet_list([
        "Faster first draft: planners spend less time collecting inputs before a PO exists.",
        "Lower manual error risk: less copy-pasting between systems reduces mistakes in quantities, vendors, and records.",
        "Better visibility: the app centralizes the draft, approval state, and decision trail in one workflow.",
        "More consistent decisions: agent logic applies the same demand, supplier, and logistics steps every time.",
        "Audit readiness: decision logs make it easier to explain what happened during review.",
        "Scalability: a lean team can handle more SKUs and suppliers without growing manual coordination work at the same rate.",
    ])

    doc.section_header("8. Do companies actually need this?")
    doc.paragraph(
        "Some do, some do not. The answer depends on purchasing complexity."
    )
    doc.bullet_list([
        "Good fit: manufacturers, distributors, and operations-heavy teams with many SKUs, many suppliers, recurring replenishment, and real stockout risk.",
        "Good fit: companies where approvals, vendor comparisons, and freight planning are still stitched together manually.",
        "Medium fit: companies that already have ERP systems but still rely on human judgment and spreadsheets for planning decisions.",
        "Lower fit: small teams with low PO volume, stable demand, one or two suppliers, or a mature enterprise procurement suite already covering this workflow well.",
    ])
    doc.paragraph(
        "So yes, many companies can benefit from this category of software, but it is most valuable where procurement complexity is high and decision latency is expensive."
    )

    doc.section_header("9. Hackathon pitch framing")
    doc.paragraph(
        "The clearest pitch is not 'we automated procurement.' That is too broad and too risky. "
        "The stronger pitch is: we built an AI-assisted replenishment and PO drafting copilot that connects operations, procurement, and finance signals into one reviewable workflow."
    )
    doc.bullet_list([
        "It helps teams decide what to buy, from whom, and how to ship it.",
        "It keeps a human approver in control.",
        "It uses AI where explanation and synthesis matter.",
        "It uses MCP where trustworthy tool access matters.",
        "It narrows the gap between raw operational data and an approvable purchasing decision.",
    ])
    doc.paragraph(
        "That makes the software credible for a hackathon: practical scope, clear users, immediate business relevance, and a modern AI systems design story."
    )

    doc.section_header("10. Sources")
    doc.source_list([
        "Repo evidence: /Users/sahmey/Codes/xtern/backend/main.py, /Users/sahmey/Codes/xtern/backend/graph/pipeline.py, /Users/sahmey/Codes/xtern/backend/agents/*.py, /Users/sahmey/Codes/xtern/frontend/src/app/*.tsx, /Users/sahmey/Codes/xtern/backend/mcp_client/client.py",
        "Model Context Protocol official docs - Tools: https://modelcontextprotocol.io/docs/concepts/tools",
        "Model Context Protocol official docs - Resources: https://modelcontextprotocol.io/docs/concepts/resources",
        "SAP - What is procure-to-pay (P2P)?: https://www.sap.com/products/spend-management/procure-to-pay/what-is-procure-to-pay.html",
        "SAP - Purchase order definition: https://help.sap.com/docs/SAP_ERP/16ec4da603a84f06bd1f544112c95577/a07eb65334e6b54ce10000000a174cb4.html",
        "Order.co - Manual PO processing disadvantages: https://www.order.co/blog/purchasing-process/purchase-order-processing/",
        "Order.co - AI in procurement benefits: https://www.order.co/blog/ai/ai-in-procurement/",
        "Order.co - PO management visibility and approval bottlenecks: https://www.order.co/blog/procurement/smarter-po-management-tools/",
        "Order.co - Procurement and finance visibility gaps: https://www.order.co/blog/procurement/procurement-finance-collaboration/",
    ])

    doc.finish()


if __name__ == "__main__":
    build_pdf()
