#!/usr/bin/env node
import chalk from "chalk";
import Conf from "conf";
import open from "open";
import fetch from "node-fetch";
import readline from "readline";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const API_BASE = "https://eloria-trial.onrender.com/api";
const config = new Conf({ projectName: "eloria-cli" });

async function login() {
  const res = await fetch(`${API_BASE}/cli/start-session`, { method: "POST" });
  const { sessionId, loginUrl } = await res.json();

  console.log(chalk.cyan("Opening browser to log in..."));
  console.log(chalk.gray(loginUrl));
  await open(loginUrl);

  console.log(chalk.gray("Waiting for login..."));
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const check = await fetch(`${API_BASE}/cli/check-session/${sessionId}`);
      const data = await check.json();
      if (data.status === "done") {
        clearInterval(interval);
        config.set("token", data.token);
        console.log(chalk.green("✓ Logged in!"));
        resolve(data.token);
      }
    }, 2000);
  });
}

async function checkPlan(token) {
  const res = await fetch(`${API_BASE}/membership/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.plan;
}

// ── Tool executors — run locally on the user's machine ─────────────────────
async function executeTool(name, input) {
  try {
    if (name === "read_file") {
      const content = await fs.readFile(path.resolve(input.path), "utf-8");
      return content;
    }
    if (name === "write_file") {
      await fs.mkdir(path.dirname(path.resolve(input.path)), { recursive: true });
      await fs.writeFile(path.resolve(input.path), input.content, "utf-8");
      return `File written successfully: ${input.path}`;
    }
    if (name === "list_files") {
      const entries = await fs.readdir(path.resolve(input.path), { withFileTypes: true });
      return entries.map(e => (e.isDirectory() ? `${e.name}/` : e.name)).join("\n");
    }
    if (name === "run_command") {
      const { stdout, stderr } = await execAsync(input.command, { cwd: process.cwd(), timeout: 30000 });
      return stdout || stderr || "(command produced no output)";
    }
    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function confirmToolUse(name, input) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const desc =
    name === "read_file" ? `Read file: ${input.path}`
    : name === "write_file" ? `Write file: ${input.path}`
    : name === "list_files" ? `List directory: ${input.path}`
    : name === "run_command" ? `Run command: ${input.command}`
    : `${name}(${JSON.stringify(input)})`;

  return new Promise((resolve) => {
    rl.question(chalk.yellow(`\n⚠ ${desc}\n  Allow? (y/n) `), (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "logout") {
    config.delete("token");
    console.log(chalk.green("✓ Logged out. Run 'eloria' again to log in with a different account."));
    process.exit(0);
  }

  const forceRelogin = args[0] === "login" || args.includes("--relogin");
  let token = forceRelogin ? null : config.get("token");

  if (!token) token = await login();

  let plan = await checkPlan(token);
  if (!plan) {
    token = await login();
    plan = await checkPlan(token);
  }

  if (plan !== "pro" && plan !== "admin") {
    console.log(chalk.red("✗ Eloria Code requires a Pro plan."));
    console.log(chalk.gray("  Upgrade at https://eloria-trial.vercel.app/"));
    console.log(chalk.gray("  Wrong account? Run: eloria logout"));
    process.exit(1);
  }

  console.log(chalk.green("✓ Welcome to Eloria Code (Pro)"));
  console.log(chalk.gray("Type 'exit' to quit.\n"));
  startChatLoop(token);
}

function startChatLoop(token) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history = [];

  const ask = () => {
    rl.question(chalk.cyan("\n> "), async (input) => {
      const trimmed = input.trim();
      if (trimmed === "exit") { rl.close(); return; }
      if (trimmed === "") { ask(); return; }

      history.push({ role: "user", content: trimmed });
      await runTurn(token, history);
      ask();
    });
  };
  ask();
}

// Handles one full turn, including any tool-use back-and-forth, until the model gives a final text answer
async function runTurn(token, history) {
  const res = await fetch(`${API_BASE}/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: history, useTools: true }),
  });

  let aiText = "";
  const toolUses = [];
  let stopReason = null;

  for await (const chunk of res.body) {
    const lines = chunk.toString().split("\n").filter(l => l.startsWith("data: "));
    for (const line of lines) {
      try {
        const json = JSON.parse(line.slice(6));
        if (json.text) { process.stdout.write(json.text); aiText += json.text; }
        if (json.toolUse) { toolUses.push(json.toolUse); }
        if (json.done) { stopReason = json.stopReason; }
      } catch {}
    }
  }
  console.log();

  // Build the assistant's content blocks (text + tool_use) for the history
  const assistantContent = [];
  if (aiText) assistantContent.push({ type: "text", text: aiText });
  toolUses.forEach(t => assistantContent.push({ type: "tool_use", id: t.id, name: t.name, input: t.input }));
  history.push({ role: "assistant", content: assistantContent });

  if (stopReason === "tool_use" && toolUses.length > 0) {
    const toolResults = [];
    for (const t of toolUses) {
      const allowed = await confirmToolUse(t.name, t.input);
      const result = allowed ? await executeTool(t.name, t.input) : "User denied this tool call.";
      toolResults.push({ type: "tool_result", tool_use_id: t.id, content: String(result) });
    }
    history.push({ role: "user", content: toolResults });

    // Recurse — the model needs to see tool results and respond again
    await runTurn(token, history);
  }
}

main();