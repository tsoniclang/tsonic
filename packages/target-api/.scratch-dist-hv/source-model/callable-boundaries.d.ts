import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNodeRole } from "../public/source/roles.js";
/** Every role in `SourceNodeRole` declaration order; `sourceNodeRoles` lists a node's roles in this order. */
export declare const sourceNodeRoleOrder: readonly SourceNodeRole[];
/** The kind half of `callable-body`: a form that can own a body, with or without one. Not a role by itself. */
export declare function isSourceCallableBodyBoundary(ast: Pick<AstReader, "kindName">, node: Node): boolean;
/** Exactly the `callable-signature` role: a body-owner kind (with or without a body) or a bodyless signature kind. */
export declare function isSourceCallableSignatureDeclaration(ast: Pick<AstReader, "kindName">, node: Node): boolean;
/** Whether `node` holds `role`. Each role is its own predicate; no role is derived from another by exclusion. */
export declare function sourceNodeHasRole(ast: AstReader, node: Node, role: SourceNodeRole): boolean;
/** Every role `node` holds, additively, in `sourceNodeRoleOrder`. */
export declare function sourceNodeRoles(ast: AstReader, node: Node): readonly SourceNodeRole[];
/**
 * The nearest strict ancestor of `node` holding `role` (E13 `sourceEnclosing`; replaces the body-only
 * `sourceEnclosingCallable`). Undefined when no ancestor holds it. A cyclic parent chain is an invariant failure.
 * `hasRole` lets the role model pass its memoized classification; it must agree with `sourceNodeHasRole`.
 */
export declare function sourceEnclosing(ast: AstReader, node: Node, role: SourceNodeRole, hasRole?: (candidate: Node, role: SourceNodeRole) => boolean): Node | undefined;
//# sourceMappingURL=callable-boundaries.d.ts.map