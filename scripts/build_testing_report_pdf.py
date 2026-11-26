"""Render the versioned testing report and its tables into a self-contained PDF.

Authoring-only dependencies: reportlab, pypdf. Never needed by the application.
Run from any directory. Figures are embedded vector drawings, not external links.
"""
from pathlib import Path
from html import escape
import json
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle, PageBreak, KeepTogether
from reportlab.graphics.shapes import Drawing, Rect, String, Line

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "docs/testing"
WIDTH = A4[0] - 84


def fonts():
    choices = [(Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/arialbd.ttf")),
               (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))]
    for regular, bold in choices:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("Report", str(regular)))
            pdfmetrics.registerFont(TTFont("ReportBold", str(bold)))
            pdfmetrics.registerFontFamily("Report", normal="Report", bold="ReportBold", italic="Report", boldItalic="ReportBold")
            return
    raise RuntimeError("Install Arial or DejaVu Sans for an embedded-font report")


def inline(text):
    text = escape(text)
    def link(match):
        label, target = match.groups()
        if not target.startswith(("https://", "http://")):
            target = "https://github.com/akcedia/SmartLoo/blob/test_work/docs/testing/" + target
        return '<link href="' + target + '" color="#116877">' + label + '</link>'
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link, text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    return re.sub(r"`([^`]+)`", r'<font color="#28435b">\1</font>', text)


def coverage_figure():
    b = json.loads((BASE / "evidence/coverage/backend-summary.json").read_text())
    f = json.loads((BASE / "evidence/coverage/frontend-coverage-summary.json").read_text())["total"]
    rows = [("Python statements", b["statement_percent"]), ("Python branches", b["branch_percent"]),
            ("Python combined", b["combined_percent"]), ("Frontend lines", f["lines"]["pct"]),
            ("Frontend branches", f["branches"]["pct"]), ("Sonar overall", 87.1)]
    drawing = Drawing(WIDTH, 174)
    for i, (label, value) in enumerate(rows):
        y = 148 - i * 23
        drawing.add(String(0, y + 4, label, fontName="Report", fontSize=8.5, fillColor=colors.HexColor("#243747")))
        drawing.add(Rect(130, y, 295, 15, fillColor=colors.HexColor("#e7eef2"), strokeColor=None))
        drawing.add(Rect(130, y, 295 * value / 100, 15, fillColor=colors.HexColor("#137c8b"), strokeColor=None))
        drawing.add(String(436, y + 3, f"{value:.2f}%", fontName="ReportBold", fontSize=8.5))
    return drawing


def main():
    fonts()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ReportBody", fontName="Report", fontSize=9.2, leading=13.4, spaceAfter=8, alignment=TA_LEFT))
    styles.add(ParagraphStyle(name="ReportTitle", fontName="ReportBold", fontSize=23, leading=28, spaceAfter=15, textColor=colors.HexColor("#123d50")))
    styles.add(ParagraphStyle(name="ReportH1", fontName="ReportBold", fontSize=14, leading=18, spaceBefore=16, spaceAfter=9, keepWithNext=True, textColor=colors.HexColor("#123d50")))
    styles.add(ParagraphStyle(name="ReportH2", fontName="ReportBold", fontSize=11.2, leading=15, spaceBefore=10, spaceAfter=7, keepWithNext=True))
    styles.add(ParagraphStyle(name="Cell", fontName="Report", fontSize=7.6, leading=10.5, spaceAfter=0, splitLongWords=True))
    styles.add(ParagraphStyle(name="CellHead", parent=styles["Cell"], fontName="ReportBold", textColor=colors.white))
    story = []
    lines = (BASE / "SOFTWARE_TESTING_REPORT.md").read_text(encoding="utf-8").splitlines()
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line.startswith("|"):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in cells):
                    rows.append(cells)
                index += 1
            heading = rows[0]
            count = len(heading)
            if heading[0] == "Test file":
                ratios = [0.47, 0.24, 0.29]
            elif heading[0] == "Severity":
                ratios = [0.10, 0.23, 0.18, 0.49]
            elif heading[0] == "Requirement":
                ratios = [0.23, 0.16, 0.20, 0.41]
            elif heading[0] == "Case":
                ratios = [0.08, 0.12, 0.46, 0.34]
            elif heading[0] == "Measure":
                ratios = [0.23, 0.24, 0.13, 0.40]
            elif count == 4:
                ratios = [0.12, 0.24, 0.45, 0.19]
            elif count == 3:
                ratios = [0.30, 0.34, 0.36]
            else:
                ratios = [0.41, 0.59]
            data = [[Paragraph(inline(c), styles["CellHead" if r == 0 else "Cell"]) for c in row] for r, row in enumerate(rows)]
            item = LongTable(data, colWidths=[WIDTH * r for r in ratios], repeatRows=1, hAlign="LEFT")
            item.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#173f54")),
                                      ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f5f7")]),
                                      ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 6),
                                      ("RIGHTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 6),
                                      ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                                      ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#173f54")),
                                      ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#d5e0e6"))]))
            story.extend([item, Spacer(1, 10)])
            continue
        if line.startswith("# "):
            story.append(Paragraph(inline(line[2:]), styles["ReportTitle"]))
        elif line.startswith("## "):
            heading = line[3:]
            if heading.startswith(("Appendix A", "Appendix B")):
                story.append(PageBreak())
            story.append(Paragraph(inline(heading), styles["ReportH1"]))
        elif line.startswith("### "):
            story.append(Paragraph(inline(line[4:]), styles["ReportH2"]))
        else:
            # Paragraphs are single source lines; list markers stay as readable bullets.
            if line.startswith("- "):
                line = "• " + line[2:]
            story.append(Paragraph(inline(line), styles["ReportBody"]))
            if line.startswith("Statement coverage counts"):
                story.append(KeepTogether([coverage_figure(), Paragraph("Figure 1. Final coverage measures retain their separate denominators; bars are not interchangeable acceptance scores.", styles["ReportBody"])]))
        index += 1

    def decorate(canvas, doc):
        canvas.setTitle("SmartLoo Software Testing Report - 26 November 2026")
        canvas.setAuthor("SmartLoo team")
        canvas.setFont("Report", 8)
        canvas.setFillColor(colors.HexColor("#536979"))
        canvas.drawString(42, 25, "SmartLoo | Final release verification | 26 November 2026")
        canvas.drawRightString(A4[0] - 42, 25, str(doc.page))
    output = BASE / "SOFTWARE_TESTING_REPORT.pdf"
    doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=42, leftMargin=42, topMargin=38, bottomMargin=43)
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    # Preserve the existing PR/document links while replacing their obsolete content.
    import shutil
    shutil.copy2(output, BASE / "SOFTWARE_TESTING_REPORT_DRAFT.pdf")
    from pypdf import PdfReader
    pdf = PdfReader(output)
    text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    for phrase in ["1. Scope", "3. Tests by requirement", "4. Code coverage", "5. Non-functional", "6. Security", "7. SonarQube", "8. AI evidence", "Appendix A", "Appendix B", "TC-48", "test_zap_regressions.py"]:
        assert phrase in text, "Missing PDF content: " + phrase
    print(json.dumps(dict(pdf=str(output), pages=len(pdf.pages), bytes=output.stat().st_size, content_checks="passed")))


if __name__ == "__main__":
    main()
