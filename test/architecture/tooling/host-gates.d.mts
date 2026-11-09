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

export interface HostMigrationEntry {
  readonly file: string;
  readonly referenceBlob: string;
  readonly destinations: readonly string[];
  readonly retiringUnit: string;
}

export interface HostMigrationInput {
  readonly root: string;
  readonly files: readonly string[];
  readonly complete?: boolean;
}

export interface HostMigrationReport {
  readonly currentFiles: readonly string[];
  readonly unmigrated: readonly HostMigrationEntry[];
}

export function inspectHostMigration(input: HostMigrationInput): HostMigrationReport;
