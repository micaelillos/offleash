import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { log } from "../lib/logger.js";
import { checkDockerInstalled, checkDockerRunning, imageExists } from "../lib/docker.js";
import { checkCredentials, isClaudeInstalled } from "../lib/credentials.js";
import { getPlatformInfo } from "../lib/platform.js";
import { generateDockerfile, getImageTag } from "../templates/Dockerfile.js";

const execFileAsync = promisify(execFile);

interface Check {
  name: string;
  run: () => Promise<{ ok: boolean; detail: string }>;
}

const checks: Check[] = [
  {
    name: "Docker installed",
    run: async () => {
      const ok = await checkDockerInstalled();
      if (!ok) return { ok: false, detail: "Install from https://docker.com" };
      try {
        const { stdout } = await execFileAsync("docker", ["--version"]);
        return { ok: true, detail: stdout.trim() };
      } catch {
        return { ok: true, detail: "installed" };
      }
    },
  },
  {
    name: "Docker running",
    run: async () => {
      const ok = await checkDockerRunning();
      return {
        ok,
        detail: ok ? "Docker daemon is responsive" : "Start Docker Desktop or dockerd",
      };
    },
  },
  {
    name: "Claude credentials",
    run: async () => {
      const creds = await checkCredentials();
      if (creds.hasCredentialsFile && creds.hasConfigDir) {
        return { ok: true, detail: "Credentials file and config directory found" };
      }
      if (creds.hasApiKey) {
        return { ok: true, detail: "Using ANTHROPIC_API_KEY" };
      }
      return {
        ok: false,
        detail: "Run 'offleash auth login' or set ANTHROPIC_API_KEY",
      };
    },
  },
  {
    name: "Claude CLI installed (host)",
    run: async () => {
      const ok = await isClaudeInstalled();
      return {
        ok,
        detail: ok
          ? "Claude Code found on host"
          : "Optional: npm install -g @anthropic-ai/claude-code",
      };
    },
  },
  {
    name: "Docker image cached",
    run: async () => {
      const dockerfile = generateDockerfile();
      const tag = getImageTag(dockerfile);
      const exists = await imageExists(tag);
      return {
        ok: exists,
        detail: exists
          ? `Image ${tag} is cached`
          : "Image will be built on first run",
      };
    },
  },
  {
    name: "Platform",
    run: async () => {
      const info = getPlatformInfo();
      return {
        ok: true,
        detail: `${info.os} | Home: ${info.homeDir} | TTY: ${info.isInteractive}`,
      };
    },
  },
];

export async function doctorCommand(): Promise<void> {
  log.info(chalk.bold("offleash doctor"));
  log.info("");

  let allOk = true;

  for (const check of checks) {
    const { ok, detail } = await check.run();
    if (!ok) allOk = false;

    const icon = ok ? chalk.green("✔") : chalk.red("✖");
    const detailText = ok ? chalk.dim(detail) : chalk.yellow(detail);
    log.info(`  ${icon} ${check.name}: ${detailText}`);
  }

  log.info("");
  if (allOk) {
    log.success("All checks passed. You're good to go!");
  } else {
    log.warn("Some checks failed. Fix the issues above before running offleash.");
  }
}
