export type HostGate =
  | "directory-ownership" | "contract-imports" | "layers"
  | "program-lifetime" | "ingress-checker" | "one-current-name"
  | "strict-source" | "publication-consumer" | "read-only-publication"
  | "retired-api" | "contract-closure" | "isolated-compile";

export interface HostGateFinding {
  readonly gate: HostGate;
  readonly file: string;
  readonly start: number;
  readonly message: string;
}

export interface HostGateInput {
  readonly root: string;
  readonly files: readonly string[];
  readonly declarationFiles: readonly string[];
}

export function inspectHostStructure(input: HostGateInput): readonly HostGateFinding[];
