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

// ── Safe fetch wrapper — catches network failures cleanly ────────────────────
async function safeFetch(url, options = {}, retries = 1) {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (err) {
    if (retries > 0) {
      console.log(chalk.gray("  Connection issue, retrying..."));
      await new Promise(r => setTimeout(r, 1500));
      return safeFetch(url, options, retries - 1);
    }
    throw new Error("Can't reach Eloria's servers. Check your internet connection and try again.");
  }
}

async function login() {
  try {
    const res = await safeFetch(`${API_BASE}/cli/start-session`, { method: "POST" });
    const { sessionId, loginUrl } = await res.json();

    console.log(chalk.cyan("Opening browser to log in..."));
    console.log(chalk.gray(loginUrl));
    await open(loginUrl);

    console.log(chalk.gray("Waiting for login..."));
    return await new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 150; // ~5 minutes at 2s intervals
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(interval);
          reject(new Error("Login timed out. Please run 'eloria' again."));
          return;
        }
        try {
          const check = await safeFetch(`${API_BASE}/cli/check-session/${sessionId}`);
          const data = await check.json();
          if (data.status === "done") {
            clearInterval(interval);
            config.set("token", data.token);
            console.log(chalk.green("✓ Logged in!"));
            resolve(data.token);
          }
        } catch {
          // ignore transient poll errors, keep trying until maxAttempts
        }
      }, 2000);
    });
  } catch (err) {
    console.log(chalk.red(`✗ ${err.message}`));
    process.exit(1);
  }
}

async function checkPlan(token) {
  try {
    const res = await safeFetch(`${API_BASE}/membership/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.plan;
  } catch (err) {
    console.log(chalk.red(`✗ ${err.message}`));
    process.exit(1);
  }
}

// ── Tool executors ────────────────────────────────────────────────────────
async function executeTool(name, input) {
  try {
    if (name === "read_file") {
      return await fs.readFile(path.resolve(input.path), "utf-8");
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
      try {
        const { stdout, stderr } = await execAsync(input.command, { cwd: process.cwd(), timeout: 30000 });
        return stdout || stderr || "(command produced no output)";
      } catch (cmdErr) {
        // exec throws on non-zero exit code — still return useful info instead of failing silently
        return `Command exited with an error:\n${cmdErr.stderr || cmdErr.message}`;
      }
    }
    return `Unknown tool: ${name}`;
  } catch (err) {
    if (err.code === "ENOENT") return `Error: File or directory not found: ${input.path}`;
    if (err.code === "EACCES") return `Error: Permission denied: ${input.path}`;
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
    rl.on("SIGINT", () => { rl.close(); resolve(false); });
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

  process.on("SIGINT", () => {
    console.log(chalk.gray("\n\nGoodbye!"));
    process.exit(0);
  });

  const ask = () => {
    rl.question(chalk.cyan("\n> "), async (input) => {
      const trimmed = input.trim();
      if (trimmed === "exit") { rl.close(); process.exit(0); }
      if (trimmed === "") { ask(); return; }

      history.push({ role: "user", content: trimmed });

      try {
        await runTurn(token, history);
      } catch (err) {
        if (err.message.includes("401") || err.message.includes("Unauthorized")) {
          console.log(chalk.red("\n✗ Your session expired. Please log in again."));
          config.delete("token");
          process.exit(1);
        }
        console.log(chalk.red(`\n✗ ${err.message}`));
      }
      ask();
    });
  };
  ask();
}

async function runTurn(token, history) {
  let res;
  try {
    res = await safeFetch(`${API_BASE}/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: history, useTools: true }),
    });
  } catch (err) {
    throw new Error(err.message);
  }

  if (res.status === 401) throw new Error("401 Unauthorized");
  if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
  if (!res.ok) throw new Error(`Server error (${res.status}). Try again.`);

  // ── "thinking..." indicator while waiting for first token ──
  let firstTokenReceived = false;
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let spinnerIndex = 0;
  const spinner = setInterval(() => {
    process.stdout.write(`\r${chalk.gray(spinnerFrames[spinnerIndex])} ${chalk.gray("Thinking...")}`);
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
  }, 80);

  const clearSpinner = () => {
    clearInterval(spinner);
    process.stdout.write("\r\x1b[K"); // clear the spinner line
  };

  let aiText = "";
  const toolUses = [];
  let stopReason = null;

  try {
    for await (const chunk of res.body) {
      const lines = chunk.toString().split("\n").filter(l => l.startsWith("data: "));
      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.error) throw new Error(json.error);
          if (json.text) {
            if (!firstTokenReceived) {
              clearSpinner();
              process.stdout.write(chalk.magenta("Eloria: "));
              firstTokenReceived = true;
            }
            process.stdout.write(chalk.white(json.text));
            aiText += json.text;
          }
          if (json.toolUse) { toolUses.push(json.toolUse); }
          if (json.done) { stopReason = json.stopReason; }
        } catch (parseErr) {
          // ignore malformed individual chunks
        }
      }
    }
  } catch (streamErr) {
    clearSpinner();
    throw new Error("Connection interrupted while receiving response.");
  }

  clearSpinner(); // in case stream ended with only a tool call, no text
  if (firstTokenReceived) console.log();

  const assistantContent = [];
  if (aiText) assistantContent.push({ type: "text", text: aiText });
  toolUses.forEach(t => assistantContent.push({ type: "tool_use", id: t.id, name: t.name, input: t.input }));
  if (assistantContent.length > 0) history.push({ role: "assistant", content: assistantContent });

  if (stopReason === "tool_use" && toolUses.length > 0) {
    const toolResults = [];
    for (const t of toolUses) {
      const allowed = await confirmToolUse(t.name, t.input);
      const result = allowed ? await executeTool(t.name, t.input) : "User denied this tool call.";
      if (allowed) console.log(chalk.green(`  ✓ Done`));
      toolResults.push({ type: "tool_result", tool_use_id: t.id, content: String(result) });
    }
    history.push({ role: "user", content: toolResults });
    await runTurn(token, history);
  }
}

main().catch((err) => {
  console.log(chalk.red(`\n✗ Unexpected error: ${err.message}`));
  process.exit(1);
});