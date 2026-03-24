# offleash

Run AI agents autonomously in a sandboxed Docker container — cross-platform, auto-authenticating, and configurable.

## Requirements

- [Docker](https://docker.com) installed and running
- Node.js 18+

## Install

```
npm install -g offleash
```

## Quick Start

```bash
# Launch Claude in a sandboxed container (interactive)
offleash

# Pass a prompt directly
offleash "fix the login bug and add tests"

# Non-interactive mode (great for CI/scripts)
offleash --print "analyze this codebase and list all API endpoints"

# Pipe a prompt
echo "refactor the auth module" | offleash

# Continue last Claude session
offleash --continue
```

## Features

- **Cross-platform** — Works on macOS, Linux, and Windows
- **Auto-auth** — Detects missing credentials and walks you through login
- **Smart caching** — Docker image is built once and reused (rebuilds automatically when needed)
- **Resource limits** — Control CPU, memory, and timeout for the container
- **Network isolation** — Optionally run with `--no-network` for maximum security
- **Configurable** — Persistent config for defaults, extra mounts, env vars
- **Non-interactive mode** — `--print` flag for CI/CD pipelines and scripting

## Usage

```
offleash [options] [prompt...]

Options:
  -p, --prompt <text>      Initial prompt for AI agent
  --print                  Non-interactive mode (print output and exit)
  -c, --continue           Continue last AI agent session
  --model <model>          AI agent model to use
  --cpus <n>               CPU limit for container
  --memory <size>          Memory limit (e.g., "4g")
  --timeout <duration>     Auto-kill after duration (e.g., "30m", "2h")
  --no-network             Disable network in container
  --read-only              Mount workspace as read-only
  --mount <spec>           Extra volume mount (repeatable)
  --env <KEY=VAL>          Extra environment variable (repeatable)
  --image <name>           Custom Docker image
  --workdir <path>         Override working directory
  --rebuild                Force Docker image rebuild
  -v, --verbose            Verbose output
  --debug                  Debug output
  -q, --quiet              Minimal output
  -V, --version            Output version number
  -h, --help               Display help

Commands:
  auth                     Show authentication status
  auth login               Authenticate with AI agent
  auth token               Set up API token for headless/CI use
  config list              Show all configuration values
  config set <key> <val>   Set a configuration value
  config get <key>         Get a configuration value
  config reset [key]       Reset configuration to defaults
  config path              Show configuration file path
  doctor                   Diagnose environment issues
```

## Configuration

Persist your preferred defaults so you don't have to pass flags every time:

```bash
# Set default memory limit
offleash config set memory 8g

# Set default model
offleash config set model opus

# Disable network by default
offleash config set network false

# View all config
offleash config list

# Reset everything
offleash config reset
```

Config keys: `memory`, `cpus`, `model`, `network`, `timeout`, `extraMounts`, `extraEnvs`

## Authentication

offleash supports multiple auth methods:

```bash
# Option 1: Use existing  credentials (auto-detected)
offleash

# Option 2: Interactive login
offleash auth login

# Option 3: API key (great for CI)
export ANTHROPIC_API_KEY=sk-ant-...
offleash

# Check auth status
offleash auth
```

## Environment Diagnostics

```bash
offleash doctor
```

Checks Docker, credentials, image cache, and platform info.

## How It Works

1. Builds a minimal Docker image with Claude Code pre-installed (cached for fast startup)
2. Mounts your current directory as `/workspace` inside the container
3. Securely copies your AI agent's credentials into the container
4. Launches the AI agent with full permissions
5. Runs AI agent as a non-root user inside the container

Your host machine stays safe — all file changes are restricted to your project directory.

## License

MIT
