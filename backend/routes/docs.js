import express from "express";
import { verifyUser } from "../middleware/auth.js";
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, ShadingType, PageNumber,
  Header, Footer, UnderlineType, Table, TableRow, TableCell,
  WidthType, TableLayoutType, VerticalAlign,
} from "docx";
import { buildTemplatedPptx } from "./pptx-template.js";

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

// ── PPTX route ────────────────────────────────────────────────────────────────

router.post("/generate-pptx", verifyUser, async (req, res) => {
  try {
    const { content, filename = "presentation.pptx" } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });

    const slidesData = content.split(/\n---\n/).map(parseSlideBlock);
    const outPath = await buildTemplatedPptx(slidesData, filename);

    res.download(outPath, filename);
  } catch (err) {
    console.error("generate-pptx error:", err);
    res.status(500).json({ error: "Failed to generate presentation" });
  }
});

export default router;