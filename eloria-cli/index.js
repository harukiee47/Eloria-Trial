#!/usr/bin/env node
import chalk from "chalk";
import Conf from "conf";
import open from "open";
import fetch from "node-fetch";
import readline from "readline";

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

async function main() {
  let token = config.get("token");

  if (!token) {
    token = await login();
  }

  let plan = await checkPlan(token);

  if (!plan) {
    // token expired/invalid — re-login
    token = await login();
    plan = await checkPlan(token);
  }

  if (plan !== "pro" && plan !== "admin") {
    console.log(chalk.red("✗ Eloria Code requires a Pro plan."));
    console.log(chalk.gray("  Upgrade at https://eloria-trial.vercel.app/"));
    process.exit(1);
  }

  console.log(chalk.green("✓ Welcome to Eloria Code (Pro)"));
  startChatLoop(token);
}

function startChatLoop(token) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => {
    rl.question(chalk.cyan("\n> "), async (input) => {
      if (input.trim() === "exit") { rl.close(); return; }

      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: input }] }),
      });

      const reader = res.body;
      let text = "";
      for await (const chunk of reader) {
        const lines = chunk.toString().split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.text) { process.stdout.write(json.text); text += json.text; }
          } catch {}
        }
      }
      console.log();
      ask();
    });
  };
  ask();
}

main();