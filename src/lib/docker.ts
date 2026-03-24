import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { log } from "./logger.js";
import { spinner } from "./ui.js";
import { toDockerPath } from "./platform.js";
import { generateDockerfile, getImageTag } from "../templates/Dockerfile.js";
import type { RunOptions } from "../types/index.js";

const execFileAsync = promisify(execFile);

export async function checkDockerInstalled(): Promise<boolean> {
  try {
    await execFileAsync("docker", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function checkDockerRunning(): Promise<boolean> {
  try {
    await execFileAsync("docker", ["info"], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

export async function imageExists(tag: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "images",
      "-q",
      tag,
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function buildImage(
  forceRebuild = false,
): Promise<string> {
  const dockerfile = generateDockerfile();
  const tag = getImageTag(dockerfile);

  if (!forceRebuild && (await imageExists(tag))) {
    log.debug(`Image ${tag} already exists, skipping build`);
    return tag;
  }

  const spin = spinner("Building Docker image...").start();

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "offleash-"));
  const dockerfilePath = path.join(tmpDir, "Dockerfile");
  await fs.writeFile(dockerfilePath, dockerfile);

  try {
    await execFileAsync("docker", ["build", "-t", tag, "-f", dockerfilePath, tmpDir], {
      timeout: 300000,
    });
    spin.succeed("Docker image ready");
    return tag;
  } catch (err) {
    spin.fail("Docker image build failed");
    throw err;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export interface ContainerRunOptions {
  imageTag: string;
  workdir: string;
  credentialsFile: string;
  credentialsDir: string;
  options: RunOptions;
  apiKey?: string;
  keychainCredentials?: string;
}

export function runContainer(opts: ContainerRunOptions): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = ["run", "--rm"];

    const isInteractive =
      !opts.options.print &&
      Boolean(process.stdin.isTTY && process.stdout.isTTY);

    if (isInteractive) {
      args.push("-it");
    }

    if (opts.options.memory) {
      args.push("--memory", opts.options.memory);
    }
    if (opts.options.cpus) {
      args.push("--cpus", opts.options.cpus);
    }

    if (opts.options.network === false) {
      args.push("--network", "none");
    }

    const readOnlyFlag = opts.options.readOnly ? ":ro" : "";
    args.push(
      "-v",
      `${toDockerPath(opts.workdir)}:/workspace${readOnlyFlag}`,
    );

    args.push(
      "-v",
      `${toDockerPath(opts.credentialsFile)}:/tmp/claude-creds.json:ro`,
    );
    args.push(
      "-v",
      `${toDockerPath(opts.credentialsDir)}:/tmp/claude-creds-dir:ro`,
    );

    if (opts.options.file) {
      const fileName = opts.options.file.split(/[/\\]/).pop()!;
      args.push(
        "-v",
        `${toDockerPath(opts.options.file)}:/tmp/input-files/${fileName}:ro`,
      );
    }

    if (opts.apiKey) {
      args.push("-e", `ANTHROPIC_API_KEY=${opts.apiKey}`);
    }

    for (const env of opts.options.env ?? []) {
      args.push("-e", env);
    }

    for (const mount of opts.options.mount ?? []) {
      args.push("-v", mount);
    }

    if (opts.keychainCredentials) {
      try {
        const creds = JSON.parse(opts.keychainCredentials);
        const token = creds?.claudeAiOauth?.accessToken;
        if (token) {
          args.push("-e", `CLAUDE_CODE_OAUTH_TOKEN=${token}`);
        }
      } catch {
        args.push("-e", `CLAUDE_CODE_OAUTH_TOKEN=${opts.keychainCredentials}`);
      }
    }

    args.push(opts.options.image ?? opts.imageTag);

    const claudeArgs = ["claude", "--dangerously-skip-permissions"];
    if (opts.options.model) claudeArgs.push("--model", opts.options.model);
    if (opts.options.print) claudeArgs.push("--print");
    if (opts.options.continue) claudeArgs.push("--continue");

    const prompt = opts.options.prompt;
    if (prompt) {
      claudeArgs.push(JSON.stringify(prompt));
    }

    const nodeScript = `
var fs = require("fs");
var s = "/home/claude/.claude/settings.json";
var settings = {};
try { settings = JSON.parse(fs.readFileSync(s, "utf8")); } catch(e) {}
settings.skipDangerousModePermissionPrompt = true;
fs.writeFileSync(s, JSON.stringify(settings));
var p = "/home/claude/.claude.json";
var data = {};
try { data = JSON.parse(fs.readFileSync(p, "utf8")); } catch(e) {}
if (!data.projects) data.projects = {};
if (!data.projects["/workspace"]) data.projects["/workspace"] = {};
data.projects["/workspace"].hasTrustDialogAccepted = true;
data.hasCompletedOnboarding = true;
fs.writeFileSync(p, JSON.stringify(data));
`.trim().replace(/\n/g, " ");

    const patchCmds = [
      "cp /tmp/claude-creds.json /home/claude/.claude.json 2>/dev/null || true",
      "cp /tmp/claude-creds-dir/settings.json /home/claude/.claude/settings.json 2>/dev/null || true",
      "cp /tmp/claude-creds-dir/settings.local.json /home/claude/.claude/settings.local.json 2>/dev/null || true",
      `node -e "${nodeScript.replace(/"/g, '\\"')}" 2>/dev/null || true`,
    ];
    const patchScript = patchCmds.join(" ; ");

    const containerCmd = patchScript + " ; " + claudeArgs.join(" ");

    args.push("bash", "-c", containerCmd);

    log.debug("docker args:", JSON.stringify(args, null, 2));

    const child = spawn("docker", args, {
      stdio: "inherit",
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (opts.options.timeout) {
      const ms = parseTimeout(opts.options.timeout);
      if (ms > 0) {
        timeoutId = setTimeout(() => {
          log.warn(`Timeout reached (${opts.options.timeout}), stopping container...`);
          child.kill("SIGTERM");
          setTimeout(() => child.kill("SIGKILL"), 5000);
        }, ms);
      }
    }

    child.on("error", (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });

    child.on("close", (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve(code ?? 1);
    });
  });
}

function parseTimeout(value: string): number {
  const match = value.match(/^(\d+)(s|m|h)?$/);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  const unit = match[2] ?? "m";
  switch (unit) {
    case "s":
      return num * 1000;
    case "m":
      return num * 60 * 1000;
    case "h":
      return num * 60 * 60 * 1000;
    default:
      return 0;
  }
}
