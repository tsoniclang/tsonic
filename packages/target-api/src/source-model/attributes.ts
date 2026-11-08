import type { Node } from "@tsonic/tsts";
import type { SourcePresence, SourceResult } from "../public/source/contracts.js";

export interface SourceAttributeMemberSelection {
  readonly selectedDeclaration: SourcePresence<Node>;
  readonly declarations: readonly Node[];
}

export type SourceAttributeBuilderFact = {
  readonly occurrence: Node;
  readonly applicationTarget: Node;
  readonly selectedMember: SourcePresence<SourceAttributeMemberSelection>;
  readonly applicationMemberKind?: "property" | "method";
  readonly applicationPlacement?: "declaration" | "constructor";
  readonly applicationParameterName?: string;
  readonly applicationTargetSpecifier?: string;
} & (
  | { readonly kind: "builder-state" }
  | { readonly kind: "application"; readonly invocation: Node }
);

export interface SourceAttributeFacts {
  attributeBuilder(occurrence: Node): SourceResult<SourcePresence<SourceAttributeBuilderFact>>;
}
