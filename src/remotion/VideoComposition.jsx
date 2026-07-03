import { AbsoluteFill, Sequence, useVideoConfig, Video, Audio } from "remotion";
import { interpolate, useCurrentFrame } from "remotion";

// Animated caption for one segment
function Caption({ text, startFrame, endFrame }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const slideY = interpolate(frame, [startFrame, startFrame + 8], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  if (frame < startFrame || frame > endFrame) return null;

  return (
    <div style={{
      position: "absolute", bottom: 80, left: 0, right: 0,
      display: "flex", justifyContent: "center",
      opacity, transform: `translateY(${slideY}px)`,
    }}>
      <div style={{
        background: "rgba(0,0,0,0.72)", color: "#fff",
        padding: "10px 24px", borderRadius: 12,
        fontSize: 28, fontWeight: 700, fontFamily: "sans-serif",
        maxWidth: "80%", textAlign: "center", lineHeight: 1.4,
      }}>
        {text}
      </div>
    </div>
  );
}

// One clip with a fade-in transition
function ClipSequence({ clipSrc, from, durationInFrames }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ opacity }}>
        <Video src={clipSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    </Sequence>
  );
}

// Main composition — receives segments + clip paths + voiceover path
export function VideoComposition({ segments, clipPaths, voiceoverSrc, fps = 30 }) {
  const totalFrames = Math.ceil(segments[segments.length - 1]?.end * fps) + fps;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Clips */}
      {clipPaths.map((src, i) => {
        const seg = segments[i];
        if (!seg || !src) return null;
        const from = Math.floor(seg.start * fps);
        const dur = Math.ceil((seg.end - seg.start) * fps);
        return <ClipSequence key={i} clipSrc={src} from={from} durationInFrames={dur} />;
      })}

      {/* Captions */}
      {segments.map((seg, i) => (
        <Caption
          key={i}
          text={seg.text}
          startFrame={Math.floor(seg.start * fps)}
          endFrame={Math.ceil(seg.end * fps)}
        />
      ))}

      {/* Voiceover audio */}
      {voiceoverSrc && <Audio src={voiceoverSrc} />}
    </AbsoluteFill>
  );
}