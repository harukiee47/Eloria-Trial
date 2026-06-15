import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
tools: [
  {
    type: "web_search_20250305",
    name: "web_search"
  }
]