/**
 * utils/anthropicMessages.js
 * Shared utility — imported by both routes/chat.js and routes/voice.js
 */
export function buildAnthropicMessages(messages) {
  return messages.map((msg) => {
    if (!msg.files || msg.files.length === 0) {
      return { role: msg.role, content: msg.content };
    }

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
                source: { type: "base64", media_type: "application/pdf", data: base64Data },
              });
            } else {
              contentParts.push({
                type: "text",
                text: `[Document attached: ${file.name} (${mediaType}) — binary format, cannot extract text directly. Let the user know you received it but need a plain text or PDF version to read the contents.]`,
              });
            }
          }
        } else if (file.textContent) {
          contentParts.push({
            type: "text",
            text: `[Document: ${file.name}]\n\n${file.textContent}`,
          });
        }
      }
    }

    if (msg.content && msg.content.trim()) {
      contentParts.push({ type: "text", text: msg.content });
    } else if (contentParts.length > 0) {
      contentParts.push({ type: "text", text: "Please analyze the above." });
    }

    return { role: msg.role, content: contentParts };
  });
}