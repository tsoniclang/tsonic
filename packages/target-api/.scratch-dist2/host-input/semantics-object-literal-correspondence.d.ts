import type { ResolvedSourceObjectLiteralElementInfo, Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./semantics-types.js";
import type { SourceStructuralMember } from "./semantics-structural-members.js";
export declare function sourceObjectLiteralDestinationMember(element: ResolvedSourceObjectLiteralElementInfo, destination: Type, semantics: Pick<SourceFileSemantics, "types">): SourceStructuralMember | undefined;
//# sourceMappingURL=semantics-object-literal-correspondence.d.ts.map