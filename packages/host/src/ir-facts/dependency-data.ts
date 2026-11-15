import type { NodeRef } from "../ids/contract.js";
import type { Execution } from "../ir-types/contract.js";
import type { SummaryKey } from "./relations-data.js";

export interface ExecutionDependency {
  readonly dependent: Execution;
  readonly at: NodeRef;
  readonly reason: "call" | "getter" | "setter" | "constructor" | "initializer" | "activation" | "dispatch" | "protocol";
  readonly target: SummaryKey;
}

export interface RequiredOperations {
  readonly operations: readonly SummaryKey[];
  readonly dependencies: readonly ExecutionDependency[];
}

export type DependencyComponent =
  | { readonly kind: "declared"; readonly operation: number }
  | { readonly kind: "body"; readonly members: readonly number[]; readonly rows: readonly number[]; readonly dependencies: readonly number[] };

export interface DependencyInventory extends RequiredOperations {
  readonly components: readonly DependencyComponent[];
}
