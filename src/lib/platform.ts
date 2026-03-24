import os from "node:os";
import path from "node:path";
import type { PlatformInfo } from "../types/index.js";

export function getPlatformInfo(): PlatformInfo {
  const homeDir = os.homedir();
  const platform = os.platform();

  return {
    os: platform as PlatformInfo["os"],
    homeDir,
    claudeConfigDir: path.join(homeDir, ".claude"),
    claudeCredentialsFile: path.join(homeDir, ".claude.json"),
    isInteractive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  };
}

export function toDockerPath(hostPath: string): string {
  if (process.platform !== "win32") return hostPath;
  return hostPath
    .replace(/^([A-Z]):\\/, (_, letter: string) => `/${letter.toLowerCase()}/`)
    .replace(/\\/g, "/");
}
