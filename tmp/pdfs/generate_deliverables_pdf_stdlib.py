from __future__ import annotations

from pathlib import Path
import re

PAGE_W = 612
PAGE_H = 792
MARGIN_X = 54
MARGIN_TOP = 68
MARGIN_BOTTOM = 54
CONTENT_W = PAGE_W - (2 * MARGIN_X)

TITLE_SIZE = 24
H1_SIZE = 16
H2_SIZE = 13
H3_SIZE = 11
BODY_SIZE = 10
CODE_SIZE = 9
SMALL_SIZE = 9

LINE_FACTORS = {
    TITLE_SIZE: 1.35,
    H1_SIZE: 1.4,
    H2_SIZE: 1.35,
    H3_SIZE: 1.3,
    BODY_SIZE: 1.45,
    CODE_SIZE: 1.35,
    SMALL_SIZE: 1.35,
}

FONT_REG = "F1"
FONT_BOLD = "F2"
FONT_MONO = "F3"

ROOT = Path('/Users/sahmey/procureai/test')
INPUT_FILES = [
    ROOT / 'deliverables' / '01_10_MIN_PITCH_GUIDE.md',
    ROOT / 'deliverables' / '04_TECHNICAL_DESIGN.md',
    ROOT / 'deliverables' / '05_GOVERNANCE_SAFETY_BRIEF.md',
    ROOT / 'deliverables' / '06_BUSINESS_SKETCH.md',
    ROOT / 'deliverables' / '07_NEXT_STEPS_PILOT_PLAN.md',
]
OUTPUT_COMPILED = ROOT / 'output' / 'pdf' / 'procureai-deliverables.pdf'


def normalize_text(s: str) -> str:
    return (
        s.replace('\u2013', '-')
        .replace('\u2014', '-')
        .replace('\u2212', '-')
        .replace('\u2018', "'")
        .replace('\u2019', "'")
        .replace('\u201c', '"')
        .replace('\u201d', '"')
        .replace('\t', '    ')
    )


def escape_pdf_text(s: str) -> str:
    return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def width_factor(font: str) -> float:
    if font == FONT_MONO:
        return 0.60
    if font == FONT_BOLD:
        return 0.56
    return 0.53


def wrap_text(text: str, font: str, size: int, max_width: float) -> list[str]:
    text = re.sub(r'\s+', ' ', text.strip())
    if not text:
        return ['']

    max_chars = max(12, int(max_width / (size * width_factor(font))))
    words = text.split(' ')
    lines: list[str] = []
    line = words[0]
    for word in words[1:]:
        trial = f"{line} {word}" if line else word
        if len(trial) <= max_chars:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


class PdfBuilder:
    def __init__(self) -> None:
        self.pages: list[list[str]] = []
        self.cmds: list[str] = []
        self.page_no = 0
        self.y = PAGE_H - MARGIN_TOP
        self.new_page()

    def new_page(self) -> None:
        if self.cmds:
            self.draw_footer()
            self.pages.append(self.cmds)
        self.page_no += 1
        self.cmds = []
        self.y = PAGE_H - MARGIN_TOP
        self.draw_page_chrome()

    def draw_page_chrome(self) -> None:
        # header band
        self.cmds.append('0.95 0.97 1 rg')
        self.cmds.append(f'0 {PAGE_H-50} {PAGE_W} 50 re f')
        # heading
        self.draw_text('ProcureAI Deliverables', MARGIN_X, PAGE_H-33, FONT_BOLD, 12)

    def draw_footer(self) -> None:
        self.cmds.append('0.94 0.96 0.99 rg')
        self.cmds.append(f'0 0 {PAGE_W} 40 re f')
        self.draw_text('Generated from repository deliverables', MARGIN_X, 26, FONT_REG, SMALL_SIZE)
        self.draw_text(f'Page {self.page_no}', PAGE_W-MARGIN_X-50, 26, FONT_REG, SMALL_SIZE)

    def ensure_space(self, lines: int, size: int) -> None:
        needed = lines * (size * LINE_FACTORS[size]) + 8
        if self.y - needed < MARGIN_BOTTOM:
            self.new_page()

    def draw_text(self, text: str, x: float, y: float, font: str, size: int) -> None:
        clean = escape_pdf_text(normalize_text(text))
        self.cmds.append('0.12 0.16 0.22 rg')
        self.cmds.append(f'BT /{font} {size} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm ({clean}) Tj ET')

    def draw_wrapped(self, text: str, font: str, size: int, indent: float = 0) -> None:
        lines = wrap_text(text, font, size, CONTENT_W - indent)
        self.ensure_space(len(lines), size)
        x = MARGIN_X + indent
        lh = size * LINE_FACTORS[size]
        for line in lines:
            self.draw_text(line, x, self.y, font, size)
            self.y -= lh

    def spacer(self, h: float) -> None:
        self.y -= h
        if self.y < MARGIN_BOTTOM:
            self.new_page()

    def heading(self, text: str, level: int) -> None:
        if level == 1:
            size = H1_SIZE
        elif level == 2:
            size = H2_SIZE
        else:
            size = H3_SIZE
        self.spacer(6)
        self.draw_wrapped(text, FONT_BOLD, size)
        self.spacer(3)

    def bullet(self, text: str, num: str | None = None) -> None:
        prefix = f'{num} ' if num else '- '
        bullet_indent = 16
        lines = wrap_text(text, FONT_REG, BODY_SIZE, CONTENT_W - bullet_indent)
        self.ensure_space(len(lines), BODY_SIZE)
        self.draw_text(prefix, MARGIN_X, self.y, FONT_REG, BODY_SIZE)
        lh = BODY_SIZE * LINE_FACTORS[BODY_SIZE]
        for i, line in enumerate(lines):
            self.draw_text(line, MARGIN_X + bullet_indent, self.y - (i * lh), FONT_REG, BODY_SIZE)
        self.y -= len(lines) * lh

    def code_block(self, lines: list[str]) -> None:
        if not lines:
            return
        lh = CODE_SIZE * LINE_FACTORS[CODE_SIZE]
        h = len(lines) * lh + 12
        self.ensure_space(len(lines) + 1, CODE_SIZE)
        y_bottom = self.y - h + 8
        self.cmds.append('0.96 0.97 0.99 rg')
        self.cmds.append(f'{MARGIN_X} {y_bottom:.2f} {CONTENT_W:.2f} {h:.2f} re f')
        self.cmds.append('0.82 0.86 0.92 RG 0.6 w')
        self.cmds.append(f'{MARGIN_X} {y_bottom:.2f} {CONTENT_W:.2f} {h:.2f} re S')
        y = self.y - 4
        for ln in lines:
            self.draw_text(ln[:110], MARGIN_X + 8, y, FONT_MONO, CODE_SIZE)
            y -= lh
        self.y = y - 4

    def finish(self) -> bytes:
        if self.cmds:
            self.draw_footer()
            self.pages.append(self.cmds)

        objs: list[bytes] = []

        def add_obj(content: str | bytes) -> int:
            if isinstance(content, str):
                payload = content.encode('latin-1', errors='replace')
            else:
                payload = content
            objs.append(payload)
            return len(objs)

        font1_id = add_obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
        font2_id = add_obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
        font3_id = add_obj('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>')

        page_obj_ids: list[int] = []
        content_obj_ids: list[int] = []

        for cmds in self.pages:
            stream = '\n'.join(cmds).encode('latin-1', errors='replace')
            content_id = add_obj(b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream')
            content_obj_ids.append(content_id)
            page_obj_ids.append(0)

        kids_placeholder = 'KIDS_PLACEHOLDER'
        pages_obj_id = add_obj(f'<< /Type /Pages /Kids [{kids_placeholder}] /Count {len(self.pages)} >>')

        for i, content_id in enumerate(content_obj_ids):
            page_id = add_obj(
                f'<< /Type /Page /Parent {pages_obj_id} 0 R '
                f'/MediaBox [0 0 {PAGE_W} {PAGE_H}] '
                f'/Resources << /Font << /F1 {font1_id} 0 R /F2 {font2_id} 0 R /F3 {font3_id} 0 R >> >> '
                f'/Contents {content_id} 0 R >>'
            )
            page_obj_ids[i] = page_id

        kids = ' '.join(f'{pid} 0 R' for pid in page_obj_ids)
        objs[pages_obj_id - 1] = (
            f'<< /Type /Pages /Kids [{kids}] /Count {len(self.pages)} >>'.encode('latin-1')
        )

        catalog_id = add_obj(f'<< /Type /Catalog /Pages {pages_obj_id} 0 R >>')

        out = bytearray()
        out.extend(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
        offsets = [0]
        for idx, obj in enumerate(objs, start=1):
            offsets.append(len(out))
            out.extend(f'{idx} 0 obj\n'.encode('latin-1'))
            out.extend(obj)
            out.extend(b'\nendobj\n')

        xref_start = len(out)
        out.extend(f'xref\n0 {len(objs)+1}\n'.encode('latin-1'))
        out.extend(b'0000000000 65535 f \n')
        for off in offsets[1:]:
            out.extend(f'{off:010d} 00000 n \n'.encode('latin-1'))

        out.extend(
            f'trailer\n<< /Size {len(objs)+1} /Root {catalog_id} 0 R >>\nstartxref\n{xref_start}\n%%EOF\n'.encode('latin-1')
        )
        return bytes(out)


def add_markdown(builder: PdfBuilder, path: Path) -> None:
    title = path.stem.replace('_', ' ')
    builder.heading(title, 1)
    builder.spacer(2)

    lines = path.read_text(encoding='utf-8').splitlines()
    in_code = False
    code_lines: list[str] = []

    for raw in lines:
        line = normalize_text(raw.rstrip())

        if line.strip().startswith('```'):
            if in_code:
                builder.code_block(code_lines)
                code_lines = []
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        stripped = line.strip()
        if not stripped:
            builder.spacer(5)
            continue

        if stripped.startswith('# '):
            builder.heading(stripped[2:].strip(), 1)
            continue
        if stripped.startswith('## '):
            builder.heading(stripped[3:].strip(), 2)
            continue
        if stripped.startswith('### '):
            builder.heading(stripped[4:].strip(), 3)
            continue

        if re.match(r'^\d+\.\s+', stripped):
            m = re.match(r'^(\d+\.)\s+(.*)$', stripped)
            if m:
                builder.bullet(m.group(2), num=m.group(1))
                continue

        if stripped.startswith('- '):
            builder.bullet(stripped[2:].strip())
            continue

        # simple markdown cleanup
        text = re.sub(r'`([^`]+)`', r'\1', stripped)
        text = text.replace('**', '')
        builder.draw_wrapped(text, FONT_REG, BODY_SIZE)

    if code_lines:
        builder.code_block(code_lines)

    builder.spacer(14)


def build_pdf(paths: list[Path], output: Path, title: str, subtitle: str) -> None:
    builder = PdfBuilder()

    builder.draw_wrapped(title, FONT_BOLD, TITLE_SIZE)
    builder.draw_wrapped(subtitle, FONT_REG, H3_SIZE)
    builder.spacer(8)
    builder.draw_wrapped(
        'Includes: 10-minute pitch guide, technical design, governance and safety brief, business sketch, and pilot plan.',
        FONT_REG,
        BODY_SIZE,
    )
    builder.spacer(16)

    for path in paths:
        add_markdown(builder, path)

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(builder.finish())
    print(str(output))


def main() -> None:
    build_pdf(
        INPUT_FILES,
        OUTPUT_COMPILED,
        'ProcureAI Submission Deliverables',
        'Compiled PDF package generated from markdown documents',
    )

    for path in INPUT_FILES:
        out = ROOT / 'output' / 'pdf' / f'{path.stem}.pdf'
        build_pdf(
            [path],
            out,
            path.stem.replace('_', ' '),
            f'Generated from {path.name}',
        )


if __name__ == '__main__':
    main()
