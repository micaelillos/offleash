import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { log } from "./logger.js";
import { spinner } from "./ui.js";

const execFileAsync = promisify(execFile);

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    return true;
  } catch {
    return false;
  }
}

export async function hasChanges(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
      cwd,
    });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function getChangeSummary(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "--stat", "HEAD"],
      { cwd },
    );
    return stdout.trim();
  } catch {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["diff", "--stat", "--cached"],
        { cwd },
      );
      return stdout.trim();
    } catch {
      return "";
    }
  }
}

export async function autoCommit(
  cwd: string,
  message?: string,
): Promise<boolean> {
  if (!(await isGitRepo(cwd))) {
    log.warn("Not a git repository, skipping auto-commit.");
    return false;
  }

  if (!(await hasChanges(cwd))) {
    log.info("No changes to commit.");
    return true;
  }

  const spin = spinner("Committing changes...").start();

  try {
    await execFileAsync("git", ["add", "-A"], { cwd });

    const commitMsg =
      message || `offleash: automated changes by Claude\n\nChanges made by Claude Code running in offleash sandbox.`;

    await execFileAsync("git", ["commit", "-m", commitMsg], { cwd });

    const { stdout: hash } = await execFileAsync(
      "git",
      ["rev-parse", "--short", "HEAD"],
      { cwd },
    );

    spin.succeed(`Committed ${hash.trim()}`);

    const summary = await getChangeSummary(cwd);
    if (summary) {
      log.debug(summary);
    }

    return true;
  } catch (err) {
    spin.fail("Auto-commit failed");
    log.error(String(err));
    return false;
  }
}
