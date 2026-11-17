import type { Node } from "../../ast/spine.js";
import type { Symbol, SymbolTable } from "../../ast/symbol.js";
import type { SymbolFlags } from "../../ast/generated/flags.js";
import type { CheckFlags } from "../../ast/checkflags.js";
import type { Checker, CheckMode } from "./state.js";
import type { IndexInfo, LiteralSpreadSite, ObjectFlags, Signature, Type, TypeNodeLinks } from "../types.js";
export type LiteralCreatorInput = {
    readonly kind: "object-literal";
    readonly node: Node;
    readonly mode: CheckMode;
} | {
    readonly kind: "literal-fragment";
    readonly node: Node;
    readonly mode: CheckMode;
    readonly boundary: Node | null;
} | {
    readonly kind: "literal-merge";
    readonly site: LiteralSpreadSite;
    readonly left: Type;
    readonly right: Type;
    readonly flags: ObjectFlags;
    readonly readonly: boolean;
} | {
    readonly kind: "literal-partial";
    readonly site: LiteralSpreadSite;
    readonly source: Type;
    readonly other: Type;
    readonly role: "operand" | "left" | "right";
    readonly readonly: boolean;
};
export interface LiteralMemberInput {
    readonly symbol: Symbol;
    readonly target: Symbol | undefined;
    readonly flags: SymbolFlags;
    readonly checkFlags: CheckFlags;
    readonly nameType: Type | undefined;
    readonly value: Type | undefined;
    readonly declarations: readonly (Node | undefined)[];
    readonly parent: Symbol | undefined;
    readonly declaration: Node | undefined;
    readonly syntheticOrigin: Symbol | undefined;
    readonly leftSpread: Symbol | undefined;
    readonly rightSpread: Symbol | undefined;
}
export interface LiteralCreationInput {
    readonly symbol: Symbol | undefined;
    readonly flags: ObjectFlags;
    readonly pattern: Node | undefined;
    readonly members: readonly LiteralMemberInput[];
    readonly calls: readonly Signature[];
    readonly constructs: readonly Signature[];
    readonly indexes: readonly IndexInfo[];
}
export interface LiteralCreationView {
    readonly capability: LiteralCreation;
    readonly node: Node;
    readonly mode: CheckMode;
    readonly creator: LiteralCreatorInput;
    readonly owner: LiteralConstructionOwner | undefined;
    readonly inputs: () => LiteralCreationInput;
}
export declare class LiteralConstructionOwner {
    #private;
    private constructor();
    static begin(checker: Checker, node: Node, links: TypeNodeLinks): LiteralConstructionOwner;
    static complete(owner: LiteralConstructionOwner, root: Type | undefined): void;
    static read(owner: LiteralConstructionOwner, checker: Checker): {
        readonly node: Node;
        readonly root: Type;
    } | undefined;
}
export declare class LiteralCreation {
    #private;
    private constructor();
    static create(checker: Checker, creator: LiteralCreatorInput, symbol: Symbol | undefined, members: SymbolTable, calls: readonly Signature[], constructs: readonly Signature[], indexes: readonly IndexInfo[], flags: ObjectFlags, pattern: Node | undefined, owner?: LiteralConstructionOwner): Type;
    static read(type: Type): LiteralCreationView | undefined;
}
//# sourceMappingURL=literal-creation.d.ts.map