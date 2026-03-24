export interface RunOptions {
  prompt?: string;
  file?: string;
  print?: boolean;
  continue?: boolean;
  model?: string;
  cpus?: string;
  memory?: string;
  timeout?: string;
  network?: boolean;
  readOnly?: boolean;
  mount?: string[];
  env?: string[];
  image?: string;
  workdir?: string;
  rebuild?: boolean;
  autoCommit?: boolean;
  commitMessage?: string;
  verbose?: boolean;
  debug?: boolean;
  quiet?: boolean;
}

export interface PlatformInfo {
  os: "darwin" | "linux" | "win32";
  homeDir: string;
  claudeConfigDir: string;
  claudeCredentialsFile: string;
  isInteractive: boolean;
}

export interface DockerImageInfo {
  tag: string;
  hash: string;
  exists: boolean;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface OffleashConfig {
  memory: string;
  cpus: string;
  model: string;
  network: boolean;
  timeout: string;
  extraMounts: string[];
  extraEnvs: string[];
}

export const DEFAULT_CONFIG: OffleashConfig = {
  memory: "4g",
  cpus: "",
  model: "",
  network: true,
  timeout: "",
  extraMounts: [],
  extraEnvs: [],
};
