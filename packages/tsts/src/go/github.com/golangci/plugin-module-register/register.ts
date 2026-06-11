import type { int } from "@tsonic/core/types.js";

export const LinterPlugin: int = 1 as int;
export const LoadModeTypesInfo: int = 1 << 0 as int;

export interface PluginRegistration {
  Kind: int;
  Name: string;
  Analyzer: unknown;
  LoadMode: int;
}

export function Plugin(kind: int, name: string, analyzer: unknown, loadMode: int): PluginRegistration {
  return { Kind: kind, Name: name, Analyzer: analyzer, LoadMode: loadMode };
}
