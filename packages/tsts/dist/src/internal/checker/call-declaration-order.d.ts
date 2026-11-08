import type { Node } from "../ast/spine.js";
import type { Symbol } from "../ast/symbol.js";
import type { ResolvedCallSelectionEvidence, Signature } from "./types.js";
export declare function callDeclarationOrder(signatures: readonly (Signature | undefined)[], originals: ReadonlyMap<Signature, Signature>, declarationSymbol: (declaration: Node) => Symbol | undefined): ResolvedCallSelectionEvidence["declarationOrder"];
//# sourceMappingURL=call-declaration-order.d.ts.map