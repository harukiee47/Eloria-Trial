/**
 * utils/anthropicMessages.js
 * Shared utility — imported by both routes/chat.js and routes/voice.js
 *
 * Converts frontend message objects (text + optional files) into
 * Anthropic's content-block format. Guarantees every message has
 * non-empty content, since Anthropic's API rejects empty content
 * with a 400 error.
 */
export function buildAnthropicMessages(messages) {
  return messages.map((msg) => {
    // ---- Path 1: no files attached (plain text message) ----
    if (!msg.files || msg.files.length === 0) {
      const hasText = msg.content && msg.content.trim();

      if (!hasText) {
        console.warn(
          "buildAnthropicMessages: empty content on no-file message",
          JSON.stringify(msg)
        );
      }

      return {
        role: msg.role,
        content: hasText ? msg.content : "(no content)",
      };
    }

    // ---- Path 2: message has files (image/document, with or without text) ----
    const contentParts = [];

    for (const file of msg.files) {
      if (file.kind === "image" && file.previewUrl) {
        const matches = file.previewUrl.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          contentParts.push({
            type: "image",
            source: {
              type: "base64",
              media_type: matches[1],
              data: matches[2],
            },
          });
        } else {
          // previewUrl exists but isn't a base64 data URL (e.g. a hosted
          // https URL). Anthropic's image block requires base64 data, so
          // this file silently fails to attach — flag it so it's visible
          // in logs instead of failing invisibly.
          console.warn(
            "buildAnthropicMessages: image file.previewUrl is not a base64 data URL, skipping image:",
            file.name || file.previewUrl?.slice(0, 60)
          );
        }
      } else if (file.kind === "document") {
        if (file.base64) {
          const matches = file.base64.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            const mediaType = matches[1];
            const base64Data = matches[2];
            if (mediaType === "application/pdf") {
              contentParts.push({
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64Data,
                },
              });
            } else {
              contentParts.push({
                type: "text",
                text: `[Document attached: ${file.name} (${mediaType}) — binary format, cannot extract text directly. Let the user know you received it but need a plain text or PDF version to read the contents.]`,
              });
            }
          } else {
            console.warn(
              "buildAnthropicMessages: document file.base64 is not a valid data URL, skipping:",
              file.name
            );
          }
        } else if (file.textContent) {
          contentParts.push({
            type: "text",
            text: `[Document: ${file.name}]\n\n${file.textContent}`,
          });
        } else {
          console.warn(
            "buildAnthropicMessages: document file has neither base64 nor textContent, skipping:",
            file.name
          );
        }
      }
    }

    // Add the user's typed text, if any.
    if (msg.content && msg.content.trim()) {
      contentParts.push({ type: "text", text: msg.content });
    } else if (contentParts.length > 0) {
      // Files attached successfully but no caption typed — give Claude an
      // implicit instruction so it still responds naturally to the
      // image/document instead of getting an empty text block.
      contentParts.push({ type: "text", text: "Please take a look at this." });
    }

    // Final safety net: if every file failed to parse AND no text was
    // typed, contentParts is still empty here. Never let that reach the API.
    if (contentParts.length === 0) {
      console.warn(
        "buildAnthropicMessages: empty content after processing files (all files failed to parse), files:",
        JSON.stringify(msg.files)
      );
      contentParts.push({
        type: "text",
        text: "(The user sent an attachment that could not be processed. Let them know you weren't able to receive the file and ask them to try re-uploading it.)",
      });
    }

    return { role: msg.role, content: contentParts };
  });
}