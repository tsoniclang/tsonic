import type { Node } from "../internal/ast/ast.js";
import type { Checker } from "../internal/checker/checker/state.js";
import { type IndexInfo, type Type } from "../internal/checker/types.js";
import type { GoPtr } from "../go/compat.js";
export declare function typeIndexComponents(checker: GoPtr<Checker>, sourceType: GoPtr<Type>, index: GoPtr<IndexInfo>): readonly GoPtr<Node>[];
//# sourceMappingURL=type-index-components.d.ts.map