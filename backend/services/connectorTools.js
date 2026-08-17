import { db } from "../config/firebaseAdmin.js";
import { decryptSecret } from "../utils/crypto.js";
import crypto from "crypto";

/**
 * In-memory store for GitHub actions the AI has proposed but that are
 * waiting on the user to approve/reject in the UI. Keyed by a short id.
 * `type` is one of: "write_file" | "create_repo" | "delete_repo".
 * For multi-instance deployments, move this to Firestore/Redis like the
 * OAuth `pendingStates` map in routes/connectors.js.
 */
export const pendingGithubWrites = new Map(); // id -> { uid, type, ...actionFields, createdAt }

function makePendingId() {
  return crypto.randomBytes(9).toString("base64url");
}

/**
 * Loads a user's connected built-in connectors + custom connectors from
 * Firestore, and returns:
 *   - tools: Anthropic tool-use schemas to pass into messages.stream()
 *   - execute(name, input): runs the matching tool and returns a string result
 *
 * users/{uid}/connectors/{connectorId}  -> { provider, accessTokenEnc, refreshTokenEnc, connectedAt }
 * users/{uid}/customConnectors/{id}     -> { name, description, baseUrl, authType, headerName, secretEnc }
 */
export async function loadUserConnectorTools(uid, githubTurnCap = 8) {
  const [builtinSnap, customSnap] = await Promise.all([
    db.collection("users").doc(uid).collection("connectors").get(),
    db.collection("users").doc(uid).collection("customConnectors").get(),
  ]);

  const tools = [];
  const executors = {};

  // Caps how many github_read_file / github_write_file / github_create_repo /
  // github_delete_repo calls can happen within a SINGLE incoming message.
  // This is what actually stops token drain — quota on approved commits
  // (see routes/connectors.js) only limits real GitHub writes, but every
  // read/propose call still costs an Anthropic API round trip regardless
  // of whether the user ever clicks Approve.
  const GITHUB_TOOL_CALLS_PER_TURN = githubTurnCap;
  let githubToolCallsThisTurn = 0;
  function withGithubTurnCap(fn) {
    return async (input) => {
      githubToolCallsThisTurn++;
      if (githubToolCallsThisTurn > GITHUB_TOOL_CALLS_PER_TURN) {
        return JSON.stringify({
          error: `Reached the limit of ${GITHUB_TOOL_CALLS_PER_TURN} GitHub operations for this message. Ask the user to send a new message to continue.`,
        });
      }
      return fn(input);
    };
  }

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
      tools.push({
        name: "github_write_file",
        description:
          "Propose creating or updating a file in a GitHub repository. This does NOT commit immediately — " +
          "it queues the change for the user to review and approve in the UI first. Always tell the user " +
          "you've proposed the change and that they need to confirm it.",
        input_schema: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            path: { type: "string", description: "File path within the repo, e.g. src/components/Foo.jsx" },
            content: { type: "string", description: "The full new file content." },
            branch: { type: "string", description: "Branch to commit to (optional, defaults to the repo's default branch)." },
            commitMessage: { type: "string", description: "Commit message to use once approved." },
          },
          required: ["owner", "repo", "path", "content", "commitMessage"],
        },
      });
      tools.push({
        name: "github_create_repo",
        description:
          "Propose creating a new GitHub repository. This does NOT create it immediately — it queues the " +
          "action for the user to review and approve in the UI first. Always tell the user you've proposed " +
          "it and that they need to confirm.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Repository name." },
            description: { type: "string", description: "Short repo description (optional)." },
            private: { type: "boolean", description: "Whether the repo should be private. Defaults to false." },
            autoInit: { type: "boolean", description: "Initialize with a README. Defaults to true." },
          },
          required: ["name"],
        },
      });
      tools.push({
        name: "github_delete_repo",
        description:
          "Propose deleting a GitHub repository. Irreversible — this does NOT delete immediately, it queues " +
          "the action for the user to explicitly approve in the UI first. Always tell the user you've " +
          "proposed it and that they need to confirm, and make clear this cannot be undone.",
        input_schema: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
          },
          required: ["owner", "repo"],
        },
      });
      executors.github_search = async (input) => githubSearch(accessToken, input);
      executors.github_read_file = withGithubTurnCap((input) => githubReadFile(accessToken, input));
      executors.github_write_file = withGithubTurnCap((input) => githubProposeWrite(uid, accessToken, input));
      executors.github_create_repo = withGithubTurnCap((input) => githubProposeCreateRepo(uid, input));
      executors.github_delete_repo = withGithubTurnCap((input) => githubProposeDeleteRepo(uid, input));
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

// Minimal line-based diff (LCS). Fine for typical source files; not meant
// to replace a real diff library for huge files.
function diffLines(oldStr, newStr) {
  const a = (oldStr || "").split("\n");
  const b = (newStr || "").split("\n");
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hunks = [];
  let i = 0, j = 0, added = 0, removed = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { hunks.push({ type: "ctx", line: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { hunks.push({ type: "del", line: a[i] }); i++; removed++; }
    else { hunks.push({ type: "add", line: b[j] }); j++; added++; }
  }
  while (i < n) { hunks.push({ type: "del", line: a[i] }); i++; removed++; }
  while (j < m) { hunks.push({ type: "add", line: b[j] }); j++; added++; }
  return { hunks, added, removed };
}

async function githubProposeWrite(uid, token, { owner, repo, path, content, branch, commitMessage }) {
  // Pull the current file (if it exists) so we can show a real diff before the user approves.
  let oldContent = "";
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}${branch ? `?ref=${branch}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
    if (res.ok) {
      const data = await res.json();
      if (data.encoding === "base64") oldContent = Buffer.from(data.content, "base64").toString("utf8");
    }
  } catch {
    /* file probably doesn't exist yet — treat as a new file, oldContent stays "" */
  }

  const { hunks, added, removed } = diffLines(oldContent, content);
  // Cap what we ship to the frontend so a huge file doesn't blow up the SSE payload.
  const diffPreview = hunks.slice(0, 400);

  const id = makePendingId();
  pendingGithubWrites.set(id, {
    uid,
    type: "write_file",
    owner,
    repo,
    path,
    branch: branch || null,
    content,
    commitMessage: commitMessage || `Update ${path} via Eloria AI`,
    createdAt: Date.now(),
  });
  setTimeout(() => pendingGithubWrites.delete(id), 30 * 60 * 1000).unref?.();

  return JSON.stringify({
    status: "pending_confirmation",
    action: "write_file",
    pendingId: id,
    owner,
    repo,
    path,
    branch: branch || "(default branch)",
    isNewFile: !oldContent,
    linesAdded: added,
    linesRemoved: removed,
    diff: diffPreview,
    note: "Queued — waiting for the user to approve or reject this change in the UI. Do not tell the user it's been committed yet.",
  });
}

async function githubProposeCreateRepo(uid, { name, description, private: isPrivate, autoInit }) {
  const id = makePendingId();
  pendingGithubWrites.set(id, {
    uid,
    type: "create_repo",
    name,
    description: description || "",
    private: !!isPrivate,
    autoInit: autoInit !== false,
    createdAt: Date.now(),
  });
  setTimeout(() => pendingGithubWrites.delete(id), 30 * 60 * 1000).unref?.();

  return JSON.stringify({
    status: "pending_confirmation",
    action: "create_repo",
    pendingId: id,
    name,
    description: description || "",
    private: !!isPrivate,
    note: "Queued — waiting for the user to approve or reject this in the UI. Do not tell the user it's been created yet.",
  });
}

async function githubProposeDeleteRepo(uid, { owner, repo }) {
  const id = makePendingId();
  pendingGithubWrites.set(id, {
    uid,
    type: "delete_repo",
    owner,
    repo,
    createdAt: Date.now(),
  });
  setTimeout(() => pendingGithubWrites.delete(id), 30 * 60 * 1000).unref?.();

  return JSON.stringify({
    status: "pending_confirmation",
    action: "delete_repo",
    pendingId: id,
    owner,
    repo,
    note: "Queued — waiting for the user to approve or reject this in the UI. This is irreversible once approved. Do not tell the user it's been deleted yet.",
  });
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