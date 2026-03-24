import ora, { type Ora } from "ora";

export function spinner(text: string): Ora {
  return ora({ text, stream: process.stderr });
}
