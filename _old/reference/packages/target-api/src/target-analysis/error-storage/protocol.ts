import type { Node } from "@tsonic/tsts";

export type SourceErrorRetainedDemand =
  | { readonly kind: "ordinary" | "retained" }
  | { readonly kind: "unresolved"; readonly reason: string };

export interface SourceErrorStorageProtocol {
  readonly fields: readonly Node[];
  readonly constructors: readonly Node[];
  readonly stackCaptures: readonly Node[];
  readonly storageMutators: readonly { readonly signature: Node; readonly sourceParameterIndex: number }[];
  retention(node: Node): SourceErrorRetainedDemand;
}
