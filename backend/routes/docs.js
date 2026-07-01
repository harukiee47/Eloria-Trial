import express from "express";
import { verifyUser } from "../middleware/auth.js";
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun,
  AlignmentType, BorderStyle, ShadingType, PageNumber,
  Header, Footer, Table, TableRow, TableCell, WidthType,
  UnderlineType, TabStopType, TabStopLeader,
} from "docx";
import PptxGenJS from "pptxgenjs";

const router = express.Router();

// ── Theme ─────────────────────────────────────────────────────────────────────

const THEME = {
  primary:   "0D1B2A",   // near-black navy
  accent:    "C9A84C",   // gold
  accent2:   "1B4F72",   // deep sapphire
  highlight: "F0E6CC",   // warm gold tint
  light:     "F7F9FC",   // off-white
  text:      "1A1A2E",   // rich dark
  muted:     "7F8C8D",   // cool grey
  white:     "FFFFFF",
  border:    "C9A84C",   // gold border
  subtle:    "ECF0F1",   // light rule
  red:       "C0392B",
  green:     "1E8449",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseMarkdownDoc(raw) {
  return raw.split("\n").filter(l => l.trim()).map(line => {
    if (line.startsWith("# "))    return { type: "h1",     text: line.slice(2).trim() };
    if (line.startsWith("## "))   return { type: "h2",     text: line.slice(3).trim() };
    if (line.startsWith("### "))  return { type: "h3",     text: line.slice(4).trim() };
    if (line.startsWith("- "))    return { type: "bullet", text: line.slice(2).trim() };
    if (line.startsWith("  - "))  return { type: "bullet2",text: line.slice(4).trim() };
    if (/^\*\*(.+)\*\*$/.test(line.trim())) return { type: "bold", text: line.trim().replace(/\*\*/g, "") };
    if (/^\d+\.\s/.test(line.trim())) return { type: "numbered", text: line.trim().replace(/^\d+\.\s/, ""), num: line.trim().match(/^(\d+)\./)[1] };
    return { type: "text", text: line.trim() };
  });
}

function parseSlides(raw) {
  return raw.split(/\n---\n/).map(slide => parseMarkdownDoc(slide));
}

function stripInlineMarkdown(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1");
}

// ── DOCX builder ──────────────────────────────────────────────────────────────

router.post("/generate-doc", verifyUser, async (req, res) => {
  try {
    const { content, filename = "eloria-document.docx" } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });

    const lines = parseMarkdownDoc(content);
    const children = [];
    let bulletBuffer = [];
    let numberedBuffer = [];
    let isFirstH1 = true;
    let numberedCount = 0;

    const flushBullets = () => {
      bulletBuffer.forEach(({ text, level }) => {
        const isNested = level === 2;
        children.push(new Paragraph({
          children: [
            new TextRun({
              text: isNested ? "◦  " : "◆  ",
              font: "Calibri",
              size: isNested ? 18 : 20,
              color: isNested ? THEME.muted : THEME.accent,
              bold: !isNested,
            }),
            new TextRun({
              text: stripInlineMarkdown(text),
              font: "Georgia",
              size: isNested ? 19 : 21,
              color: THEME.text,
            }),
          ],
          spacing: { after: isNested ? 50 : 80, before: isNested ? 30 : 50 },
          indent: { left: isNested ? 720 : 440 },
        }));
      });
      bulletBuffer = [];
    };

    const flushNumbered = () => {
      numberedBuffer.forEach(({ text, num }) => {
        children.push(new Paragraph({
          children: [
            new TextRun({
              text: `${num}.  `,
              font: "Calibri",
              size: 21,
              color: THEME.accent,
              bold: true,
            }),
            new TextRun({
              text: stripInlineMarkdown(text),
              font: "Georgia",
              size: 21,
              color: THEME.text,
            }),
          ],
          spacing: { after: 80, before: 50 },
          indent: { left: 360 },
        }));
      });
      numberedBuffer = [];
      numberedCount = 0;
    };

    lines.forEach(line => {
      if (line.type !== "bullet" && line.type !== "bullet2" && bulletBuffer.length) flushBullets();
      if (line.type !== "numbered" && numberedBuffer.length) flushNumbered();

      switch (line.type) {

        // ── COVER TITLE ──
        case "h1":
          if (isFirstH1) {
            isFirstH1 = false;

            // Gold top rule
            children.push(new Paragraph({
              children: [new TextRun({ text: "", size: 2 })],
              shading: { type: ShadingType.SOLID, color: THEME.accent },
              spacing: { before: 0, after: 0 },
            }));

            // Dark navy cover block
            children.push(new Paragraph({
              children: [
                new TextRun({
                  text: line.text.toUpperCase(),
                  bold: true,
                  font: "Palatino Linotype",
                  size: 64,
                  color: THEME.white,
                  characterSpacing: 80,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 560, after: 560 },
              shading: { type: ShadingType.SOLID, color: THEME.primary },
            }));

            // Gold bottom rule
            children.push(new Paragraph({
              children: [new TextRun({ text: "", size: 2 })],
              shading: { type: ShadingType.SOLID, color: THEME.accent },
              spacing: { before: 0, after: 0 },
            }));

            // Subtitle label
            children.push(new Paragraph({
              children: [
                new TextRun({
                  text: "PREPARED BY ELORIA AI",
                  font: "Calibri",
                  size: 17,
                  color: THEME.muted,
                  characterSpacing: 120,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 600 },
            }));

            // Divider line
            children.push(new Paragraph({
              children: [new TextRun({ text: "" })],
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.subtle },
              },
              spacing: { before: 0, after: 400 },
            }));

          } else {
            // Secondary H1
            children.push(new Paragraph({
              children: [
                new TextRun({
                  text: line.text.toUpperCase(),
                  bold: true,
                  font: "Palatino Linotype",
                  size: 40,
                  color: THEME.primary,
                  characterSpacing: 60,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 560, after: 200 },
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 8, color: THEME.accent },
              },
            }));
          }
          break;

        // ── SECTION HEADING ──
        case "h2":
          // Gold left bar + dark navy bg
          children.push(new Paragraph({
            children: [
              new TextRun({ text: "  ", font: "Calibri", size: 28 }),
              new TextRun({
                text: line.text.toUpperCase(),
                bold: true,
                font: "Calibri",
                size: 26,
                color: THEME.white,
                characterSpacing: 60,
              }),
            ],
            spacing: { before: 480, after: 160 },
            shading: { type: ShadingType.SOLID, color: THEME.accent2 },
            border: {
              left:   { style: BorderStyle.SINGLE, size: 20, color: THEME.accent },
              bottom: { style: BorderStyle.SINGLE, size: 2,  color: THEME.accent },
            },
          }));
          break;

        // ── SUB HEADING ──
        case "h3":
          children.push(new Paragraph({
            children: [
              new TextRun({
                text: "— ",
                font: "Calibri",
                size: 22,
                color: THEME.accent,
                bold: true,
              }),
              new TextRun({
                text: line.text,
                bold: true,
                font: "Palatino Linotype",
                size: 26,
                color: THEME.accent2,
                underline: { type: UnderlineType.NONE },
              }),
            ],
            spacing: { before: 320, after: 100 },
          }));
          break;

        // ── BOLD LINE ──
        case "bold":
          children.push(new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                bold: true,
                font: "Calibri",
                size: 23,
                color: THEME.primary,
              }),
            ],
            spacing: { before: 180, after: 80 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 8, color: THEME.accent },
            },
            indent: { left: 200 },
          }));
          break;

        // ── BULLETS ──
        case "bullet":
          bulletBuffer.push({ text: line.text, level: 1 });
          break;
        case "bullet2":
          bulletBuffer.push({ text: line.text, level: 2 });
          break;

        // ── NUMBERED ──
        case "numbered":
          numberedCount++;
          numberedBuffer.push({ text: line.text, num: numberedCount });
          break;

        // ── BODY TEXT ──
        default:
          children.push(new Paragraph({
            children: [
              new TextRun({
                text: stripInlineMarkdown(line.text),
                font: "Georgia",
                size: 22,
                color: THEME.text,
              }),
            ],
            spacing: { before: 80, after: 120 },
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: 360 },
          }));
      }
    });

    if (bulletBuffer.length) flushBullets();
    if (numberedBuffer.length) flushNumbered();

    // ── Header ──
    const header = new Header({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "ELORIA AI",
              font: "Calibri",
              size: 16,
              color: THEME.accent,
              bold: true,
              characterSpacing: 100,
            }),
            new TextRun({
              text: "  •  Confidential Document",
              font: "Calibri",
              size: 16,
              color: THEME.muted,
            }),
          ],
          alignment: AlignmentType.RIGHT,
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.accent },
          },
          spacing: { after: 0 },
        }),
      ],
    });

    // ── Footer ──
    const footer = new Footer({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "Generated by Eloria AI  ·  ",
              font: "Calibri",
              size: 17,
              color: THEME.muted,
            }),
            new TextRun({
              text: "Page ",
              font: "Calibri",
              size: 17,
              color: THEME.muted,
            }),
            new TextRun({
              children: [PageNumber.CURRENT],
              font: "Calibri",
              size: 17,
              color: THEME.accent,
              bold: true,
            }),
            new TextRun({
              text: " / ",
              font: "Calibri",
              size: 17,
              color: THEME.muted,
            }),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              font: "Calibri",
              size: 17,
              color: THEME.muted,
            }),
          ],
          alignment: AlignmentType.CENTER,
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: THEME.accent },
          },
          spacing: { before: 120 },
        }),
      ],
    });

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Georgia", size: 22, color: THEME.text },
            paragraph: { spacing: { line: 288 } },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1260, right: 1080 },
          },
        },
        headers: { default: header },
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

// ── PPTX builder ──────────────────────────────────────────────────────────────

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
      const isLast = slideIndex === slides.length - 1;

      if (isFirst) {
        // ── COVER SLIDE ──────────────────────────────────────────
        // Full dark background
        slide.background = { color: THEME.primary };

        // Gold diagonal accent stripe (simulated with rect)
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 4.8, w: 10, h: 0.06,
          fill: { color: THEME.accent },
          line: { color: THEME.accent },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 10, h: 0.06,
          fill: { color: THEME.accent },
          line: { color: THEME.accent },
        });

        // Left gold vertical bar
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 0.12, h: 5.625,
          fill: { color: THEME.accent },
          line: { color: THEME.accent },
        });

        // Watermark text top right
        slide.addText("ELORIA AI", {
          x: 7.2, y: 0.18, w: 2.6, h: 0.35,
          fontSize: 10, color: "C9A84C",
          fontFace: "Calibri", bold: true,
          charSpacing: 6, align: "right", transparency: 30,
        });

        let y = 1.2;
        lines.forEach(line => {
          if (line.type === "h1") {
            slide.addText(line.text, {
              x: 0.4, y, w: 9.2, h: 1.5,
              fontSize: 46, bold: true,
              color: THEME.white,
              fontFace: "Palatino Linotype",
              align: "left", valign: "middle",
              charSpacing: 2,
            });
            y += 1.55;
            // Gold underline
            slide.addShape(pptx.ShapeType.rect, {
              x: 0.4, y, w: 4, h: 0.045,
              fill: { color: THEME.accent },
              line: { color: THEME.accent },
            });
            y += 0.18;
          } else if (line.type === "h2") {
            slide.addText(line.text.toUpperCase(), {
              x: 0.4, y, w: 9, h: 0.5,
              fontSize: 16, bold: true,
              color: THEME.accent,
              fontFace: "Calibri",
              align: "left", charSpacing: 4,
            });
            y += 0.52;
          } else {
            slide.addText(line.text, {
              x: 0.4, y, w: 8.5, h: 0.45,
              fontSize: 16,
              color: "A8C0D6",
              fontFace: "Calibri",
              align: "left",
            });
            y += 0.48;
          }
        });

        // Bottom date/branding bar
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 5.0, w: 10, h: 0.625,
          fill: { color: "091623" },
          line: { color: "091623" },
        });
        slide.addText("Confidential  ·  Generated by Eloria AI", {
          x: 0.3, y: 5.1, w: 9.4, h: 0.4,
          fontSize: 10, color: "5D8AA8",
          fontFace: "Calibri", align: "center",
          charSpacing: 2,
        });

      } else if (isLast && lines.length <= 3) {
        // ── CLOSING SLIDE ─────────────────────────────────────────
        slide.background = { color: THEME.accent2 };

        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 10, h: 0.06,
          fill: { color: THEME.accent },
          line: { color: THEME.accent },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 5.565, w: 10, h: 0.06,
          fill: { color: THEME.accent },
          line: { color: THEME.accent },
        });

        lines.forEach((line, i) => {
          slide.addText(line.text, {
            x: 0.5, y: 1.8 + i * 0.9, w: 9, h: 0.8,
            fontSize: line.type === "h1" ? 38 : 20,
            bold: line.type === "h1",
            color: line.type === "h1" ? THEME.white : "C5D9E8",
            fontFace: line.type === "h1" ? "Palatino Linotype" : "Calibri",
            align: "center",
          });
        });

        slide.addText("ELORIA AI", {
          x: 0.3, y: 5.1, w: 9.4, h: 0.35,
          fontSize: 10, color: THEME.accent,
          fontFace: "Calibri", bold: true,
          charSpacing: 8, align: "center",
        });

      } else {
        // ── CONTENT SLIDES ────────────────────────────────────────
        slide.background = { color: THEME.white };

        // Left navy sidebar
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 0.1, h: 5.625,
          fill: { color: THEME.primary },
          line: { color: THEME.primary },
        });

        // Top bar with gold accent
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 10, h: 0.55,
          fill: { color: THEME.primary },
          line: { color: THEME.primary },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0.55, w: 10, h: 0.04,
          fill: { color: THEME.accent },
          line: { color: THEME.accent },
        });

        // Bottom bar
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 5.28, w: 10, h: 0.345,
          fill: { color: THEME.primary },
          line: { color: THEME.primary },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 5.275, w: 10, h: 0.04,
          fill: { color: THEME.accent },
          line: { color: THEME.accent },
        });

        // Branding + slide number in footer
        slide.addText("ELORIA AI", {
          x: 0.2, y: 5.31, w: 2, h: 0.28,
          fontSize: 9, color: THEME.accent,
          fontFace: "Calibri", bold: true, charSpacing: 5,
        });
        slide.addText(`${slideIndex}`, {
          x: 8.8, y: 5.31, w: 0.9, h: 0.28,
          fontSize: 9, color: THEME.muted,
          fontFace: "Calibri", align: "right",
        });

        let y = 0.08;

        lines.forEach(line => {
          if (line.type === "h1") {
            // Slide title in top bar
            slide.addText(line.text, {
              x: 0.2, y: 0.07, w: 9.4, h: 0.44,
              fontSize: 20, bold: true,
              color: THEME.white,
              fontFace: "Calibri",
              valign: "middle", charSpacing: 1,
            });
            y = 0.75;

          } else if (line.type === "h2") {
            // Section divider
            slide.addShape(pptx.ShapeType.rect, {
              x: 0.18, y: y + 0.02, w: 9.65, h: 0.42,
              fill: { color: "EAF0F6" },
              line: { color: THEME.accent, width: 0.5 },
            });
            slide.addShape(pptx.ShapeType.rect, {
              x: 0.18, y: y + 0.02, w: 0.06, h: 0.42,
              fill: { color: THEME.accent },
              line: { color: THEME.accent },
            });
            slide.addText(line.text, {
              x: 0.32, y: y + 0.03, w: 9.3, h: 0.38,
              fontSize: 14, bold: true,
              color: THEME.accent2,
              fontFace: "Calibri",
              valign: "middle", charSpacing: 1,
            });
            y += 0.56;

          } else if (line.type === "h3") {
            slide.addText("▪  " + line.text, {
              x: 0.25, y, w: 9.4, h: 0.38,
              fontSize: 13, bold: true,
              color: THEME.accent2,
              fontFace: "Calibri",
            });
            y += 0.44;

          } else if (line.type === "bullet") {
            slide.addText([
              { text: "◆  ", options: { color: THEME.accent, bold: true, fontSize: 11 } },
              { text: stripInlineMarkdown(line.text), options: { color: THEME.text, fontSize: 13 } },
            ], {
              x: 0.3, y, w: 9.35, h: 0.4,
              fontFace: "Calibri",
              valign: "middle",
            });
            y += 0.44;

          } else if (line.type === "bullet2") {
            slide.addText([
              { text: "  ◦  ", options: { color: THEME.muted, fontSize: 10 } },
              { text: stripInlineMarkdown(line.text), options: { color: THEME.muted, fontSize: 12 } },
            ], {
              x: 0.4, y, w: 9.2, h: 0.36,
              fontFace: "Calibri",
              valign: "middle",
            });
            y += 0.4;

          } else if (line.type === "bold") {
            slide.addText(line.text, {
              x: 0.25, y, w: 9.4, h: 0.38,
              fontSize: 13, bold: true,
              color: THEME.primary,
              fontFace: "Calibri",
            });
            y += 0.42;

          } else if (line.type === "numbered") {
            slide.addText([
              { text: `${line.num}.  `, options: { color: THEME.accent, bold: true, fontSize: 13 } },
              { text: stripInlineMarkdown(line.text), options: { color: THEME.text, fontSize: 13 } },
            ], {
              x: 0.3, y, w: 9.35, h: 0.4,
              fontFace: "Calibri",
              valign: "middle",
            });
            y += 0.44;

          } else {
            slide.addText(stripInlineMarkdown(line.text), {
              x: 0.25, y, w: 9.4, h: 0.38,
              fontSize: 13,
              color: THEME.muted,
              fontFace: "Calibri",
            });
            y += 0.42;
          }
        });
      }
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