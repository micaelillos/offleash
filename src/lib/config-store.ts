import Conf from "conf";
import type { OffleashConfig } from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/index.js";

let store: Conf<OffleashConfig> | null = null;

export function getConfigStore(): Conf<OffleashConfig> {
  if (!store) {
    store = new Conf<OffleashConfig>({
      projectName: "offleash",
      defaults: DEFAULT_CONFIG,
    });
  }
  return store;
}
