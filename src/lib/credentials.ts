import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getPlatformInfo } from "./platform.js";
import { log } from "./logger.js";

const execFileAsync = promisify(execFile);

export interface CredentialStatus {
  hasCredentialsFile: boolean;
  hasConfigDir: boolean;
  hasApiKey: boolean;
  apiKey?: string;
  keychainCredentials?: string;
}

export async function checkCredentials(): Promise<CredentialStatus> {
  const platform = getPlatformInfo();

  const [hasCredentialsFile, hasConfigDir] = await Promise.all([
    fs
      .access(platform.claudeCredentialsFile)
      .then(() => true)
      .catch(() => false),
    fs
      .access(platform.claudeConfigDir)
      .then(() => true)
      .catch(() => false),
  ]);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const keychainCredentials = await getKeychainCredentials();

  return {
    hasCredentialsFile,
    hasConfigDir,
    hasApiKey: Boolean(apiKey),
    apiKey: apiKey || undefined,
    keychainCredentials: keychainCredentials || undefined,
  };
}

export async function getKeychainCredentials(): Promise<string | null> {
  const platform = getPlatformInfo();
  try {
    if (platform.os === "darwin") {
      const { stdout } = await execFileAsync("security", [
        "find-generic-password",
        "-s",
        "Claude Code-credentials",
        "-w",
      ]);
      return stdout.trim() || null;
    } else if (platform.os === "linux") {
      const { stdout } = await execFileAsync("secret-tool", [
        "lookup",
        "service",
        "Claude Code-credentials",
      ]);
      return stdout.trim() || null;
    } else if (platform.os === "win32") {
      const { stdout } = await execFileAsync("powershell", [
        "-Command",
        `(Get-StoredCredential -Target 'Claude Code-credentials').Password | ConvertFrom-SecureString -AsPlainText`,
      ]);
      return stdout.trim() || null;
    }
  } catch {
    log.debug("Could not retrieve credentials from OS keychain");
  }
  return null;
}

export async function isClaudeInstalled(): Promise<boolean> {
  try {
    await execFileAsync("claude", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function runClaudeLogin(): Promise<boolean> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    log.info("Launching Claude authentication...");
    const child = spawn("claude", ["auth", "login"], {
      stdio: "inherit",
    });
    child.on("error", () => {
      log.error("Failed to run claude auth login");
      resolve(false);
    });
    child.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

export async function promptForApiKey(): Promise<string | null> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve) => {
    rl.question("Enter your ANTHROPIC_API_KEY: ", (answer) => {
      rl.close();
      const key = answer.trim();
      resolve(key || null);
    });
  });
}
