import type { GoPtr } from "../go/compat.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { ExtensionHost } from "./host.js";
export declare function recordBoundSourceFileExtensionFacts(program: object, file: GoPtr<SourceFile>): void;
export declare function finalizeExtensionSemantics(program: object): ExtensionHost | undefined;
//# sourceMappingURL=compiler-integration.d.ts.map