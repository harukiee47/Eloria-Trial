import express from "express";
import { verifyUser } from "../middleware/auth.js";
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun,
  AlignmentType, BorderStyle, ShadingType, PageNumber,
  Header, Footer, Table, TableRow, TableCell, WidthType,
  UnderlineType,
} from "docx";
import PptxGenJS from "pptxgenjs";

const router = express.Router();

// ── Theme ────────────────────────────────────────────────────────────────────

const THEME = {
  primary:     "2D4B8E",   // deep blue
  accent:      "4F86C6",   // medium blue
  light:       "EBF2FA",   // light blue bg
  dark:        "1A1A2E",   // near black
  text:        "2C2C2C",   // body text
  muted:       "6B7280",   // subtle text
  white:       "FFFFFF",
  border:      "D1DCF0",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseMarkdownDoc(raw) {
  return raw.split("\n").filter(l => l.trim()).map(line => {
    if (line.startsWith("# "))   return { type: "h1",     text: line.slice(2).trim() };
    if (line.startsWith("## "))  return { type: "h2",     text: line.slice(3).trim() };
    if (line.startsWith("### ")) return { type: "h3",     text: line.slice(4).trim() };
    if (line.startsWith("- "))   return { type: "bullet", text: line.slice(2).trim() };
    if (/^\*\*(.+)\*\*/.test(line.trim())) return { type: "bold", text: line.trim().replace(/\*\*/g, "") };
    return { type: "text", text: line.trim() };
  });
}

function parseSlides(raw) {
  return raw.split(/\n---\n/).map(slide => parseMarkdownDoc(slide));
}

function hex(color) {
  return { color };
}

// ── DOCX builder ─────────────────────────────────────────────────────────────

router.post("/generate-doc", verifyUser, async (req, res) => {
  try {
    const { content, filename = "eloria-document.docx" } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });

    const lines = parseMarkdownDoc(content);
    const children = [];
    let bulletBuffer = [];
    let isFirstH1 = true;

    const flushBullets = () => {
      bulletBuffer.forEach(text => {
        children.push(new Paragraph({
          children: [
            new TextRun({
              text: `• ${text}`,
              font: "Calibri",
              size: 22,
              color: THEME.text,
            }),
          ],
          spacing: { after: 60, before: 40 },
          indent: { left: 360 },
        }));
      });
      bulletBuffer = [];
    };

    lines.forEach(line => {
      if (line.type !== "bullet" && bulletBuffer.length) flushBullets();

      switch (line.type) {

        // ── Title (first h1 gets a full cover-style block) ──
        case "h1":
          if (isFirstH1) {
            isFirstH1 = false;
            // top spacer
            children.push(new Paragraph({ spacing: { before: 400, after: 0 } }));
            // shaded title block
            children.push(new Paragraph({
              children: [
                new TextRun({
                  text: line.text,
                  bold: true,
                  font: "Calibri",
                  size: 52,
                  color: THEME.white,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 400, after: 200 },
              shading: { type: ShadingType.SOLID, color: THEME.primary },
              border: {
                top:    { style: BorderStyle.SINGLE, size: 6, color: THEME.accent },
                bottom: { style: BorderStyle.SINGLE, size: 6, color: THEME.accent },
              },
            }));
            // accent line under title
            children.push(new Paragraph({
              children: [new TextRun({ text: "", size: 4 })],
              shading: { type: ShadingType.SOLID, color: THEME.accent },
              spacing: { before: 0, after: 400 },
            }));
          } else {
            children.push(new Paragraph({
              children: [
                new TextRun({
                  text: line.text,
                  bold: true,
                  font: "Calibri",
                  size: 36,
                  color: THEME.primary,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 400, after: 200 },
            }));
          }
          break;

        // ── Section heading ──
        case "h2":
          children.push(new Paragraph({
            children: [
              new TextRun({
                text: line.text.toUpperCase(),
                bold: true,
                font: "Calibri",
                size: 26,
                color: THEME.white,
              }),
            ],
            spacing: { before: 440, after: 120 },
            shading: { type: ShadingType.SOLID, color: THEME.primary },
            border: {
              left: { style: BorderStyle.SINGLE, size: 12, color: THEME.accent },
            },
          }));
          break;

        // ── Sub-heading ──
        case "h3":
          children.push(new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                bold: true,
                font: "Calibri",
                size: 24,
                color: THEME.accent,
                underline: { type: UnderlineType.SINGLE, color: THEME.accent },
              }),
            ],
            spacing: { before: 280, after: 80 },
          }));
          break;

        // ── Bold label line ──
        case "bold":
          children.push(new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                bold: true,
                font: "Calibri",
                size: 22,
                color: THEME.dark,
              }),
            ],
            spacing: { before: 160, after: 60 },
          }));
          break;

        // ── Bullet (buffered) ──
        case "bullet":
          bulletBuffer.push(line.text);
          break;

        // ── Body text ──
        default:
          children.push(new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                font: "Calibri",
                size: 22,
                color: THEME.text,
              }),
            ],
            spacing: { before: 80, after: 80 },
            alignment: AlignmentType.JUSTIFIED,
          }));
      }
    });

    if (bulletBuffer.length) flushBullets();

    // ── Footer ──
    const footer = new Footer({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "Generated by Eloria AI  •  Page ",
              font: "Calibri",
              size: 18,
              color: THEME.muted,
            }),
            new TextRun({
              children: [PageNumber.CURRENT],
              font: "Calibri",
              size: 18,
              color: THEME.muted,
            }),
            new TextRun({
              text: " of ",
              font: "Calibri",
              size: 18,
              color: THEME.muted,
            }),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              font: "Calibri",
              size: 18,
              color: THEME.muted,
            }),
          ],
          alignment: AlignmentType.CENTER,
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
          },
        }),
      ],
    });

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Calibri", size: 22, color: THEME.text },
            paragraph: { spacing: { line: 276 } },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
          },
        },
        footers: { default: footer },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (err) {
    console.error("generate-doc error:", err);
    res.status(500).json({ error: "Failed to generate document" });
  }
});

// ── PPTX builder ─────────────────────────────────────────────────────────────

router.post("/generate-pptx", verifyUser, async (req, res) => {
  try {
    const { content, filename = "eloria-presentation.pptx" } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });

    const slides = parseSlides(content);
    const pptx = new PptxGenJS();

    pptx.defineLayout({ name: "LAYOUT_16x9", width: 10, height: 5.625 });
    pptx.layout = "LAYOUT_16x9";
    pptx.author = "Eloria AI";
    pptx.company = "Kairox";

    slides.forEach((lines, slideIndex) => {
      const slide = pptx.addSlide();
      const isFirst = slideIndex === 0;

      // ── Background ──
      if (isFirst) {
        // Cover slide — solid dark blue
        slide.background = { color: THEME.primary };
      } else {
        // Content slides — white with left accent bar
        slide.background = { color: THEME.white };
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 0.08, h: 5.625,
          fill: { color: THEME.primary },
          line: { color: THEME.primary },
        });
        // subtle top bar
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 10, h: 0.08,
          fill: { color: THEME.accent },
          line: { color: THEME.accent },
        });
        // bottom bar
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 5.545, w: 10, h: 0.08,
          fill: { color: THEME.primary },
          line: { color: THEME.primary },
        });
        // slide number
        slide.addText(`${slideIndex + 1}`, {
          x: 9.3, y: 5.2, w: 0.5, h: 0.3,
          fontSize: 10, color: THEME.muted,
          fontFace: "Calibri", align: "right",
        });
        // branding
        slide.addText("Eloria AI", {
          x: 0.15, y: 5.2, w: 1.5, h: 0.3,
          fontSize: 10, color: THEME.white,
          fontFace: "Calibri",
        });
      }

      let y = isFirst ? 1.6 : 0.55;

      lines.forEach(line => {
        if (line.type === "h1") {
          if (isFirst) {
            // Big centered cover title
            slide.addText(line.text, {
              x: 0.5, y, w: 9, h: 1.2,
              fontSize: 40, bold: true,
              color: THEME.white,
              fontFace: "Calibri",
              align: "center",
              valign: "middle",
            });
            y += 1.3;
            // accent underline
            slide.addShape(pptx.ShapeType.rect, {
              x: 3.5, y, w: 3, h: 0.05,
              fill: { color: THEME.accent },
              line: { color: THEME.accent },
            });
            y += 0.3;
          } else {
            // Section title on content slides
            slide.addShape(pptx.ShapeType.rect, {
              x: 0.15, y: y - 0.05, w: 9.7, h: 0.65,
              fill: { color: THEME.light },
              line: { color: THEME.border },
            });
            slide.addText(line.text, {
              x: 0.25, y, w: 9.5, h: 0.55,
              fontSize: 22, bold: true,
              color: THEME.primary,
              fontFace: "Calibri",
              valign: "middle",
            });
            y += 0.75;
          }

        } else if (line.type === "bullet") {
          slide.addText([
            { text: "▸  ", options: { color: THEME.accent, bold: true } },
            { text: line.text, options: { color: THEME.text } },
          ], {
            x: 0.35, y, w: 9.3, h: 0.42,
            fontSize: 15,
            fontFace: "Calibri",
            valign: "middle",
          });
          y += 0.48;

        } else if (line.type === "h2") {
          slide.addText(line.text, {
            x: 0.35, y, w: 9.3, h: 0.4,
            fontSize: 17, bold: true,
            color: THEME.accent,
            fontFace: "Calibri",
          });
          y += 0.5;

        } else if (line.type === "bold") {
          slide.addText(line.text, {
            x: 0.35, y, w: 9.3, h: 0.4,
            fontSize: 15, bold: true,
            color: THEME.dark,
            fontFace: "Calibri",
          });
          y += 0.45;

        } else {
          // subtitle on cover, body text on others
          slide.addText(line.text, {
            x: 0.5, y, w: 9,
            fontSize: isFirst ? 18 : 14,
            color: isFirst ? "D0DEFA" : THEME.muted,
            fontFace: "Calibri",
            align: isFirst ? "center" : "left",
          });
          y += isFirst ? 0.5 : 0.4;
        }
      });
    });

    const buffer = await pptx.write({ outputType: "nodebuffer" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (err) {
    console.error("generate-pptx error:", err);
    res.status(500).json({ error: "Failed to generate presentation" });
  }
});

export default router;