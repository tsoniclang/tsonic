import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
/**
 * The parameter declarations of a callable value. `declaration` (the default when no context is given): the callable's
 * own declared signature; a class: its single effective construct signature; a variable or property: the single call
 * signature its authored annotation declares (a function type, or a non-generic alias / interface / type literal naming
 * exactly one call signature, R2 #43), else a function or arrow initializer (authored syntax). `selected-invocation`: the signature
 * host-input selected at that call. No checked type of the declaration is read (I3, R3).
 */
export declare function sourceCallableValueParameters(ast: AstReader, declaration: Node, navigation: Pick<SourceProgramNavigation, "call" | "classConstructors" | "declaredParameters" | "sourceReferenceFor" | "mergedDeclarations">, context?: {
    readonly kind: "declaration";
} | {
    readonly kind: "selected-invocation";
    readonly call: Node;
}): readonly Node[] | undefined;
//# sourceMappingURL=callable-parameters.d.ts.map