import { Automizer, ModifyTextHelper } from "pptx-automizer";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";

const automizer = new Automizer({
  templateDir: path.join(process.cwd(), "templates"),
  outputDir: path.join(process.cwd(), "tmp-output"),
  removeExistingSlides: true,
});

// ── Shape maps per slide type ─────────────────────────────────────────────────
const SLIDE_MAP = {
  cover:      { file: "marketing-plan.pptx", num: 1,  shapes: ["Google Shape;378;p40", "Google Shape;379;p40"] },
  closing:    { file: "marketing-plan.pptx", num: 4,  shapes: ["Google Shape;420;p43", "Google Shape;419;p43"] },
  comparison: { file: "marketing-plan.pptx", num: 9,  shapes: ["Google Shape;472;p48", "Google Shape;473;p48", "Google Shape;471;p48", "Google Shape;474;p48", "Google Shape;475;p48"] },
  bullets:    { file: "marketing-plan.pptx", num: 10, shapes: ["Google Shape;483;p49", "Google Shape;480;p49", "Google Shape;484;p49", "Google Shape;481;p49", "Google Shape;485;p49", "Google Shape;482;p49", "Google Shape;486;p49"] },
  stat:       { file: "marketing-plan.pptx", num: 11, shapes: ["Google Shape;494;p50", "Google Shape;491;p50", "Google Shape;492;p50", "Google Shape;495;p50", "Google Shape;496;p50", "Google Shape;498;p50", "Google Shape;493;p50", "Google Shape;499;p50", "Google Shape;497;p50"] },
  quote:      { file: "engineering-proposal.pptx", num: 9, shapes: ["Google Shape;256;p44", "Google Shape;257;p44"] },
};

function capLength(text, maxChars) {
  if (!text) return text;
  return text.length > maxChars ? text.slice(0, maxChars - 1).trim() + "…" : text;
}

function splitLabelBody(text) {
  if (!text) return { label: "", body: "" };
  const parts = text.split(" — ");
  if (parts.length >= 2) {
    return { label: parts[0].trim(), body: parts.slice(1).join(" — ").trim() };
  }
  return { label: "", body: text.trim() };
}

function cleanupOrphanedSlides(pptxPath) {
  const zip = new AdmZip(pptxPath);

  // 1. Find which slide files are actually referenced in presentation.xml
  const presentationXml = zip.getEntry("ppt/presentation.xml").getData().toString("utf8");
  const relsXml = zip.getEntry("ppt/_rels/presentation.xml.rels").getData().toString("utf8");

  const usedRids = [...presentationXml.matchAll(/<p:sldId[^>]*r:id="([\w-]+)"/g)].map(m => m[1]);

  const relEntries = [...relsXml.matchAll(/Id="([\w-]+)"[^>]*Target="slides\/(slide\d+\.xml)"/g)];
  const usedSlideFiles = new Set(
    relEntries.filter(([, rid]) => usedRids.includes(rid)).map(([, , file]) => file)
  );

  // 2. Find all slide files that exist in the zip
  const allSlideEntries = zip.getEntries().filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName));

  // 3. Delete any slide file (and its .rels) that isn't in usedSlideFiles
  allSlideEntries.forEach(entry => {
    const filename = entry.entryName.split("/").pop();
    if (!usedSlideFiles.has(filename)) {
      zip.deleteFile(entry.entryName);
      const relsEntry = `ppt/slides/_rels/${filename}.rels`;
      if (zip.getEntry(relsEntry)) zip.deleteFile(relsEntry);
    }
  });

  // 4. Also strip references to deleted slides from [Content_Types].xml, to avoid a corrupt-file warning
  const ctEntry = zip.getEntry("[Content_Types].xml");
  let ct = ctEntry.getData().toString("utf8");
  allSlideEntries.forEach(entry => {
    const filename = entry.entryName.split("/").pop();
    if (!usedSlideFiles.has(filename)) {
      const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      ct = ct.replace(new RegExp(`<Override[^>]*PartName="/ppt/slides/${escaped}"[^>]*/>`, "g"), "");
    }
  });
  zip.updateFile("[Content_Types].xml", Buffer.from(ct, "utf8"));

  zip.writeZip(pptxPath);
}

// ── Build content values in the SAME ORDER as each map's shapes array ────────
function getReplacementValues(slideType, lines) {
  const h1 = lines.find(l => l.type === "h1")?.text || "";
  const bullets = lines.filter(l => l.type === "bullet" || l.type === "text");

  if (slideType === "cover") {
    const sub = lines.find(l => l.type !== "h1")?.text || "";
    return [h1, sub];
  }
  if (slideType === "closing") {
    const body = bullets[0]?.text || "";
    return [h1 || "Thank You", body];
  }
  if (slideType === "comparison") {
    const headers = lines.filter(l => l.type === "h2");
    const leftLabel = headers[0]?.text || "Option A";
    const rightLabel = headers[1]?.text || "Option B";
    const leftBody = bullets[0]?.text || "";
    const rightBody = bullets[1]?.text || "";
    return [h1, leftLabel, leftBody, rightLabel, rightBody];
  }
if (slideType === "bullets") {
    const items = bullets.slice(0, 3);
    while (items.length < 3) items.push({ text: "" });

    const s0 = splitLabelBody(items[0].text);
    const s1 = splitLabelBody(items[1].text);
    const s2 = splitLabelBody(items[2].text);

    return [
      h1,
      s0.label,
      s0.body,
      s1.label,
      s1.body,
      s2.label,
      s2.body,
    ];
  }
  if (slideType === "stat") {
    const items = bullets.slice(0, 4);
    while (items.length < 4) items.push({ text: ": " });
    const parsed = items.map(l => {
      const m = l.text.match(/^(.+?):\s*(.+)$/);
      return m ? { label: m[1].trim(), value: m[2].trim() } : { label: l.text, value: "" };
    });
    return [h1, parsed[0].label, parsed[0].value, parsed[1].label, parsed[1].value, parsed[3].label, parsed[2].value, parsed[3].value, parsed[1].value];
    // NOTE: order intentionally matches the shape id sequence above (491,492,495,496,498,493,499,497)
  }
  if (slideType === "quote") {
    const attribution = lines.find(l => l.text?.startsWith("—"))?.text?.replace(/^—\s*/, "") || "QUOTE";
    const quoteBody = lines.find(l => l.type === "text" || l.type === "h1")?.text || "";
    return [attribution.toUpperCase(), quoteBody];
  }
  return [];
}

// ── Main builder — clones template slides and swaps text ─────────────────────
export async function buildTemplatedPptx(slidesData, outputFilename) {
  const templateDir = path.join(process.cwd(), "templates");
  const mpPath = path.join(templateDir, "marketing-plan.pptx");
  const epPath = path.join(templateDir, "engineering-proposal.pptx");

  console.log("DEBUG templateDir:", templateDir);
  console.log("DEBUG marketing-plan.pptx exists:", fs.existsSync(mpPath), "size:", fs.existsSync(mpPath) ? fs.statSync(mpPath).size : "N/A");
  console.log("DEBUG engineering-proposal.pptx exists:", fs.existsSync(epPath), "size:", fs.existsSync(epPath) ? fs.statSync(epPath).size : "N/A");

  let pres = automizer
    .loadRoot("marketing-plan.pptx")
    .load("marketing-plan.pptx", "marketing")
    .load("engineering-proposal.pptx", "engineering");

  slidesData.forEach((slideData) => {
    const slideType = SLIDE_MAP[slideData.slideType] ? slideData.slideType : "bullets";
    const map = SLIDE_MAP[slideType];
    const sourceLabel = map.file === "marketing-plan.pptx" ? "marketing" : "engineering";
    const values = getReplacementValues(slideType, slideData.lines);

    pres = pres.addSlide(sourceLabel, map.num, (slide) => {
      map.shapes.forEach((shapeName, i) => {
        if (values[i] !== undefined) {
          slide.modifyElement(shapeName, ModifyTextHelper.setText(values[i]));
        }
      });
    });
  });

const outDir = path.join(process.cwd(), "tmp-output");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, outputFilename);
await pres.write(outputFilename);
cleanupOrphanedSlides(outPath);
return outPath;
}