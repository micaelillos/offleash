import { Command } from "commander";
import chalk from "chalk";
import { log } from "../lib/logger.js";
import {
  checkCredentials,
  isClaudeInstalled,
  runClaudeLogin,
  promptForApiKey,
} from "../lib/credentials.js";
import { getPlatformInfo } from "../lib/platform.js";

export const authCommand = new Command("auth")
  .description("Manage Claude authentication")
  .action(async () => {
    const creds = await checkCredentials();
    const platform = getPlatformInfo();

    log.info(chalk.bold("Authentication Status"));
    log.info("");
    log.info(
      `  Credentials file (${platform.claudeCredentialsFile}): ${creds.hasCredentialsFile ? chalk.green("found") : chalk.red("missing")}`,
    );
    log.info(
      `  Config directory (${platform.claudeConfigDir}): ${creds.hasConfigDir ? chalk.green("found") : chalk.red("missing")}`,
    );
    log.info(
      `  ANTHROPIC_API_KEY: ${creds.hasApiKey ? chalk.green("set") : chalk.dim("not set")}`,
    );

    if (!creds.hasCredentialsFile && !creds.hasApiKey) {
      log.info("");
      log.warn(
        "Not authenticated. Run " +
          chalk.cyan("offleash auth login") +
          " or set ANTHROPIC_API_KEY.",
      );
    }
  });

authCommand
  .command("login")
  .description("Authenticate with Claude")
  .action(async () => {
    const installed = await isClaudeInstalled();
    if (!installed) {
      log.error("Claude Code is not installed.");
      log.info(
        `Install it with: ${chalk.cyan("npm install -g @anthropic-ai/claude-code")}`,
      );
      process.exit(1);
    }

    const success = await runClaudeLogin();
    if (success) {
      log.success("Authentication successful!");
    } else {
      log.error("Authentication failed.");
      process.exit(1);
    }
  });

authCommand
  .command("token")
  .description("Set up API token for headless/CI use")
  .action(async () => {
    log.info(
      "Enter your Anthropic API key. This will be passed to the container via environment variable.",
    );
    log.info(
      chalk.dim(
        "Tip: You can also set ANTHROPIC_API_KEY in your shell profile.",
      ),
    );
    log.info("");

    const key = await promptForApiKey();
    if (key) {
      log.info("");
      log.info("To use this key, add to your shell profile:");
      log.info(
        chalk.cyan(`  export ANTHROPIC_API_KEY="${key}"`),
      );
      log.info("");
      log.info(
        "Or pass it directly: " +
          chalk.cyan(`ANTHROPIC_API_KEY="${key}" offleash`),
      );
    } else {
      log.warn("No key provided.");
    }
  });
