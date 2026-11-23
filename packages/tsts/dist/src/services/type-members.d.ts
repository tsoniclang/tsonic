import type { GoPtr } from "../go/compat.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { IndexInfo, Type } from "../internal/checker/types.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { TypeIndexInfo, TypePropertyHeader, TypePropertyInfo } from "./type-shape.js";
export declare function readTypePropertyInfo(checker: Checker, type: GoPtr<Type>, symbol: GoPtr<Symbol>): TypePropertyInfo;
export declare function readObjectPropertyInfo(checker: Checker, type: Type, name: string): TypePropertyInfo | null | undefined;
export declare function walkObjectPropertyHeaders(checker: Checker, type: Type, admit: () => boolean, visit: (header: TypePropertyHeader) => boolean): "complete" | "stopped";
export declare function readTypeIndexInfo(checker: GoPtr<Checker>, type: GoPtr<Type>, info: GoPtr<IndexInfo>): TypeIndexInfo;
//# sourceMappingURL=type-members.d.ts.map