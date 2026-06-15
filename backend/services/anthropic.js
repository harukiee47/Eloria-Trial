import Anthropic from "@anthropic-ai/sdk";

let _client = null;

export function getAnthropic() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// keep named export for backward compat
export const anthropic = new Proxy({}, {
  get(_, prop) {
    return getAnthropic()[prop];
  }
});