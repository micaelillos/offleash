import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { authCommand } from "./commands/auth.js";
import { configCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import { setLogLevel } from "./lib/logger.js";
import type { LogLevel } from "./types/index.js";

const VERSION = "1.0.0";

const program = new Command()
  .name("offleash")
  .description(
    "Run AI agents autonomously in a sandboxed Docker container",
  )
  .version(VERSION)
  .argument("[prompt...]", "Initial prompt for the agent")
  .option("-p, --prompt <text>", "Initial prompt for the agent")
  .option("-f, --file <path>", "File for the agent to read as initial context (PDF, txt, etc.)")
  .option("--print", "Non-interactive mode (print output and exit)")
  .option("-c, --continue", "Continue last session")
  .option("--model <model>", "Model to use")
  .option("--cpus <n>", "CPU limit for container")
  .option("--memory <size>", "Memory limit for container (e.g., 4g)")
  .option("--timeout <duration>", "Auto-kill after duration (e.g., 30m, 2h)")
  .option("--no-network", "Disable network in container")
  .option("--read-only", "Mount workspace as read-only")
  .option("--mount <spec>", "Extra volume mount (repeatable)", collect, [])
  .option("--env <KEY=VAL>", "Extra environment variable (repeatable)", collect, [])
  .option("--image <name>", "Custom Docker image")
  .option("--workdir <path>", "Override working directory")
  .option("--rebuild", "Force Docker image rebuild")
  .option("--auto-commit", "Auto-commit changes to git after the agent finishes")
  .option("--commit-message <msg>", "Custom commit message (implies --auto-commit)")
  .option("-v, --verbose", "Verbose output")
  .option("--debug", "Debug output")
  .option("-q, --quiet", "Minimal output")
  .action(async (promptArgs: string[], options) => {
    configureLogging(options);
    await runCommand(promptArgs, options);
  });

program.addCommand(authCommand);
program.addCommand(configCommand);

program
  .command("doctor")
  .description("Diagnose environment issues")
  .action(async () => {
    await doctorCommand();
  });

program.parse();

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

function configureLogging(options: {
  debug?: boolean;
  verbose?: boolean;
  quiet?: boolean;
}): void {
  let level: LogLevel = "info";
  if (options.debug) level = "debug";
  else if (options.verbose) level = "debug";
  else if (options.quiet) level = "error";
  setLogLevel(level);
}
