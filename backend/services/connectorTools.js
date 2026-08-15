import { db } from "../config/firebaseAdmin.js";
import { decryptSecret } from "../utils/crypto.js";

/**
 * Loads a user's connected built-in connectors + custom connectors from
 * Firestore, and returns:
 *   - tools: Anthropic tool-use schemas to pass into messages.stream()
 *   - execute(name, input): runs the matching tool and returns a string result
 *
 * users/{uid}/connectors/{connectorId}  -> { provider, accessTokenEnc, refreshTokenEnc, connectedAt }
 * users/{uid}/customConnectors/{id}     -> { name, description, baseUrl, authType, headerName, secretEnc }
 */
export async function loadUserConnectorTools(uid) {
  const [builtinSnap, customSnap] = await Promise.all([
    db.collection("users").doc(uid).collection("connectors").get(),
    db.collection("users").doc(uid).collection("customConnectors").get(),
  ]);

  const tools = [];
  const executors = {};

  builtinSnap.forEach((doc) => {
    const data = doc.data();
    const provider = data.provider || doc.id;
    const accessToken = data.accessTokenEnc ? decryptSecret(data.accessTokenEnc) : null;
    if (!accessToken) return;

    if (provider === "github") {
      tools.push({
        name: "github_search",
        description:
          "Search the connected GitHub account's repositories, code, issues, or pull requests.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "GitHub search query, e.g. 'repo:owner/name path:src'" },
            type: { type: "string", enum: ["repositories", "code", "issues"], description: "What to search." },
          },
          required: ["query", "type"],
        },
      });
      tools.push({
        name: "github_read_file",
        description: "Read a file's contents from a GitHub repository.",
        input_schema: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            path: { type: "string" },
            ref: { type: "string", description: "Branch or commit SHA (optional, defaults to default branch)" },
          },
          required: ["owner", "repo", "path"],
        },
      });
      executors.github_search = async (input) => githubSearch(accessToken, input);
      executors.github_read_file = async (input) => githubReadFile(accessToken, input);
    }

    if (provider === "google_gmail") {
      tools.push({
        name: "gmail_search",
        description: "Search the connected Gmail account for messages.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Gmail search syntax, e.g. 'from:boss@acme.com is:unread'" },
            maxResults: { type: "integer", description: "Max messages to return (default 10)" },
          },
          required: ["query"],
        },
      });
      tools.push({
        name: "gmail_read_message",
        description: "Read the full content of a Gmail message by id.",
        input_schema: {
          type: "object",
          properties: { messageId: { type: "string" } },
          required: ["messageId"],
        },
      });
      executors.gmail_search = async (input) => gmailSearch(accessToken, input);
      executors.gmail_read_message = async (input) => gmailReadMessage(accessToken, input);
    }

    if (provider === "google_drive") {
      tools.push({
        name: "drive_search",
        description: "Search the connected Google Drive for files by name/content.",
        input_schema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      });
      tools.push({
        name: "drive_read_file",
        description: "Read the text content of a Google Drive file (Docs, Sheets export as text/CSV).",
        input_schema: {
          type: "object",
          properties: { fileId: { type: "string" } },
          required: ["fileId"],
        },
      });
      executors.drive_search = async (input) => driveSearch(accessToken, input);
      executors.drive_read_file = async (input) => driveReadFile(accessToken, input);
    }
  });

  customSnap.forEach((doc) => {
    const c = doc.data();
    const toolName = `custom_${slugify(c.name)}_${doc.id.slice(0, 6)}`;
    const secret = c.secretEnc ? decryptSecret(c.secretEnc) : null;

    tools.push({
      name: toolName,
      description:
        (c.description || `Call the custom connector "${c.name}".`) +
        " Provide an HTTP method, a path relative to the connector's base URL, optional query params, and an optional JSON body.",
      input_schema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          path: { type: "string", description: "Path relative to the connector base URL, e.g. '/v1/items'" },
          query: { type: "object", description: "Optional query params as key/value pairs" },
          body: { type: "object", description: "Optional JSON request body" },
        },
        required: ["method", "path"],
      },
    });

    executors[toolName] = async (input) => callCustomConnector(c, secret, input);
  });

  return { tools, executors };
}

export async function executeConnectorTool(uid, name, input) {
  const { executors } = await loadUserConnectorTools(uid);
  const fn = executors[name];
  if (!fn) return `Error: tool "${name}" is not available (connector may have been disconnected).`;
  try {
    return await fn(input);
  } catch (err) {
    console.error(`Connector tool "${name}" failed:`, err);
    return `Error running ${name}: ${err.message}`;
  }
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "connector";
}

/* ── GitHub ─────────────────────────────────────────────────────── */

async function githubSearch(token, { query, type }) {
  const endpoint =
    type === "code" ? "search/code" : type === "issues" ? "search/issues" : "search/repositories";
  const res = await fetch(`https://api.github.com/${endpoint}?q=${encodeURIComponent(query)}&per_page=10`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  const data = await res.json();
  if (!res.ok) return `GitHub API error: ${data.message || res.status}`;
  return JSON.stringify(
    (data.items || []).map((i) => ({
      name: i.full_name || i.name,
      url: i.html_url,
      description: i.description || i.title,
    }))
  );
}

async function githubReadFile(token, { owner, repo, path, ref }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  const data = await res.json();
  if (!res.ok) return `GitHub API error: ${data.message || res.status}`;
  if (data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf8").slice(0, 20000);
  }
  return JSON.stringify(data).slice(0, 20000);
}

/* ── Gmail ──────────────────────────────────────────────────────── */

async function gmailSearch(token, { query, maxResults = 10 }) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) return `Gmail API error: ${data.error?.message || res.status}`;
  return JSON.stringify(data.messages || []);
}

async function gmailReadMessage(token, { messageId }) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) return `Gmail API error: ${data.error?.message || res.status}`;
  const headers = Object.fromEntries((data.payload?.headers || []).map((h) => [h.name, h.value]));
  const snippet = data.snippet || "";
  return JSON.stringify({ from: headers.From, subject: headers.Subject, date: headers.Date, snippet });
}

/* ── Google Drive ───────────────────────────────────────────────── */

async function driveSearch(token, { query }) {
  const q = encodeURIComponent(`name contains '${query.replace(/'/g, "")}'`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=10&fields=files(id,name,mimeType,webViewLink)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) return `Drive API error: ${data.error?.message || res.status}`;
  return JSON.stringify(data.files || []);
}

async function driveReadFile(token, { fileId }) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    // fallback for non-Google-native files (binary): fetch raw content
    const raw = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await raw.text();
    return text.slice(0, 20000);
  }
  const text = await res.text();
  return text.slice(0, 20000);
}

/* ── Custom connectors ──────────────────────────────────────────── */

async function callCustomConnector(config, secret, { method, path, query, body }) {
  const url = new URL(path.replace(/^\//, ""), config.baseUrl.endsWith("/") ? config.baseUrl : config.baseUrl + "/");
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers = { "Content-Type": "application/json" };
  if (config.authType === "api_key" && secret) headers[config.headerName || "x-api-key"] = secret;
  if (config.authType === "bearer" && secret) headers.Authorization = `Bearer ${secret}`;
  if (config.authType === "basic" && secret) headers.Authorization = `Basic ${Buffer.from(secret).toString("base64")}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body && method !== "GET" ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return `HTTP ${res.status}\n${text.slice(0, 20000)}`;
}