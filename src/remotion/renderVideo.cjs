const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition } = require("@remotion/renderer");
const path = require("path");

async function renderWithRemotion({ segments, clipPaths, voiceoverPath, outputPath, onProgress }) {
  const fps = 30;
  const durationInFrames = Math.ceil(segments[segments.length - 1].end * fps) + fps;

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

module.exports = { renderWithRemotion };