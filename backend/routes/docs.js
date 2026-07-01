import express from "express";
import { verifyUser } from "../middleware/auth.js";
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, ShadingType, PageNumber,
  Header, Footer, UnderlineType, Table, TableRow, TableCell,
  WidthType, TableLayoutType, VerticalAlign,
} from "docx";
import PptxGenJS from "pptxgenjs";

const router = express.Router();

// ── Inline markdown parser ────────────────────────────────────────────────────

function parseInline(text, base = {}) {
  const runs = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m[1]) runs.push(new TextRun({ text: m[1], bold: true, ...base }));
    else if (m[2]) runs.push(new TextRun({ text: m[2], italics: true, ...base }));
    else if (m[3]) runs.push(new TextRun({ text: m[3], font: "Courier New", color: "C0392B", ...base, size: (base.size || 22) - 2 }));
    else if (m[4]?.trim()) runs.push(new TextRun({ text: m[4], ...base }));
  }
  return runs.length ? runs : [new TextRun({ text, ...base })];
}

function plain(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1");
}

// ── Line classifier ───────────────────────────────────────────────────────────

function classifyLine(raw) {
  const line = raw.trim();
  if (!line) return null;
  if (line.startsWith("# "))   return { type: "h1",  text: line.slice(2).trim() };
  if (line.startsWith("## "))  return { type: "h2",  text: line.slice(3).trim() };
  if (line.startsWith("### ")) return { type: "h3",  text: line.slice(4).trim() };
  if (line.startsWith("- ") || line.startsWith("• ")) return { type: "bullet", text: line.replace(/^[-•]\s*/, "") };
  if (/^\d+[.)]\s/.test(line)) {
    const m = line.match(/^(\d+)[.)]\s+(.*)/);
    return { type: "numbered", text: m[2], num: m[1] };
  }
  if (/^[-*_]{3,}$/.test(line)) return { type: "rule" };

  const boldMatch = line.match(/^\*\*(.+)\*\*$/);
  if (boldMatch) {
    const inner = boldMatch[1].trim();
    const isAllCaps = inner === inner.toUpperCase() && inner.length > 3 && !/[a-z]/.test(inner) && /[A-Z]/.test(inner);
    if (isAllCaps && inner.length < 60 && !/[&'—]/.test(inner)) return { type: "h2", text: inner };
    if (inner.length < 60 && !/[.!?]/.test(inner)) return { type: "h3", text: inner };
  }
  return { type: "text", text: line };
}

function parseLines(content) {
  return content.split("\n").map(classifyLine).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCX TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Shared bullet builder ─────────────────────────────────────────────────────

function makeBullet(text, opts = {}) {
  const { bullet = "◆", bulletColor = "999999", font = "Helvetica Neue", size = 21, color = "1A1A1A", indent = 440 } = opts;
  const dashIdx = text.indexOf(" — ");
  const runs = [];
  runs.push(new TextRun({ text: `${bullet}  `, font: "Calibri", size, color: bulletColor, bold: true }));
  if (dashIdx !== -1) {
    runs.push(...parseInline(text.slice(0, dashIdx), { font, size, color: opts.labelColor || color, bold: true }));
    runs.push(new TextRun({ text: text.slice(dashIdx), font, size, color }));
  } else {
    runs.push(...parseInline(text, { font, size, color }));
  }
  return new Paragraph({ children: runs, spacing: { before: 60, after: 80 }, indent: { left: indent } });
}

// ── APPLE STYLE — Company ─────────────────────────────────────────────────────

function buildCompanyDoc(lines) {
  const T = { black: "000000", grey1: "1D1D1F", grey2: "6E6E73", grey3: "AEAEB2", white: "FFFFFF", rule: "D2D2D7" };
  const children = [];
  let isFirst = true;

  lines.forEach(line => {
    switch (line.type) {
      case "h1":
        if (isFirst) {
          isFirst = false;
          children.push(new Paragraph({ children: [new TextRun({ text: "", size: 2 })], shading: { type: ShadingType.SOLID, color: T.black }, spacing: { before: 0, after: 0 } }));
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Helvetica Neue", size: 72, bold: true, color: T.white, characterSpacing: -20 })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 800, after: 800 },
            shading: { type: ShadingType.SOLID, color: T.black },
          }));
          children.push(new Paragraph({ children: [new TextRun({ text: "", size: 2 })], shading: { type: ShadingType.SOLID, color: T.black }, spacing: { before: 0, after: 600 } }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Helvetica Neue", size: 48, bold: true, color: T.grey1, characterSpacing: -10 })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 160 },
          }));
        }
        break;
      case "h2":
        children.push(new Paragraph({ children: [new TextRun({ text: "" })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } }, spacing: { before: 480, after: 0 } }));
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text).toUpperCase(), font: "Helvetica Neue", size: 20, bold: true, color: T.grey2, characterSpacing: 80 })],
          spacing: { before: 240, after: 120 },
        }));
        break;
      case "h3":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text), font: "Helvetica Neue", size: 26, bold: true, color: T.grey1 })],
          spacing: { before: 240, after: 80 },
        }));
        break;
      case "bullet":
        children.push(makeBullet(line.text, { bullet: "·", bulletColor: T.grey3, font: "Helvetica Neue", size: 21, color: T.grey1, labelColor: T.black, indent: 360 }));
        break;
      case "rule":
        children.push(new Paragraph({ children: [new TextRun({ text: "" })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } }, spacing: { before: 200, after: 200 } }));
        break;
      default:
        children.push(new Paragraph({
          children: parseInline(line.text, { font: "Helvetica Neue", size: 22, color: T.grey1 }),
          spacing: { before: 80, after: 120 },
          alignment: AlignmentType.JUSTIFIED,
        }));
    }
  });
  return children;
}

// ── STRIPE STYLE — Invoice ────────────────────────────────────────────────────

function buildInvoiceDoc(lines) {
  const T = { black: "0A2540", accent: "635BFF", grey1: "425466", grey2: "697386", rule: "E3E8EE", white: "FFFFFF", green: "09825D" };
  const children = [];
  let isFirst = true;

  lines.forEach(line => {
    switch (line.type) {
      case "h1":
        if (isFirst) {
          isFirst = false;
          children.push(new Paragraph({
            children: [
              new TextRun({ text: plain(line.text), font: "Calibri", size: 64, bold: true, color: T.black }),
            ],
            spacing: { before: 200, after: 0 },
          }));
          children.push(new Paragraph({ children: [new TextRun({ text: "", size: 4 })], shading: { type: ShadingType.SOLID, color: T.accent }, spacing: { before: 160, after: 400 } }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 40, bold: true, color: T.black })],
            spacing: { before: 400, after: 160 },
          }));
        }
        break;
      case "h2":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text).toUpperCase(), font: "Calibri", size: 19, bold: true, color: T.accent, characterSpacing: 80 })],
          spacing: { before: 360, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } },
        }));
        break;
      case "h3":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 24, bold: true, color: T.black })],
          spacing: { before: 200, after: 60 },
        }));
        break;
      case "bullet":
        children.push(makeBullet(line.text, { bullet: "→", bulletColor: T.accent, font: "Calibri", size: 21, color: T.grey1, labelColor: T.black, indent: 360 }));
        break;
      case "rule":
        children.push(new Paragraph({ children: [new TextRun({ text: "" })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } }, spacing: { before: 160, after: 160 } }));
        break;
      default:
        children.push(new Paragraph({
          children: parseInline(line.text, { font: "Calibri", size: 21, color: T.grey1 }),
          spacing: { before: 60, after: 80 },
        }));
    }
  });
  return children;
}

// ── MCKINSEY STYLE — Report ───────────────────────────────────────────────────

function buildReportDoc(lines) {
  const T = { navy: "002147", blue: "1B4F8A", accent: "C8A951", white: "FFFFFF", text: "1A1A2E", muted: "5D6D7E", rule: "BDC3C7" };
  const children = [];
  let isFirst = true;

  lines.forEach(line => {
    switch (line.type) {
      case "h1":
        if (isFirst) {
          isFirst = false;
          children.push(new Paragraph({ children: [new TextRun({ text: " ", size: 6 })], shading: { type: ShadingType.SOLID, color: T.accent }, spacing: { before: 0, after: 0 } }));
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text).toUpperCase(), font: "Georgia", size: 60, bold: true, color: T.white, characterSpacing: 40 })],
            alignment: AlignmentType.LEFT,
            spacing: { before: 600, after: 600 },
            shading: { type: ShadingType.SOLID, color: T.navy },
            indent: { left: 440 },
          }));
          children.push(new Paragraph({ children: [new TextRun({ text: " ", size: 6 })], shading: { type: ShadingType.SOLID, color: T.accent }, spacing: { before: 0, after: 600 } }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text).toUpperCase(), font: "Georgia", size: 40, bold: true, color: T.navy })],
            spacing: { before: 560, after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: T.accent } },
          }));
        }
        break;
      case "h2":
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "  ", size: 26 }),
            new TextRun({ text: plain(line.text).toUpperCase(), font: "Calibri", size: 24, bold: true, color: T.white, characterSpacing: 40 }),
          ],
          spacing: { before: 440, after: 140 },
          shading: { type: ShadingType.SOLID, color: T.blue },
          border: { left: { style: BorderStyle.SINGLE, size: 16, color: T.accent } },
        }));
        break;
      case "h3":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text), font: "Georgia", size: 26, bold: true, color: T.blue })],
          spacing: { before: 280, after: 80 },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: T.accent } },
          indent: { left: 200 },
        }));
        break;
      case "bullet":
        children.push(makeBullet(line.text, { bullet: "◆", bulletColor: T.accent, font: "Georgia", size: 21, color: T.text, labelColor: T.navy, indent: 440 }));
        break;
      case "rule":
        children.push(new Paragraph({ children: [new TextRun({ text: "" })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: T.rule } }, spacing: { before: 200, after: 200 } }));
        break;
      default:
        children.push(new Paragraph({
          children: parseInline(line.text, { font: "Georgia", size: 22, color: T.text }),
          spacing: { before: 80, after: 120 },
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 360 },
        }));
    }
  });
  return children;
}

// ── LINEAR STYLE — Resume ─────────────────────────────────────────────────────

function buildResumeDoc(lines) {
  const T = { black: "09090B", accent: "6366F1", grey1: "18181B", grey2: "52525B", grey3: "A1A1AA", rule: "E4E4E7", white: "FFFFFF" };
  const children = [];
  let isFirst = true;

  lines.forEach(line => {
    switch (line.type) {
      case "h1":
        if (isFirst) {
          isFirst = false;
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 64, bold: true, color: T.black, characterSpacing: -20 })],
            spacing: { before: 0, after: 0 },
          }));
          children.push(new Paragraph({ children: [new TextRun({ text: "", size: 4 })], shading: { type: ShadingType.SOLID, color: T.accent }, spacing: { before: 160, after: 300 } }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 40, bold: true, color: T.black })],
            spacing: { before: 400, after: 120 },
          }));
        }
        break;
      case "h2":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text).toUpperCase(), font: "Calibri", size: 19, bold: true, color: T.accent, characterSpacing: 100 })],
          spacing: { before: 360, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } },
        }));
        break;
      case "h3":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 24, bold: true, color: T.grey1 })],
          spacing: { before: 200, after: 40 },
        }));
        break;
      case "bullet":
        children.push(makeBullet(line.text, { bullet: "–", bulletColor: T.accent, font: "Calibri", size: 21, color: T.grey2, labelColor: T.black, indent: 320 }));
        break;
      case "rule":
        children.push(new Paragraph({ children: [new TextRun({ text: "" })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } }, spacing: { before: 160, after: 160 } }));
        break;
      default:
        children.push(new Paragraph({
          children: parseInline(line.text, { font: "Calibri", size: 21, color: T.grey2 }),
          spacing: { before: 60, after: 80 },
        }));
    }
  });
  return children;
}

// ── NOTION STYLE — Meeting ────────────────────────────────────────────────────

function buildMeetingDoc(lines) {
  const T = { black: "1A1A1A", accent: "2F80ED", yellow: "F2C94C", text: "37352F", muted: "9B9A97", rule: "E9E9E7", bg: "F7F6F3", white: "FFFFFF" };
  const children = [];
  let isFirst = true;

  lines.forEach(line => {
    switch (line.type) {
      case "h1":
        if (isFirst) {
          isFirst = false;
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Segoe UI", size: 64, bold: true, color: T.black })],
            spacing: { before: 0, after: 80 },
          }));
          children.push(new Paragraph({ children: [new TextRun({ text: "", size: 4 })], shading: { type: ShadingType.SOLID, color: T.yellow }, spacing: { before: 0, after: 400 } }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Segoe UI", size: 40, bold: true, color: T.black })],
            spacing: { before: 400, after: 120 },
          }));
        }
        break;
      case "h2":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text), font: "Segoe UI", size: 26, bold: true, color: T.black })],
          spacing: { before: 360, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } },
        }));
        break;
      case "h3":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text), font: "Segoe UI", size: 23, bold: true, color: T.accent })],
          spacing: { before: 200, after: 60 },
        }));
        break;
      case "bullet":
        children.push(makeBullet(line.text, { bullet: "☐", bulletColor: T.accent, font: "Segoe UI", size: 21, color: T.text, labelColor: T.black, indent: 360 }));
        break;
      case "rule":
        children.push(new Paragraph({ children: [new TextRun({ text: "" })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } }, spacing: { before: 160, after: 160 } }));
        break;
      default:
        children.push(new Paragraph({
          children: parseInline(line.text, { font: "Segoe UI", size: 21, color: T.text }),
          spacing: { before: 60, after: 80 },
        }));
    }
  });
  return children;
}

// ── AIRBNB STYLE — Proposal ───────────────────────────────────────────────────

function buildProposalDoc(lines) {
  const T = { coral: "FF5A5F", dark: "222222", grey1: "484848", grey2: "767676", rule: "EBEBEB", white: "FFFFFF", teal: "008489" };
  const children = [];
  let isFirst = true;

  lines.forEach(line => {
    switch (line.type) {
      case "h1":
        if (isFirst) {
          isFirst = false;
          children.push(new Paragraph({ children: [new TextRun({ text: " ", size: 6 })], shading: { type: ShadingType.SOLID, color: T.coral }, spacing: { before: 0, after: 0 } }));
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Circular Std", size: 72, bold: true, color: T.white })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 700, after: 700 },
            shading: { type: ShadingType.SOLID, color: T.coral },
          }));
          children.push(new Paragraph({ children: [new TextRun({ text: " ", size: 6 })], shading: { type: ShadingType.SOLID, color: T.coral }, spacing: { before: 0, after: 600 } }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 44, bold: true, color: T.dark })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 560, after: 160 },
          }));
        }
        break;
      case "h2":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 26, bold: true, color: T.coral })],
          spacing: { before: 400, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: T.coral } },
        }));
        break;
      case "h3":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 24, bold: true, color: T.teal })],
          spacing: { before: 200, after: 60 },
        }));
        break;
      case "bullet":
        children.push(makeBullet(line.text, { bullet: "◉", bulletColor: T.coral, font: "Calibri", size: 21, color: T.grey1, labelColor: T.dark, indent: 400 }));
        break;
      case "rule":
        children.push(new Paragraph({ children: [new TextRun({ text: "" })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } }, spacing: { before: 200, after: 200 } }));
        break;
      default:
        children.push(new Paragraph({
          children: parseInline(line.text, { font: "Calibri", size: 22, color: T.grey1 }),
          spacing: { before: 80, after: 120 },
          alignment: AlignmentType.JUSTIFIED,
        }));
    }
  });
  return children;
}

// ── GOOGLE STYLE — General ────────────────────────────────────────────────────

function buildGeneralDoc(lines) {
  const T = { blue: "1A73E8", dark: "202124", grey1: "3C4043", grey2: "5F6368", rule: "DADCE0", white: "FFFFFF" };
  const children = [];
  let isFirst = true;

  lines.forEach(line => {
    switch (line.type) {
      case "h1":
        if (isFirst) {
          isFirst = false;
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Google Sans", size: 64, bold: true, color: T.dark })],
            spacing: { before: 0, after: 80 },
          }));
          children.push(new Paragraph({ children: [new TextRun({ text: "", size: 4 })], shading: { type: ShadingType.SOLID, color: T.blue }, spacing: { before: 0, after: 400 } }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 40, bold: true, color: T.dark })],
            spacing: { before: 400, after: 120 },
          }));
        }
        break;
      case "h2":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 26, bold: true, color: T.blue })],
          spacing: { before: 360, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } },
        }));
        break;
      case "h3":
        children.push(new Paragraph({
          children: [new TextRun({ text: plain(line.text), font: "Calibri", size: 23, bold: true, color: T.grey1 })],
          spacing: { before: 200, after: 60 },
        }));
        break;
      case "bullet":
        children.push(makeBullet(line.text, { bullet: "•", bulletColor: T.blue, font: "Calibri", size: 21, color: T.grey1, labelColor: T.dark, indent: 360 }));
        break;
      case "rule":
        children.push(new Paragraph({ children: [new TextRun({ text: "" })], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: T.rule } }, spacing: { before: 160, after: 160 } }));
        break;
      default:
        children.push(new Paragraph({
          children: parseInline(line.text, { font: "Calibri", size: 22, color: T.grey1 }),
          spacing: { before: 80, after: 100 },
        }));
    }
  });
  return children;
}

// ── DOCX route ────────────────────────────────────────────────────────────────

router.post("/generate-doc", verifyUser, async (req, res) => {
  try {
    const { content, type = "general", filename = "document.docx" } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });

    const lines = parseLines(content);

    const templateMap = {
      company:  buildCompanyDoc,
      invoice:  buildInvoiceDoc,
      report:   buildReportDoc,
      resume:   buildResumeDoc,
      meeting:  buildMeetingDoc,
      proposal: buildProposalDoc,
      general:  buildGeneralDoc,
    };

    const builder = templateMap[type] || buildGeneralDoc;
    const children = builder(lines);

    const T = {
      company:  { accent: "000000", muted: "6E6E73" },
      invoice:  { accent: "635BFF", muted: "697386" },
      report:   { accent: "C8A951", muted: "5D6D7E" },
      resume:   { accent: "6366F1", muted: "52525B" },
      meeting:  { accent: "2F80ED", muted: "9B9A97" },
      proposal: { accent: "FF5A5F", muted: "767676" },
      general:  { accent: "1A73E8", muted: "5F6368" },
    }[type] || { accent: "1A73E8", muted: "5F6368" };

    const docTitle = lines.find(l => l.type === "h1")?.text || "Document";

    const header = new Header({
      children: [new Paragraph({
        children: [
          new TextRun({ text: plain(docTitle).toUpperCase(), font: "Calibri", size: 15, color: T.accent, bold: true, characterSpacing: 80 }),
          new TextRun({ text: "  ·  Confidential", font: "Calibri", size: 15, color: T.muted }),
        ],
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: T.accent } },
      })],
    });

    const footer = new Footer({
      children: [new Paragraph({
        children: [
          new TextRun({ text: "Page ", font: "Calibri", size: 16, color: T.muted }),
          new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 16, color: T.accent, bold: true }),
          new TextRun({ text: " / ", font: "Calibri", size: 16, color: T.muted }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Calibri", size: 16, color: T.muted }),
        ],
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 3, color: T.accent } },
        spacing: { before: 100 },
      })],
    });

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Calibri", size: 22, color: "1A1A1A" },
            paragraph: { spacing: { line: 288 } },
          },
        },
      },
      sections: [{
        properties: { page: { margin: { top: 1080, bottom: 1080, left: 1260, right: 1080 } } },
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

// ── Shared: render one card-style bullet ──────────────────────────────────────
function renderBulletCard(slide, pptx, text, x, y, w, colors, idx) {
  const h = 0.62;
  const dashIdx = text.indexOf(" — ");
  const label = dashIdx !== -1 ? plain(text.slice(0, dashIdx)) : null;
  const rest  = dashIdx !== -1 ? plain(text.slice(dashIdx + 3)) : plain(text);

  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: colors.cardBg },
    line: { color: colors.cardBorder, width: 0.75 },
  });

  slide.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.12, y: y + h / 2 - 0.15, w: 0.3, h: 0.3,
    fill: { color: colors.badgeBg }, line: { color: colors.badgeBg },
  });
  slide.addText(`${idx + 1}`, {
    x: x + 0.12, y: y + h / 2 - 0.15, w: 0.3, h: 0.3,
    fontSize: 12, bold: true, color: colors.badgeText,
    fontFace: colors.font, align: "center", valign: "middle",
  });

  if (label) {
    slide.addText([
      { text: label + "\n", options: { bold: true, fontSize: 13, color: colors.cardTitle, fontFace: colors.font } },
      { text: rest, options: { fontSize: 11, color: colors.cardBody, fontFace: colors.font } },
    ], {
      x: x + 0.55, y: y + 0.05, w: w - 0.7, h: h - 0.1,
      valign: "middle", lineSpacing: 14,
    });
  } else {
    slide.addText(rest, {
      x: x + 0.55, y: y + 0.05, w: w - 0.7, h: h - 0.1,
      fontSize: 13, color: colors.cardBody, fontFace: colors.font, valign: "middle",
    });
  }
}

// ── Shared: lay out bullets as cards, 1 or 2 columns ───────────────────────────
function renderBulletGrid(slide, pptx, bullets, startY, colors) {
  const twoCol = bullets.length > 4;
  const colW = twoCol ? 4.75 : 9.5;
  const gap = 0.16;
  bullets.forEach((b, i) => {
    const col = twoCol ? i % 2 : 0;
    const row = twoCol ? Math.floor(i / 2) : i;
    const x = 0.25 + col * (colW + gap);
    const y = startY + row * (0.62 + gap);
    renderBulletCard(slide, pptx, b.text, x, y, colW, colors, i);
  });
  const rows = twoCol ? Math.ceil(bullets.length / 2) : bullets.length;
  return rows * (0.62 + gap);
}

// ── GRID SYSTEM ─────────────────────────────────────────────────────────────
const GRID = {
  marginX: 0.4,
  contentTop: 0.95,
  contentBottom: 5.28,
  gutter: 0.18,
};

// ── ICON PICKER (restrained — accent color only, no per-icon color chaos) ────
function pickIcon(text) {
  const t = (text || "").toLowerCase();
  if (/\b(grow|increase|scale|expand|revenue)\b/.test(t)) return "▲";
  if (/\b(secure|protect|safety|safe|compliance)\b/.test(t)) return "⛨";
  if (/\b(fast|speed|quick|instant|efficient)\b/.test(t)) return "⚡";
  if (/\b(team|people|staff|hire|culture)\b/.test(t)) return "◔";
  if (/\b(done|complete|success|achieve|deliver)\b/.test(t)) return "✓";
  if (/\b(fail|risk|problem|issue|challenge)\b/.test(t)) return "!";
  if (/\b(idea|innovate|create|design)\b/.test(t)) return "✦";
  if (/\b(global|world|market|reach)\b/.test(t)) return "◎";
  return "→";
}

// ── SLIDE-TYPE PARSER — reads [slide:xxx] tag from raw block text ────────────
function parseSlideBlock(rawBlock) {
  const tagMatch = rawBlock.match(/^\s*\[slide:(\w+)\]\s*\n/);
  const slideType = tagMatch ? tagMatch[1] : "bullets";
  const content = tagMatch ? rawBlock.slice(tagMatch[0].length) : rawBlock;
  const lines = content.split("\n").map(classifyLine).filter(Boolean);
  return { slideType, lines };
}

// ── Restrained bullet card (neutral bg, accent only on icon + left rule) ─────
function renderBulletCard(slide, pptx, text, x, y, w, colors, idx) {
  const h = 0.62;
  const dashIdx = text.indexOf(" — ");
  const label = dashIdx !== -1 ? plain(text.slice(0, dashIdx)) : null;
  const rest  = dashIdx !== -1 ? plain(text.slice(dashIdx + 3)) : plain(text);
  const icon  = pickIcon(label || rest);

  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: colors.neutralBg },
    line: { color: colors.neutralBorder, width: 0.75 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w: 0.035, h, fill: { color: colors.accent }, line: { color: colors.accent },
  });
  slide.addText(icon, {
    x: x + 0.14, y: y + h / 2 - 0.16, w: 0.34, h: 0.32,
    fontSize: 15, bold: true, color: colors.accent,
    fontFace: colors.font, align: "center", valign: "middle",
  });

  if (label) {
    slide.addText([
      { text: label + "\n", options: { bold: true, fontSize: 13, color: colors.title, fontFace: colors.font } },
      { text: rest, options: { fontSize: 11, color: colors.body, fontFace: colors.font } },
    ], { x: x + 0.55, y: y + 0.05, w: w - 0.7, h: h - 0.1, valign: "middle", lineSpacing: 14 });
  } else {
    slide.addText(rest, {
      x: x + 0.55, y: y + 0.05, w: w - 0.7, h: h - 0.1,
      fontSize: 13, color: colors.body, fontFace: colors.font, valign: "middle",
    });
  }
}

function renderBulletGrid(slide, pptx, bullets, startY, colors) {
  const twoCol = bullets.length > 4;
  const colW = twoCol ? (10 - GRID.marginX * 2 - GRID.gutter) / 2 : 10 - GRID.marginX * 2;
  bullets.forEach((b, i) => {
    const col = twoCol ? i % 2 : 0;
    const row = twoCol ? Math.floor(i / 2) : i;
    const x = GRID.marginX + col * (colW + GRID.gutter);
    const y = startY + row * (0.62 + GRID.gutter);
    renderBulletCard(slide, pptx, b.text, x, y, colW, colors, i);
  });
  const rows = twoCol ? Math.ceil(bullets.length / 2) : bullets.length;
  return rows * (0.62 + GRID.gutter);
}

// ── STAT SLIDE — native chart if 3+ numeric stats, else big-number cards ─────
function renderStatSlide(slide, pptx, lines, colors) {
  const title = lines.find(l => l.type === "h1");
  if (title) {
    slide.addText(plain(title.text), {
      x: GRID.marginX, y: 0.3, w: 9.2, h: 0.6,
      fontSize: 24, bold: true, color: colors.title, fontFace: colors.font,
    });
  }

  const stats = lines
    .filter(l => l.type === "text" || l.type === "bullet")
    .map(l => {
      const m = l.text.match(/^(.+?):\s*(.+)$/);
      return m ? { label: plain(m[1]).trim(), rawValue: plain(m[2]).trim() } : null;
    })
    .filter(Boolean);

  // check if all values are cleanly numeric (for a real chart) — strip %, $, commas, +
  const numericStats = stats.map(s => {
    const num = parseFloat(s.rawValue.replace(/[^0-9.\-]/g, ""));
    return isNaN(num) ? null : { label: s.label, value: num, display: s.rawValue };
  });
  const allNumeric = numericStats.every(Boolean) && numericStats.length >= 3;

  if (allNumeric) {
    // Native bar chart
    slide.addChart(pptx.ChartType.bar, [{
      name: "Stats",
      labels: numericStats.map(s => s.label),
      values: numericStats.map(s => s.value),
    }], {
      x: GRID.marginX, y: 1.3, w: 9.2, h: 3.6,
      barDir: "col",
      chartColors: [colors.accent],
      showLegend: false,
      showValue: true,
      dataLabelColor: colors.title,
      dataLabelFontSize: 11,
      catAxisLabelColor: colors.body,
      valAxisLabelColor: colors.body,
      catAxisLabelFontFace: colors.font,
      valAxisLabelFontFace: colors.font,
      chartArea: { fill: { color: "FFFFFF" } },
    });
  } else {
    // Big-number cards fallback
    const n = stats.length || 1;
    const colW = (10 - GRID.marginX * 2 - GRID.gutter * (n - 1)) / n;
    stats.forEach((s, i) => {
      const x = GRID.marginX + i * (colW + GRID.gutter);
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y: 1.6, w: colW, h: 2.2, rectRadius: 0.08,
        fill: { color: colors.neutralBg }, line: { color: colors.neutralBorder, width: 0.75 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x, y: 1.6, w: colW, h: 0.05, fill: { color: colors.accent }, line: { color: colors.accent },
      });
      slide.addText(s.rawValue, {
        x, y: 2.0, w: colW, h: 1.0, fontSize: 32, bold: true,
        color: colors.accent, fontFace: colors.font, align: "center", valign: "middle",
      });
      slide.addText(s.label.toUpperCase(), {
        x: x + 0.1, y: 3.1, w: colW - 0.2, h: 0.5, fontSize: 11,
        color: colors.body, fontFace: colors.font, align: "center", charSpacing: 2,
      });
    });
  }
}

// ── QUOTE SLIDE ───────────────────────────────────────────────────────────────
function renderQuoteSlide(slide, pptx, lines, colors) {
  const attribution = lines.find(l => l.text && l.text.startsWith("—"));
  const quoteLine = lines.find(l => l !== attribution && (l.type === "text" || l.type === "h1"));

  slide.addShape(pptx.ShapeType.rect, {
    x: 4.3, y: 1.3, w: 1.4, h: 0.06, fill: { color: colors.accent }, line: { color: colors.accent },
  });
  if (quoteLine) {
    slide.addText(`"${plain(quoteLine.text)}"`, {
      x: 1.0, y: 1.7, w: 8, h: 2.0, fontSize: 28, italic: true,
      color: colors.title, fontFace: colors.font, align: "center", valign: "middle",
    });
  }
  if (attribution) {
    slide.addText(plain(attribution.text.replace(/^—\s*/, "— ")), {
      x: 1.0, y: 3.9, w: 8, h: 0.5, fontSize: 15,
      color: colors.accent, fontFace: colors.font, align: "center",
    });
  }
}

// ── COMPARISON SLIDE — two-column vs layout ───────────────────────────────────
function renderComparisonSlide(slide, pptx, lines, colors) {
  const title = lines.find(l => l.type === "h1");
  const headers = lines.filter(l => l.type === "h2");
  if (title) {
    slide.addText(plain(title.text), {
      x: GRID.marginX, y: 0.25, w: 9.2, h: 0.55, fontSize: 22, bold: true,
      color: colors.title, fontFace: colors.font,
    });
  }

  const colW = (10 - GRID.marginX * 2 - 0.3) / 2;
  const colXs = [GRID.marginX, GRID.marginX + colW + 0.3];

  headers.forEach((header, ci) => {
    const x = colXs[ci];
    if (x === undefined) return;

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: 1.0, w: colW, h: 0.55, rectRadius: 0.06,
      fill: { color: ci === 0 ? colors.neutralBg : colors.accent },
      line: { color: colors.neutralBorder, width: 0.5 },
    });
    slide.addText(plain(header.text), {
      x, y: 1.0, w: colW, h: 0.55, fontSize: 15, bold: true,
      color: ci === 0 ? colors.title : "FFFFFF", fontFace: colors.font,
      align: "center", valign: "middle",
    });

    const startIdx = lines.indexOf(header) + 1;
    const nextHeaderIdx = lines.findIndex((l, i) => i > startIdx && l.type === "h2");
    const endIdx = nextHeaderIdx === -1 ? lines.length : nextHeaderIdx;
    const bullets = lines.slice(startIdx, endIdx).filter(l => l.type === "bullet");

    bullets.forEach((b, bi) => {
      slide.addText([
        { text: (ci === 0 ? "− " : "✓ "), options: { color: colors.accent, bold: true, fontSize: 12 } },
        { text: plain(b.text), options: { color: colors.body, fontSize: 13 } },
      ], {
        x: x + 0.15, y: 1.75 + bi * 0.5, w: colW - 0.3, h: 0.44,
        fontFace: colors.font, valign: "middle",
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SLIDE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildPptxSlides(pptx, slides, type) {

  const THEMES = {
    pitch: {
      bg: "FFFFFF", titleColor: "111111", accent: "6366F1",
      text: "374151", muted: "9CA3AF", font: "Calibri", titleFont: "Calibri",
    },
    company: {
      bg: "000000", titleColor: "FFFFFF", accent: "FFFFFF",
      text: "D4D4D4", muted: "737373", font: "Helvetica Neue", titleFont: "Helvetica Neue",
    },
    edu: {
      bg: "FFFFFF", titleColor: "0369A1", accent: "0EA5E9",
      text: "1E293B", muted: "64748B", font: "Calibri", titleFont: "Calibri",
    },
    general: {
      bg: "FFFFFF", titleColor: "1E3A5F", accent: "2D6A9F",
      text: "2C3E50", muted: "7F8C8D", font: "Calibri", titleFont: "Calibri",
    },
  };

  const TH = THEMES[type] || THEMES.general;

  slides.forEach((slideData, si) => {
    const { slideType, lines } = slideData;
    const slide = pptx.addSlide();
    const isFirst = si === 0;
    const isLast  = si === slides.length - 1 && lines.length <= 3;

    slide.background = { color: TH.bg };

    if (isFirst) {
      // ── COVER ── (unchanged)
      if (type === "company") {
        slide.background = { color: "000000" };
        const h1 = lines.find(l => l.type === "h1");
        const sub = lines.find(l => l.type !== "h1");
        if (h1) slide.addText(plain(h1.text), {
          x:0.5, y:1.6, w:9, h:1.8, fontSize:52, bold:true, color:"FFFFFF",
          fontFace:"Helvetica Neue", align:"center", valign:"middle", charSpacing:2,
        });
        if (sub) slide.addText(plain(sub.text), {
          x:0.5, y:3.5, w:9, h:0.6, fontSize:20, color:"737373",
          fontFace:"Helvetica Neue", align:"center",
        });
        slide.addShape(pptx.ShapeType.rect, { x:4, y:3.2, w:2, h:0.03, fill:{color:"333333"}, line:{color:"333333"} });

      } else if (type === "pitch") {
        slide.background = { color:"FFFFFF" };
        slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.08, h:5.625, fill:{color:"6366F1"}, line:{color:"6366F1"} });
        const h1 = lines.find(l => l.type === "h1");
        const sub = lines.find(l => l.type !== "h1");
        if (h1) slide.addText(plain(h1.text), {
          x:0.3, y:1.2, w:9.4, h:2, fontSize:54, bold:true, color:"111111",
          fontFace:"Calibri", align:"left", valign:"middle", charSpacing:-1,
        });
        if (sub) slide.addText(plain(sub.text), {
          x:0.3, y:3.3, w:7, h:0.6, fontSize:18, color:"6B7280", fontFace:"Calibri", align:"left",
        });
        slide.addShape(pptx.ShapeType.rect, { x:0.3, y:3.1, w:3, h:0.04, fill:{color:"6366F1"}, line:{color:"6366F1"} });

      } else if (type === "edu") {
        slide.background = { color:"0EA5E9" };
        slide.addShape(pptx.ShapeType.rect, { x:0, y:4.5, w:10, h:1.125, fill:{color:"0284C7"}, line:{color:"0284C7"} });
        const h1 = lines.find(l => l.type === "h1");
        const sub = lines.find(l => l.type !== "h1");
        if (h1) slide.addText(plain(h1.text), {
          x:0.5, y:1.0, w:9, h:2, fontSize:48, bold:true, color:"FFFFFF",
          fontFace:"Calibri", align:"center", valign:"middle",
        });
        if (sub) slide.addText(plain(sub.text), {
          x:0.5, y:3.1, w:9, h:0.6, fontSize:18, color:"E0F2FE", fontFace:"Calibri", align:"center",
        });

      } else {
        slide.background = { color:"1E3A5F" };
        slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:10, h:0.07, fill:{color:"2D6A9F"}, line:{color:"2D6A9F"} });
        slide.addShape(pptx.ShapeType.rect, { x:0, y:5.555, w:10, h:0.07, fill:{color:"2D6A9F"}, line:{color:"2D6A9F"} });
        const h1 = lines.find(l => l.type === "h1");
        const sub = lines.find(l => l.type !== "h1");
        if (h1) slide.addText(plain(h1.text), {
          x:0.5, y:1.4, w:9, h:1.8, fontSize:46, bold:true, color:"FFFFFF",
          fontFace:"Calibri", align:"center", valign:"middle",
        });
        if (sub) slide.addText(plain(sub.text), {
          x:0.5, y:3.3, w:9, h:0.6, fontSize:18, color:"A8C0D6", fontFace:"Calibri", align:"center",
        });
        slide.addShape(pptx.ShapeType.rect, { x:3.5, y:3.1, w:3, h:0.045, fill:{color:"2D6A9F"}, line:{color:"2D6A9F"} });
      }

    } else if (isLast) {
      // ── CLOSING ── (unchanged)
      if (type === "company") {
        slide.background = { color:"000000" };
        lines.forEach((l, i) => slide.addText(plain(l.text), {
          x:0.5, y:1.8+i*1.0, w:9, h:0.9,
          fontSize: l.type==="h1" ? 40:18, bold:l.type==="h1",
          color: l.type==="h1" ? "FFFFFF":"737373",
          fontFace:"Helvetica Neue", align:"center",
        }));
      } else {
        slide.background = { color: TH.accent };
        slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:10, h:0.07, fill:{color:TH.accent}, line:{color:TH.accent} });
        slide.addShape(pptx.ShapeType.rect, { x:0, y:5.555, w:10, h:0.07, fill:{color:TH.accent}, line:{color:TH.accent} });
        lines.forEach((l, i) => slide.addText(plain(l.text), {
          x:0.5, y:1.6+i*1.0, w:9, h:0.9,
          fontSize: l.type==="h1" ? 36:18, bold:l.type==="h1",
          color: l.type==="h1" ? "FFFFFF":"E2E8F0",
          fontFace: TH.titleFont, align:"center",
        }));
      }

    } else {
      // ── CONTENT SLIDES ──────────────────────────────────────────────────────
      const cc = {
        font: TH.font,
        accent: TH.accent,
        title: type === "company" ? "FFFFFF" : TH.titleColor,
        body: type === "company" ? "A3A3A3" : TH.text,
        neutralBg: type === "company" ? "141414" : "FAFAFA",
        neutralBorder: type === "company" ? "2A2A2A" : "E5E7EB",
      };

      if (slideType === "stat") {
        renderStatSlide(slide, pptx, lines, cc);

      } else if (slideType === "quote") {
        renderQuoteSlide(slide, pptx, lines, cc);

      } else if (slideType === "comparison") {
        renderComparisonSlide(slide, pptx, lines, cc);

      } else {
        // default bullets layout — theme-specific chrome preserved
        let y = 0.1;
        let pendingBullets = [];
        const flushBulletGrid = () => {
          if (!pendingBullets.length) return;
          const used = renderBulletGrid(slide, pptx, pendingBullets, y, cc);
          y += used;
          pendingBullets = [];
        };

        if (type === "company") {
          slide.addShape(pptx.ShapeType.rect, { x:0, y:5.3, w:10, h:0.325, fill:{color:"0A0A0A"}, line:{color:"0A0A0A"} });
          slide.addShape(pptx.ShapeType.rect, { x:0, y:5.295, w:10, h:0.04, fill:{color:"333333"}, line:{color:"333333"} });
          slide.addText(`${si}`, { x:9.0, y:5.33, w:0.8, h:0.22, fontSize:8, color:"555555", fontFace:"Helvetica Neue", align:"right" });

          lines.forEach(line => {
            if (line.type !== "bullet") flushBulletGrid();
            if (line.type === "h1") {
              slide.addText(plain(line.text), { x:0.5, y:0.15, w:9, h:0.7, fontSize:26, bold:true, color:"FFFFFF", fontFace:"Helvetica Neue", valign:"middle" });
              slide.addShape(pptx.ShapeType.rect, { x:0.5, y:0.82, w:9, h:0.025, fill:{color:"333333"}, line:{color:"333333"} });
              y = 1.0;
            } else if (line.type === "h2") {
              slide.addText(plain(line.text).toUpperCase(), { x:0.5, y, w:9, h:0.38, fontSize:12, bold:true, color:"737373", fontFace:"Helvetica Neue", charSpacing:4 });
              y += 0.44;
            } else if (line.type === "bullet") {
              pendingBullets.push(line);
            } else {
              slide.addText(plain(line.text), { x:0.5, y, w:9, h:0.4, fontSize:14, color:"737373", fontFace:"Helvetica Neue" });
              y += 0.45;
            }
          });
          flushBulletGrid();

        } else if (type === "pitch") {
          slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.08, h:5.625, fill:{color:"6366F1"}, line:{color:"6366F1"} });
          slide.addShape(pptx.ShapeType.rect, { x:0, y:5.3, w:10, h:0.325, fill:{color:"F9FAFB"}, line:{color:"F9FAFB"} });
          slide.addShape(pptx.ShapeType.rect, { x:0, y:5.295, w:10, h:0.03, fill:{color:"E5E7EB"}, line:{color:"E5E7EB"} });
          slide.addText(`${si}`, { x:9.0, y:5.32, w:0.8, h:0.22, fontSize:8, color:"9CA3AF", fontFace:"Calibri", align:"right" });

          lines.forEach(line => {
            if (line.type !== "bullet") flushBulletGrid();
            if (line.type === "h1") {
              slide.addShape(pptx.ShapeType.rect, { x:0.18, y:0, w:9.82, h:0.72, fill:{color:"F9FAFB"}, line:{color:"F9FAFB"} });
              slide.addText(plain(line.text), { x:0.22, y:0.1, w:9.5, h:0.56, fontSize:22, bold:true, color:"111111", fontFace:"Calibri", valign:"middle" });
              slide.addShape(pptx.ShapeType.rect, { x:0.18, y:0.72, w:9.82, h:0.03, fill:{color:"6366F1"}, line:{color:"6366F1"} });
              y = 0.9;
            } else if (line.type === "h2") {
              slide.addShape(pptx.ShapeType.rect, { x:0.22, y:y+0.02, w:9.5, h:0.4, fill:{color:"EEF2FF"}, line:{color:"C7D2FE", width:0.5} });
              slide.addText(plain(line.text).toUpperCase(), { x:0.3, y:y+0.03, w:9.3, h:0.36, fontSize:11, bold:true, color:"4338CA", fontFace:"Calibri", charSpacing:3 });
              y += 0.54;
            } else if (line.type === "bullet") {
              pendingBullets.push(line);
            } else if (line.type === "bold") {
              slide.addText(plain(line.text), { x:0.28, y, w:9.4, h:0.38, fontSize:14, bold:true, color:"111111", fontFace:"Calibri" });
              y += 0.44;
            } else {
              slide.addText(plain(line.text), { x:0.28, y, w:9.4, h:0.38, fontSize:13, color:"6B7280", fontFace:"Calibri" });
              y += 0.43;
            }
          });
          flushBulletGrid();

        } else if (type === "edu") {
          slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:10, h:0.75, fill:{color:"0EA5E9"}, line:{color:"0EA5E9"} });
          slide.addShape(pptx.ShapeType.rect, { x:0, y:0.75, w:10, h:0.04, fill:{color:"BAE6FD"}, line:{color:"BAE6FD"} });
          slide.addShape(pptx.ShapeType.rect, { x:0, y:5.28, w:10, h:0.345, fill:{color:"F0F9FF"}, line:{color:"F0F9FF"} });
          slide.addShape(pptx.ShapeType.rect, { x:0, y:5.275, w:10, h:0.03, fill:{color:"BAE6FD"}, line:{color:"BAE6FD"} });
          slide.addText(`${si}`, { x:9.0, y:5.31, w:0.8, h:0.22, fontSize:8, color:"7DD3FC", fontFace:"Calibri", align:"right" });

          lines.forEach(line => {
            if (line.type !== "bullet") flushBulletGrid();
            if (line.type === "h1") {
              slide.addText(plain(line.text), { x:0.2, y:0.1, w:9.4, h:0.58, fontSize:22, bold:true, color:"FFFFFF", fontFace:"Calibri", valign:"middle" });
              y = 0.95;
            } else if (line.type === "h2") {
              slide.addShape(pptx.ShapeType.rect, { x:0.2, y:y+0.02, w:9.6, h:0.42, fill:{color:"E0F2FE"}, line:{color:"BAE6FD", width:0.5} });
              slide.addShape(pptx.ShapeType.rect, { x:0.2, y:y+0.02, w:0.07, h:0.42, fill:{color:"0EA5E9"}, line:{color:"0EA5E9"} });
              slide.addText(plain(line.text), { x:0.35, y:y+0.03, w:9.3, h:0.36, fontSize:14, bold:true, color:"0369A1", fontFace:"Calibri", valign:"middle" });
              y += 0.57;
            } else if (line.type === "bullet") {
              pendingBullets.push(line);
            } else if (line.type === "bold") {
              slide.addText(plain(line.text), { x:0.3, y, w:9.3, h:0.38, fontSize:14, bold:true, color:"0369A1", fontFace:"Calibri" });
              y += 0.44;
            } else {
              slide.addText(plain(line.text), { x:0.3, y, w:9.3, h:0.38, fontSize:13, color:"64748B", fontFace:"Calibri" });
              y += 0.43;
            }
          });
          flushBulletGrid();

        } else {
          slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:10, h:0.65, fill:{color:"1E3A5F"}, line:{color:"1E3A5F"} });
          slide.addShape(pptx.ShapeType.rect, { x:0, y:0.65, w:10, h:0.04, fill:{color:"2D6A9F"}, line:{color:"2D6A9F"} });
          slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.1, h:5.625, fill:{color:"1E3A5F"}, line:{color:"1E3A5F"} });
          slide.addShape(pptx.ShapeType.rect, { x:0, y:5.28, w:10, h:0.345, fill:{color:"1E3A5F"}, line:{color:"1E3A5F"} });
          slide.addShape(pptx.ShapeType.rect, { x:0, y:5.275, w:10, h:0.04, fill:{color:"2D6A9F"}, line:{color:"2D6A9F"} });
          slide.addText(`${si}`, { x:9.0, y:5.31, w:0.8, h:0.22, fontSize:8, color:"7F8C8D", fontFace:"Calibri", align:"right" });

          lines.forEach(line => {
            if (line.type !== "bullet") flushBulletGrid();
            if (line.type === "h1") {
              slide.addText(plain(line.text), { x:0.18, y:0.1, w:9.5, h:0.5, fontSize:21, bold:true, color:"FFFFFF", fontFace:"Calibri", valign:"middle" });
              y = 0.82;
            } else if (line.type === "h2") {
              slide.addShape(pptx.ShapeType.rect, { x:0.18, y:y+0.02, w:9.65, h:0.42, fill:{color:"EBF5FB"}, line:{color:"AED6F1", width:0.5} });
              slide.addShape(pptx.ShapeType.rect, { x:0.18, y:y+0.02, w:0.07, h:0.42, fill:{color:"2D6A9F"}, line:{color:"2D6A9F"} });
              slide.addText(plain(line.text).toUpperCase(), { x:0.32, y:y+0.03, w:9.3, h:0.36, fontSize:12, bold:true, color:"1E3A5F", fontFace:"Calibri", valign:"middle", charSpacing:2 });
              y += 0.57;
            } else if (line.type === "bullet") {
              pendingBullets.push(line);
            } else if (line.type === "bold") {
              slide.addText(plain(line.text), { x:0.22, y, w:9.4, h:0.38, fontSize:14, bold:true, color:"1E3A5F", fontFace:"Calibri" });
              y += 0.44;
            } else {
              slide.addText(plain(line.text), { x:0.22, y, w:9.4, h:0.38, fontSize:13, color:"7F8C8D", fontFace:"Calibri" });
              y += 0.43;
            }
          });
          flushBulletGrid();
        }
      }
    }
  });
}

// ── PPTX route ────────────────────────────────────────────────────────────────

router.post("/generate-pptx", verifyUser, async (req, res) => {
  try {
    const { content, type = "general", filename = "presentation.pptx" } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });

    const slides = content.split(/\n---\n/).map(parseSlideBlock);

    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "LAYOUT_16x9", width: 10, height: 5.625 });
    pptx.layout = "LAYOUT_16x9";
    pptx.author = "Eloria AI";

    buildPptxSlides(pptx, slides, type);

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