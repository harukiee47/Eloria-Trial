/**
 * Built-in connector catalog. Each entry describes how to OAuth-connect
 * a provider, and which Anthropic tool(s) become available once connected.
 *
 * To activate a provider, add its client id/secret to backend/.env:
 *   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   (covers Gmail + Drive)
 *
 * A provider with no client id/secret configured will still show up in
 * "Browse connectors" but with connect disabled, so nothing crashes.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001";

export const BUILTIN_CONNECTORS = {
  github: {
    id: "github",
    name: "GitHub",
    description: "Search repos, read files, list issues & PRs.",
    icon: "github",
    authType: "oauth2",
    scopes: ["repo", "read:user"],
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    clientId: () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
    redirectUri: `${BACKEND_URL}/api/connectors/oauth/github/callback`,
    configured: () => !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  },
  google_gmail: {
    id: "google_gmail",
    name: "Gmail",
    description: "Search and read emails.",
    icon: "gmail",
    authType: "oauth2",
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${BACKEND_URL}/api/connectors/oauth/google_gmail/callback`,
    configured: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  google_drive: {
    id: "google_drive",
    name: "Google Drive",
    description: "Search files and read document contents.",
    icon: "drive",
    authType: "oauth2",
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${BACKEND_URL}/api/connectors/oauth/google_drive/callback`,
    configured: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  notion: {
    id: "notion",
    name: "Notion",
    description: "Search and read pages from your workspace.",
    icon: "notion",
    authType: "oauth2",
    scopes: [],
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    clientId: () => process.env.NOTION_CLIENT_ID,
    clientSecret: () => process.env.NOTION_CLIENT_SECRET,
    redirectUri: `${BACKEND_URL}/api/connectors/oauth/notion/callback`,
    configured: () => !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET),
  },
  slack: {
    id: "slack",
    name: "Slack",
    description: "Search messages and post to channels.",
    icon: "slack",
    authType: "oauth2",
    scopes: ["channels:read", "channels:history", "chat:write", "search:read"],
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    clientId: () => process.env.SLACK_CLIENT_ID,
    clientSecret: () => process.env.SLACK_CLIENT_SECRET,
    redirectUri: `${BACKEND_URL}/api/connectors/oauth/slack/callback`,
    configured: () => !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET),
  },
};

export function listBuiltinConnectorsMeta() {
  return Object.values(BUILTIN_CONNECTORS).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    icon: c.icon,
    configured: c.configured(),
  }));
}