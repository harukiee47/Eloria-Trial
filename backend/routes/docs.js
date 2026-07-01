import express from "express";
import { verifyUser } from "../middleware/auth.js";
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, ShadingType, PageNumber,
  Header, Footer, UnderlineType,
} from "docx";
import PptxGenJS from "pptxgenjs";

const router = express.Router();

const THEME = {
  primary:  "0D1B2A",
  accent:   "C9A84C",
  accent2:  "1B4F72",
  text:     "1A1A2E",
  muted:    "7F8C8D",
  white:    "FFFFFF",
  light:    "F4F6F8",
  border:   "C9A84C",
  subtle:   "DEE2E6",
};

// ── Inline markdown parser → TextRun[] ───────────────────────────────────────
// Handles **bold**, *italic*, `code`, and plain text mixed together

function parseInline(text, baseOpts = {}) {
  const runs = [];
  // regex: captures **bold**, *italic*, `code`, or plain text chunks
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1] !== undefined) {
      runs.push(new TextRun({
        text: match[1],
        bold: true,
        ...baseOpts,
      }));
    } else if (match[2] !== undefined) {
      runs.push(new TextRun({
        text: match[2],
        italics: true,
        ...baseOpts,
      }));
    } else if (match[3] !== undefined) {
      runs.push(new TextRun({
        text: match[3],
        font: "Courier New",
        size: (baseOpts.size || 22) - 2,
        color: "C0392B",
        highlight: "yellow",
        ...baseOpts,
        font: "Courier New",
      }));
    } else if (match[4] !== undefined) {
      const t = match[4];
      if (t.trim()) {
        runs.push(new TextRun({
          text: t,
          ...baseOpts,
        }));
      }
    }
  }
  return runs.length ? runs : [new TextRun({ text, ...baseOpts })];
}

// ── Line classifier ───────────────────────────────────────────────────────────

function classifyLine(raw) {
  const line = raw.trim();
  if (!line) return null;

  // Explicit markdown headings
  if (line.startsWith("# "))   return { type: "h1",     text: line.slice(2).trim() };
  if (line.startsWith("## "))  return { type: "h2",     text: line.slice(3).trim() };
  if (line.startsWith("### ")) return { type: "h3",     text: line.slice(4).trim() };

  // Bullet lines (with or without inline bold)
  if (line.startsWith("- ") || line.startsWith("• ")) {
    return { type: "bullet", text: line.replace(/^[-•]\s*/, "") };
  }

  // Strip outer ** to check what's inside
  const innerBold = line.match(/^\*\*(.+)\*\*$/);
  const inner = innerBold ? innerBold[1].trim() : null;

  if (inner) {
    const isAllCaps = inner === inner.toUpperCase() && inner.length > 3 && !/[a-z]/.test(inner);
    const isShort   = inner.length < 60;
    const hasSymbols = /[&'—]/.test(inner); // "Founder & Owner", "Let's"

    // ALL CAPS bold short line = section heading
    if (isAllCaps && isShort && !hasSymbols) {
      return { type: "h2", text: inner };
    }

    // Short bold line (not all caps) = subheading or label
    if (isShort && !hasSymbols) {
      // Check if it looks like a name/title (no sentence punctuation)
      if (!/[.!?,]/.test(inner)) return { type: "h3", text: inner };
    }
  }

  // Numbered list
  const numbered = line.match(/^(\d+)[.)]\s+(.+)/);
  if (numbered) return { type: "numbered", text: numbered[2], num: numbered[1] };

  // Horizontal rule
  if (/^[-*_]{3,}$/.test(line)) return { type: "rule" };

  // Default: body text (may contain inline markdown)
  return { type: "text", text: line };
}

// ── DOCX ─────────────────────────────────────────────────────────────────────

router.post("/generate-doc", verifyUser, async (req, res) => {
  try {
    const { content, filename = "eloria-document.docx" } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });

    const rawLines = content.split("\n");
    const lines = rawLines.map(classifyLine).filter(Boolean);

    const children = [];
    let bulletBuffer = [];
    let numberedBuffer = [];
    let isFirstH1 = true;
    let docTitle = "";

    const flushBullets = () => {
      if (!bulletBuffer.length) return;
      bulletBuffer.forEach(({ text }) => {
        // Split bullet at " — " to style the label differently
        const dashIdx = text.indexOf(" — ");
        const hasDash = dashIdx !== -1;
        const labelPart = hasDash ? text.slice(0, dashIdx) : null;
        const restPart  = hasDash ? text.slice(dashIdx) : text;

        const runs = [];
        if (hasDash) {
          // parse the label part inline
          const labelRuns = parseInline(labelPart, {
            font: "Calibri", size: 21, color: THEME.accent2, bold: true,
          });
          runs.push(...labelRuns);
          runs.push(new TextRun({
            text: restPart,
            font: "Georgia", size: 21, color: THEME.text,
          }));
        } else {
          runs.push(...parseInline(text, {
            font: "Georgia", size: 21, color: THEME.text,
          }));
        }

        children.push(new Paragraph({
          children: [
            new TextRun({ text: "◆  ", font: "Calibri", size: 20, color: THEME.accent, bold: true }),
            ...runs,
          ],
          spacing: { before: 60, after: 80 },
          indent: { left: 440 },
        }));
      });
      bulletBuffer = [];
    };

    const flushNumbered = () => {
      if (!numberedBuffer.length) return;
      numberedBuffer.forEach(({ text, num }) => {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${num}.  `, font: "Calibri", size: 21, color: THEME.accent, bold: true }),
            ...parseInline(text, { font: "Georgia", size: 21, color: THEME.text }),
          ],
          spacing: { before: 60, after: 80 },
          indent: { left: 400 },
        }));
      });
      numberedBuffer = [];
    };

    lines.forEach(line => {
      if (line.type !== "bullet")   flushBullets();
      if (line.type !== "numbered") flushNumbered();

      switch (line.type) {

        case "h1":
          if (isFirstH1) {
            isFirstH1 = false;
            docTitle = line.text;

            // Gold top stripe
            children.push(new Paragraph({
              children: [new TextRun({ text: " ", size: 8 })],
              shading: { type: ShadingType.SOLID, color: THEME.accent },
              spacing: { before: 0, after: 0 },
            }));

            // Navy cover block
            children.push(new Paragraph({
              children: [
                new TextRun({
                  text: line.text.toUpperCase(),
                  bold: true,
                  font: "Palatino Linotype",
                  size: 64,
                  color: THEME.white,
                  characterSpacing: 60,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 600, after: 500 },
              shading: { type: ShadingType.SOLID, color: THEME.primary },
            }));

            // Gold bottom stripe
            children.push(new Paragraph({
              children: [new TextRun({ text: " ", size: 8 })],
              shading: { type: ShadingType.SOLID, color: THEME.accent },
              spacing: { before: 0, after: 0 },
            }));

            // Byline
            children.push(new Paragraph({
              children: [new TextRun({
                text: "PREPARED BY ELORIA AI",
                font: "Calibri", size: 17,
                color: THEME.muted, characterSpacing: 120,
              })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 240, after: 600 },
            }));

            // Divider
            children.push(new Paragraph({
              children: [new TextRun({ text: "" })],
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: THEME.accent } },
              spacing: { before: 0, after: 480 },
            }));

          } else {
            children.push(new Paragraph({
              children: [new TextRun({
                text: line.text.toUpperCase(),
                bold: true, font: "Palatino Linotype",
                size: 40, color: THEME.primary, characterSpacing: 40,
              })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 560, after: 200 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: THEME.accent } },
            }));
          }
          break;

        case "h2":
          children.push(new Paragraph({
            children: [
              new TextRun({ text: "  ", size: 26 }),
              new TextRun({
                text: line.text.toUpperCase(),
                bold: true, font: "Calibri",
                size: 24, color: THEME.white, characterSpacing: 60,
              }),
            ],
            spacing: { before: 480, after: 160 },
            shading: { type: ShadingType.SOLID, color: THEME.accent2 },
            border: {
              left:   { style: BorderStyle.SINGLE, size: 18, color: THEME.accent },
              bottom: { style: BorderStyle.SINGLE, size: 2,  color: THEME.accent },
            },
          }));
          break;

        case "h3":
          children.push(new Paragraph({
            children: [
              new TextRun({ text: "— ", font: "Calibri", size: 22, color: THEME.accent, bold: true }),
              new TextRun({
                text: line.text, bold: true,
                font: "Palatino Linotype", size: 25, color: THEME.accent2,
              }),
            ],
            spacing: { before: 280, after: 100 },
          }));
          break;

        case "bullet":
          bulletBuffer.push({ text: line.text });
          break;

        case "numbered":
          numberedBuffer.push({ text: line.text, num: line.num });
          break;

        case "rule":
          children.push(new Paragraph({
            children: [new TextRun({ text: "" })],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.subtle } },
            spacing: { before: 200, after: 200 },
          }));
          break;

        default: // text
          children.push(new Paragraph({
            children: parseInline(line.text, {
              font: "Georgia", size: 22, color: THEME.text,
            }),
            spacing: { before: 80, after: 120 },
            alignment: AlignmentType.JUSTIFIED,
          }));
      }
    });

    flushBullets();
    flushNumbered();

    // ── Header ──
    const header = new Header({
      children: [new Paragraph({
        children: [
          new TextRun({ text: docTitle || "ELORIA AI", font: "Calibri", size: 16, color: THEME.accent, bold: true, characterSpacing: 80 }),
          new TextRun({ text: "  ·  Confidential", font: "Calibri", size: 16, color: THEME.muted }),
        ],
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.accent } },
      })],
    });

    // ── Footer ──
    const footer = new Footer({
      children: [new Paragraph({
        children: [
          new TextRun({ text: "Generated by Eloria AI  ·  Page ", font: "Calibri", size: 17, color: THEME.muted }),
          new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 17, color: THEME.accent, bold: true }),
          new TextRun({ text: " / ", font: "Calibri", size: 17, color: THEME.muted }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Calibri", size: 17, color: THEME.muted }),
        ],
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: THEME.accent } },
        spacing: { before: 120 },
      })],
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
          page: { margin: { top: 1080, bottom: 1080, left: 1260, right: 1080 } },
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

// ── PPTX ─────────────────────────────────────────────────────────────────────

router.post("/generate-pptx", verifyUser, async (req, res) => {
  try {
    const { content, filename = "eloria-presentation.pptx" } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });

    const slides = content.split(/\n---\n/).map(block =>
      block.split("\n").map(classifyLine).filter(Boolean)
    );

    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "LAYOUT_16x9", width: 10, height: 5.625 });
    pptx.layout = "LAYOUT_16x9";
    pptx.author = "Eloria AI";

    // helper: strip all markdown for pptx plain text
    const plain = (text) => text
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g,   "$1")
      .replace(/`(.+?)`/g,     "$1");

    // helper: rich text array splitting "Label — rest" for bullets
    const bulletRuns = (text) => {
      const dashIdx = text.indexOf(" — ");
      if (dashIdx === -1) return [{ text: plain(text), options: { color: THEME.text, fontSize: 14, fontFace: "Calibri" } }];
      return [
        { text: plain(text.slice(0, dashIdx)), options: { color: THEME.accent2, fontSize: 14, bold: true, fontFace: "Calibri" } },
        { text: plain(text.slice(dashIdx)),    options: { color: THEME.text,    fontSize: 14, fontFace: "Calibri" } },
      ];
    };

    slides.forEach((lines, si) => {
      const slide = pptx.addSlide();
      const isFirst = si === 0;
      const isLast  = si === slides.length - 1 && lines.length <= 3;

      if (isFirst) {
        // ── COVER ───────────────────────────────────────────────
        slide.background = { color: THEME.primary };

        // Gold bars top & bottom
        slide.addShape(pptx.ShapeType.rect, { x:0, y:0,     w:10, h:0.07, fill:{color:THEME.accent}, line:{color:THEME.accent} });
        slide.addShape(pptx.ShapeType.rect, { x:0, y:5.555, w:10, h:0.07, fill:{color:THEME.accent}, line:{color:THEME.accent} });

        // Left gold bar
        slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.14, h:5.625, fill:{color:THEME.accent}, line:{color:THEME.accent} });

        // Bottom dark strip
        slide.addShape(pptx.ShapeType.rect, { x:0, y:4.9, w:10, h:0.65, fill:{color:"091623"}, line:{color:"091623"} });

        // Branding bottom
        slide.addText("ELORIA AI  ·  Confidential", {
          x:0.3, y:5.0, w:9.4, h:0.35,
          fontSize:9, color:"5D8AA8", fontFace:"Calibri",
          charSpacing:4, align:"center",
        });

        let y = 0.9;
        lines.forEach(line => {
          if (line.type === "h1") {
            slide.addText(plain(line.text).toUpperCase(), {
              x:0.3, y, w:9.4, h:1.6,
              fontSize:44, bold:true, color:THEME.white,
              fontFace:"Palatino Linotype",
              align:"center", valign:"middle", charSpacing:3,
              shadow:{ type:"outer", color:"000000", blur:6, offset:3, angle:45, opacity:0.4 },
            });
            y += 1.7;
            // Gold underline
            slide.addShape(pptx.ShapeType.rect, { x:2.5, y, w:5, h:0.05, fill:{color:THEME.accent}, line:{color:THEME.accent} });
            y += 0.2;
          } else if (line.type === "h2" || line.type === "h3") {
            slide.addText(plain(line.text), {
              x:0.3, y, w:9.4, h:0.5,
              fontSize:17, color:"A8C0D6",
              fontFace:"Calibri", align:"center", charSpacing:2,
            });
            y += 0.55;
          } else {
            slide.addText(plain(line.text), {
              x:0.3, y, w:9.4, h:0.4,
              fontSize:14, color:"6D8FA8",
              fontFace:"Calibri", align:"center",
            });
            y += 0.44;
          }
        });

      } else if (isLast) {
        // ── CLOSING ─────────────────────────────────────────────
        slide.background = { color: THEME.accent2 };
        slide.addShape(pptx.ShapeType.rect, { x:0, y:0,     w:10, h:0.07, fill:{color:THEME.accent}, line:{color:THEME.accent} });
        slide.addShape(pptx.ShapeType.rect, { x:0, y:5.555, w:10, h:0.07, fill:{color:THEME.accent}, line:{color:THEME.accent} });
        slide.addText("ELORIA AI", {
          x:0.3, y:5.15, w:9.4, h:0.35,
          fontSize:9, color:THEME.accent, fontFace:"Calibri",
          bold:true, charSpacing:8, align:"center",
        });
        lines.forEach((line, i) => {
          slide.addText(plain(line.text), {
            x:0.5, y:1.4 + i*1.0, w:9, h:0.9,
            fontSize: line.type === "h1" ? 36 : 18,
            bold: line.type === "h1",
            color: line.type === "h1" ? THEME.white : "C5D9E8",
            fontFace: line.type === "h1" ? "Palatino Linotype" : "Calibri",
            align:"center",
          });
        });

      } else {
        // ── CONTENT SLIDE ────────────────────────────────────────
        slide.background = { color: THEME.white };

        // Navy top bar
        slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:10, h:0.6, fill:{color:THEME.primary}, line:{color:THEME.primary} });
        // Gold accent under top bar
        slide.addShape(pptx.ShapeType.rect, { x:0, y:0.6, w:10, h:0.045, fill:{color:THEME.accent}, line:{color:THEME.accent} });
        // Left navy sidebar
        slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.1, h:5.625, fill:{color:THEME.primary}, line:{color:THEME.primary} });
        // Navy bottom bar
        slide.addShape(pptx.ShapeType.rect, { x:0, y:5.28, w:10, h:0.345, fill:{color:THEME.primary}, line:{color:THEME.primary} });
        // Gold accent above bottom bar
        slide.addShape(pptx.ShapeType.rect, { x:0, y:5.275, w:10, h:0.04, fill:{color:THEME.accent}, line:{color:THEME.accent} });

        // Footer text
        slide.addText("ELORIA AI", { x:0.2, y:5.31, w:2, h:0.28, fontSize:8, color:THEME.accent, fontFace:"Calibri", bold:true, charSpacing:5 });
        slide.addText(`${si}`, { x:8.8, y:5.31, w:0.9, h:0.28, fontSize:8, color:THEME.muted, fontFace:"Calibri", align:"right" });

        let y = 0.09;

        lines.forEach(line => {
          if (line.type === "h1") {
            // Title in top bar
            slide.addText(plain(line.text), {
              x:0.18, y:0.1, w:9.5, h:0.44,
              fontSize:20, bold:true, color:THEME.white,
              fontFace:"Calibri", valign:"middle", charSpacing:1,
            });
            y = 0.75;

          } else if (line.type === "h2") {
            // Section heading with gold left tab
            slide.addShape(pptx.ShapeType.rect, { x:0.18, y:y+0.02, w:9.65, h:0.44, fill:{color:"EAF0F6"}, line:{color:THEME.accent, width:0.5} });
            slide.addShape(pptx.ShapeType.rect, { x:0.18, y:y+0.02, w:0.07, h:0.44, fill:{color:THEME.accent}, line:{color:THEME.accent} });
            slide.addText(plain(line.text).toUpperCase(), {
              x:0.34, y:y+0.03, w:9.3, h:0.38,
              fontSize:13, bold:true, color:THEME.accent2,
              fontFace:"Calibri", valign:"middle", charSpacing:2,
            });
            y += 0.58;

          } else if (line.type === "h3") {
            slide.addText("▪  " + plain(line.text), {
              x:0.22, y, w:9.4, h:0.38,
              fontSize:13, bold:true, color:THEME.accent2,
              fontFace:"Calibri",
            });
            y += 0.44;

          } else if (line.type === "bullet") {
            slide.addText([
              { text:"◆  ", options:{ color:THEME.accent, bold:true, fontSize:11, fontFace:"Calibri" } },
              ...bulletRuns(line.text),
            ], {
              x:0.22, y, w:9.42, h:0.42,
              fontFace:"Calibri", valign:"middle",
            });
            y += 0.46;

          } else if (line.type === "numbered") {
            slide.addText([
              { text:`${line.num}.  `, options:{ color:THEME.accent, bold:true, fontSize:13, fontFace:"Calibri" } },
              { text:plain(line.text), options:{ color:THEME.text, fontSize:13, fontFace:"Calibri" } },
            ], {
              x:0.22, y, w:9.42, h:0.42,
              fontFace:"Calibri", valign:"middle",
            });
            y += 0.46;

          } else if (line.type === "bold") {
            slide.addText(plain(line.text), {
              x:0.22, y, w:9.4, h:0.38,
              fontSize:13, bold:true, color:THEME.primary,
              fontFace:"Calibri",
            });
            y += 0.42;

          } else {
            slide.addText(plain(line.text), {
              x:0.22, y, w:9.4, h:0.38,
              fontSize:13, color:THEME.muted,
              fontFace:"Calibri",
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