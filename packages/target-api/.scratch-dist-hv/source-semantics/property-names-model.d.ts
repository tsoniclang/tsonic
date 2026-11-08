import type { Node } from "@tsonic/tsts";
import type { SourceNumericLiteralToken } from "./literal-values-model.js";
import type { SourceEnumConstantSelection } from "./enum-model.js";
export type SourcePropertyNameConstant = {
    readonly kind: "string";
    readonly value: string;
} | {
    readonly kind: "numeric";
    readonly token: SourceNumericLiteralToken;
} | {
    readonly kind: "enum-member";
    readonly entry: Extract<SourceEnumConstantSelection, {
        kind: "resolved";
    }>;
};
/** The well-known symbols a computed key can select (the checker's ResolvedSourceWellKnownSymbolInfo kinds). */
export type SourceWellKnownSymbolKind = "async-dispose" | "async-iterator" | "dispose" | "has-instance" | "is-concat-spreadable" | "iterator" | "match" | "match-all" | "replace" | "search" | "species" | "split" | "to-primitive" | "to-string-tag" | "unscopables";
export type SourcePropertyNameSelection = {
    readonly kind: "resolved";
    readonly name: string;
    readonly constant: SourcePropertyNameConstant;
} | {
    readonly kind: "well-known-symbol";
    readonly symbol: SourceWellKnownSymbolKind;
}
/** A type-only key of a `unique symbol` type; `declaration` declares that unique symbol. */
 | {
    readonly kind: "unique-symbol";
    readonly declaration: Node;
} | {
    readonly kind: "rejected";
    readonly reason: string;
    readonly failure: "source" | "resource";
};
export interface SourcePropertyNameIndex {
    readonly entries: readonly {
        readonly node: Node;
        readonly selection: SourcePropertyNameSelection;
    }[];
    readonly issues: readonly {
        readonly node: Node;
        readonly reason: string;
        readonly failure: "source" | "resource";
    }[];
    get(name: Node): SourcePropertyNameSelection | undefined;
}
//# sourceMappingURL=property-names-model.d.ts.map