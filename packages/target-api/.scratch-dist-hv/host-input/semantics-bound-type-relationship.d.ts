import type { Node, Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./semantics-types.js";
export declare function sourceBoundTypeRelationship(authored: Type, selected: Type, { types, declarations }: SourceFileSemantics, bindingFor: (declaration: Node) => Type | undefined): "bound" | "identity" | undefined;
//# sourceMappingURL=semantics-bound-type-relationship.d.ts.map