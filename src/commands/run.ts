import path from "node:path";
import fs from "node:fs/promises";
import chalk from "chalk";
import { log } from "../lib/logger.js";
import {
  checkDockerInstalled,
  checkDockerRunning,
  buildImage,
  runContainer,
} from "../lib/docker.js";
import {
  checkCredentials,
  isClaudeInstalled,
  runClaudeLogin,
  promptForApiKey,
} from "../lib/credentials.js";
import { getPlatformInfo } from "../lib/platform.js";
import { getConfigStore } from "../lib/config-store.js";
import { autoCommit } from "../lib/git.js";
import type { RunOptions } from "../types/index.js";

export async function runCommand(
  promptArgs: string[],
  options: RunOptions,
): Promise<void> {
  const config = getConfigStore();
  const opts: RunOptions = {
    memory: config.get("memory") || undefined,
    cpus: config.get("cpus") || undefined,
    model: config.get("model") || undefined,
    network: config.get("network"),
    timeout: config.get("timeout") || undefined,
    ...stripUndefined(options),
  };

  const prompt =
    opts.prompt ?? (promptArgs.length > 0 ? promptArgs.join(" ") : undefined);

  if (!prompt && !process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const stdinPrompt = Buffer.concat(chunks).toString().trim();
    if (stdinPrompt) {
      opts.prompt = stdinPrompt;
    }
  } else {
    opts.prompt = prompt;
  }

  if (opts.file) {
    const filePath = path.resolve(opts.file);
    try {
      await fs.access(filePath);
    } catch {
      log.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    opts.file = filePath;
    const fileName = path.basename(filePath);
    const filePrompt = `Read and analyze the file at /tmp/input-files/${fileName}`;
    opts.prompt = opts.prompt
      ? `${filePrompt}\n\n${opts.prompt}`
      : filePrompt;
  }

  if (!(await checkDockerInstalled())) {
    log.error("Docker is not installed.");
    log.info(`Install it from ${chalk.cyan("https://docker.com")}`);
    process.exit(1);
  }

  if (!(await checkDockerRunning())) {
    log.error("Docker is not running. Please start Docker and try again.");
    process.exit(1);
  }

  const creds = await checkCredentials();
  let apiKey = creds.apiKey;

  if (!creds.hasCredentialsFile || !creds.hasConfigDir) {
    if (creds.hasApiKey) {
      log.info("Using ANTHROPIC_API_KEY from environment.");
    } else {
      log.warn("Claude credentials not found.");

      const claudeInstalled = await isClaudeInstalled();
      if (claudeInstalled) {
        log.info("Attempting to authenticate with Claude...");
        const success = await runClaudeLogin();
        if (!success) {
          log.info(
            `Alternatively, set ${chalk.cyan("ANTHROPIC_API_KEY")} environment variable.`,
          );
          const key = await promptForApiKey();
          if (key) {
            apiKey = key;
          } else {
            log.error("No credentials available. Cannot continue.");
            process.exit(1);
          }
        }
      } else {
        log.info(
          `Claude Code is not installed locally. You can set ${chalk.cyan("ANTHROPIC_API_KEY")} instead.`,
        );
        const key = await promptForApiKey();
        if (key) {
          apiKey = key;
        } else {
          log.error("No credentials available. Cannot continue.");
          process.exit(1);
        }
      }
    }
  }

  const finalCreds = await checkCredentials();
  const imageTag = await buildImage(opts.rebuild);
  const platform = getPlatformInfo();
  const workdir = opts.workdir ? path.resolve(opts.workdir) : process.cwd();

  log.info(
    chalk.bold("offleash"),
    chalk.dim("— Claude is off the leash"),
  );
  log.debug(`Workspace: ${workdir}`);
  log.debug(`Image: ${imageTag}`);

  const exitCode = await runContainer({
    imageTag,
    workdir,
    credentialsFile: platform.claudeCredentialsFile,
    credentialsDir: platform.claudeConfigDir,
    options: opts,
    apiKey: apiKey || finalCreds.apiKey,
    keychainCredentials: finalCreds.keychainCredentials,
  });

  const shouldCommit = opts.autoCommit || opts.commitMessage;
  if (shouldCommit && exitCode === 0) {
    await autoCommit(workdir, opts.commitMessage);
  } else if (shouldCommit && exitCode !== 0) {
    log.warn("Claude exited with an error, skipping auto-commit.");
  }

  process.exit(exitCode);
}

function stripUndefined(obj: RunOptions): Partial<RunOptions> {
  const result: Partial<RunOptions> = {};
  for (const key of Object.keys(obj) as (keyof RunOptions)[]) {
    if (obj[key] !== undefined) {
      (result as any)[key] = obj[key];
    }
  }
  return result;
}
