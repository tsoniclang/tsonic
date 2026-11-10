import type { Node } from "@tsonic/tsts";

export interface SourceProfileDeclarationIdentity {
  readonly owner: string;
  readonly kind: "type" | "member" | "indexer" | "call" | "construct";
  readonly declaration: Node;
  readonly declaringName: string | undefined;
  readonly name: string | undefined;
}
