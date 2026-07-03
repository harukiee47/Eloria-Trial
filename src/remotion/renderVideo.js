import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";

export async function renderWithRemotion({ segments, clipPaths, voiceoverPath, outputPath, onProgress }) {
  const fps = 30;
  const durationInFrames = Math.ceil(segments[segments.length - 1].end * fps) + fps;

  // Bundle the composition
  const bundled = await bundle(path.resolve("src/remotion/VideoComposition.jsx"));

  const composition = await selectComposition({
    serveUrl: bundled,
    id: "VideoComposition",
    inputProps: { segments, clipPaths, voiceoverSrc: voiceoverPath, fps },
  });

  await renderMedia({
    composition: { ...composition, durationInFrames, fps, width: 1920, height: 1080 },
    serveUrl: bundled,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: { segments, clipPaths, voiceoverSrc: voiceoverPath, fps },
    onProgress: ({ progress }) => onProgress && onProgress(Math.round(progress * 100)),
  });

  return outputPath;
}