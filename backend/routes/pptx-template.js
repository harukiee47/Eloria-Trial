import { Automizer, ModifyTextHelper } from "pptx-automizer";
import path from "path";

const automizer = new Automizer({
  templateDir: path.join(process.cwd(), "templates"),
  outputDir: path.join(process.cwd(), "tmp-output"),
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
    return [
      h1,
      items[0].text.split(" — ")[0] || items[0].text,
      items[0].text.split(" — ")[1] || items[0].text,
      items[1].text.split(" — ")[0] || items[1].text,
      items[1].text.split(" — ")[1] || items[1].text,
      items[2].text.split(" — ")[0] || items[2].text,
      items[2].text.split(" — ")[1] || items[2].text,
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

  const outPath = path.join(process.cwd(), "tmp-output", outputFilename);
  await pres.write(outputFilename);
  return outPath;
}