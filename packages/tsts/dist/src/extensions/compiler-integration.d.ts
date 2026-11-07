import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { SourcePrimitiveFact } from "./facts.js";
import type { ExtensionHost } from "./host.js";
export declare function recordBoundSourceFileExtensionFacts(program: object, file: GoPtr<SourceFile>): void;
export declare function finalizeExtensionSemantics(program: object): ExtensionHost | undefined;
export declare function configuredSourcePrimitiveOperand(program: object, operand: GoPtr<Node>, selectedSymbol: (node: Node) => GoPtr<Symbol>): SourcePrimitiveFact | undefined;
//# sourceMappingURL=compiler-integration.d.ts.map