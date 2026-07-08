import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Type } from "../internal/checker/types.js";
import type { ExtensionHost } from "./host.js";
export declare function recordBoundSourceFileExtensionFacts(program: object, file: GoPtr<SourceFile>): void;
export declare function finalizeExtensionSemantics(program: object): ExtensionHost | undefined;
export declare function recordProviderTypeFamilyReferenceFacts(extensionHost: ExtensionHost, typeReference: GoPtr<Node>, type: GoPtr<Type>, symbol: GoPtr<Symbol>): void;
//# sourceMappingURL=compiler-integration.d.ts.map