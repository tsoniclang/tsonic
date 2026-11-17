export interface HostIsolationInput {
  readonly root: string;
  readonly module: string;
  readonly sourceFiles: readonly string[];
  readonly dependencyContracts: readonly string[];
  readonly outputDirectory: string;
}

export type HostIsolationResult =
  | { readonly kind: "passed"; readonly log: string }
  | { readonly kind: "failed"; readonly log: string };

export function compileHostModuleInIsolation(input: HostIsolationInput): Promise<HostIsolationResult>;
