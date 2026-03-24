import crypto from "node:crypto";

export interface DockerfileOptions {
  nodeVersion?: string;
  claudeCodeVersion?: string;
}

export function generateDockerfile(options: DockerfileOptions = {}): string {
  const nodeVersion = options.nodeVersion ?? "20";
  const claudeVersion = options.claudeCodeVersion
    ? `@${options.claudeCodeVersion}`
    : "";

  return `FROM node:${nodeVersion}-slim
RUN npm install -g @anthropic-ai/claude-code${claudeVersion}
RUN useradd -m -s /bin/bash claude
RUN mkdir -p /home/claude/.claude && chown -R claude:claude /home/claude
WORKDIR /workspace
RUN chown claude:claude /workspace
USER claude
`;
}

export function getDockerfileHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
}

export function getImageTag(dockerfileContent: string): string {
  const hash = getDockerfileHash(dockerfileContent);
  return `offleash-sandbox:${hash}`;
}
