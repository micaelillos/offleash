import { Command } from "commander";
import chalk from "chalk";
import { log } from "../lib/logger.js";
import { getConfigStore } from "../lib/config-store.js";
import { DEFAULT_CONFIG } from "../types/index.js";

export const configCommand = new Command("config")
  .description("Manage offleash configuration");

configCommand
  .command("list")
  .description("Show all configuration values")
  .action(() => {
    const config = getConfigStore();
    log.info(chalk.bold("Configuration"));
    log.info("");
    for (const [key, defaultVal] of Object.entries(DEFAULT_CONFIG)) {
      const val = config.get(key as keyof typeof DEFAULT_CONFIG);
      const isDefault =
        JSON.stringify(val) === JSON.stringify(defaultVal);
      const display =
        Array.isArray(val) && val.length === 0
          ? chalk.dim("[]")
          : typeof val === "boolean"
            ? val
              ? chalk.green("true")
              : chalk.red("false")
            : val || chalk.dim("(not set)");
      log.info(
        `  ${chalk.cyan(key)}: ${display}${isDefault ? chalk.dim(" (default)") : ""}`,
      );
    }
  });

configCommand
  .command("get <key>")
  .description("Get a configuration value")
  .action((key: string) => {
    const config = getConfigStore();
    if (!(key in DEFAULT_CONFIG)) {
      log.error(
        `Unknown config key: ${key}. Valid keys: ${Object.keys(DEFAULT_CONFIG).join(", ")}`,
      );
      process.exit(1);
    }
    const val = config.get(key as keyof typeof DEFAULT_CONFIG);
    console.log(typeof val === "object" ? JSON.stringify(val) : String(val));
  });

configCommand
  .command("set <key> <value>")
  .description("Set a configuration value")
  .action((key: string, value: string) => {
    const config = getConfigStore();
    if (!(key in DEFAULT_CONFIG)) {
      log.error(
        `Unknown config key: ${key}. Valid keys: ${Object.keys(DEFAULT_CONFIG).join(", ")}`,
      );
      process.exit(1);
    }

    const defaultVal =
      DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG];

    let parsed: unknown;
    if (typeof defaultVal === "boolean") {
      parsed = value === "true" || value === "1";
    } else if (Array.isArray(defaultVal)) {
      parsed = value.split(",").map((s) => s.trim());
    } else {
      parsed = value;
    }

    config.set(key as keyof typeof DEFAULT_CONFIG, parsed as never);
    log.success(`Set ${chalk.cyan(key)} = ${value}`);
  });

configCommand
  .command("reset [key]")
  .description("Reset configuration to defaults")
  .action((key?: string) => {
    const config = getConfigStore();
    if (key) {
      if (!(key in DEFAULT_CONFIG)) {
        log.error(
          `Unknown config key: ${key}. Valid keys: ${Object.keys(DEFAULT_CONFIG).join(", ")}`,
        );
        process.exit(1);
      }
      config.set(
        key as keyof typeof DEFAULT_CONFIG,
        DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG] as never,
      );
      log.success(`Reset ${chalk.cyan(key)} to default`);
    } else {
      config.clear();
      log.success("All configuration reset to defaults");
    }
  });

configCommand
  .command("path")
  .description("Show configuration file path")
  .action(() => {
    const config = getConfigStore();
    console.log(config.path);
  });
