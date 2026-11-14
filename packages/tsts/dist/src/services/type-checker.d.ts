import type { ResolvedCheckerBackingConstraint } from "../internal/checker/types.js";
import type { GoPtr } from "../go/compat.js";
import type { Context } from "../go/context.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { TypeIndexInfo } from "./type-shape.js";
import type { Program } from "../internal/compiler/program.js";
import type { ResolvedSourceElementAccessInfo as CheckerResolvedSourceElementAccessInfo, ResolvedSourcePropertyAccessInfo as CheckerResolvedSourcePropertyAccessInfo } from "../internal/checker/checker/symbols.js";
import type { ExtensionCheckedIterationSelection } from "../internal/checker/checker/iteration-evidence.js";
import type { ContextFlags, ResolvedCallEvidence, Signature, Type } from "../internal/checker/types.js";
import type { ResolvedSourceFlowConditionInfo } from "./source-flow-conditions.js";
export type { ResolvedSourceFlowCondition, ResolvedSourceFlowConditionInfo } from "./source-flow-conditions.js";
export type { ResolvedSourceCallableCompletionInfo, ResolvedSourceGeneratorInfo, ResolvedSourceResourceManagementInfo, ResolvedSourceWellKnownSymbolInfo, ResolvedSourceYieldInfo, } from "./source-control-flow-evidence.js";
import type { ResolvedSourceCallableCompletionInfo, ResolvedSourceGeneratorInfo, ResolvedSourceResourceManagementInfo, ResolvedSourceWellKnownSymbolInfo, ResolvedSourceYieldInfo } from "./source-control-flow-evidence.js";
export interface CreateTypeCheckerQueriesOptions {
    readonly sourceFile: GoPtr<SourceFile>;
    readonly context?: Context;
}
export type ResolvedSourceCallInfo = ResolvedCallEvidence;
export interface ResolvedSourcePropertyNameInfo {
    readonly kind: "string" | "numeric" | "unique-symbol";
    readonly name: string;
    readonly type: Type;
}
export interface ResolvedSourceReceiverValueEvidence {
    readonly valueSymbol?: Symbol;
    readonly valueDeclaration?: Node;
    readonly intrinsic?: "global-object";
}
type PublicSelectedPropertyAccess<Selection> = Selection extends CheckerResolvedSourcePropertyAccessInfo ? Omit<Selection, "selectedIndex"> & {
    readonly selectedIndex?: TypeIndexInfo;
} : never;
/**
 * What a property access selects.
 *
 * "member": a member of the receiver's type, with the receiver, the selected symbol and declaration and the types.
 *
 * "module-exported-value": the access reads the `default` member the checker makes for the namespace of a
 * CommonJS-format module (`ns.default`), which stands for the module's exported value. That member has no
 * declaration and its symbol is shared between modules, so nothing is taken from the symbol. `target` names the
 * module only where the receiver EXPRESSION proves it: when the receiver is an import's own namespace binding it is
 * what getAliasStep gives for that binding (the module's `export =` assignment when it has one, the module
 * otherwise); when the receiver is `await import("m")` itself it is the same for that module. For any other receiver
 * (a variable the namespace value flowed into, a parameter, a conditional) `target` is nothing: the checker knows
 * that the member is a module's exported value and not which module. The receiver's type does not tell: a value
 * typed by one import's namespace may be another module's. The member's own symbol is shared by every module whose
 * exported value has the same type, and its Parent is the first such module: a consumer takes the module only from
 * `target`, never from that symbol.
 */
export type ResolvedSourcePropertyAccessInfo = (PublicSelectedPropertyAccess<CheckerResolvedSourcePropertyAccessInfo> & {
    readonly kind: "member";
    readonly receiver: CheckerResolvedSourcePropertyAccessInfo["receiver"] & ResolvedSourceReceiverValueEvidence;
}) | {
    readonly kind: "module-exported-value";
    readonly target: Symbol | undefined;
};
export type ResolvedSourceElementAccessInfo = CheckerResolvedSourceElementAccessInfo & {
    readonly receiver: CheckerResolvedSourceElementAccessInfo["receiver"] & ResolvedSourceReceiverValueEvidence;
};
export type ResolvedSourceIterationInfo = ExtensionCheckedIterationSelection;
export type ResolvedSourceObjectLiteralElementKind = "property" | "shorthand" | "method" | "get" | "set";
export interface ResolvedSourceObjectLiteralElementInfo {
    readonly objectLiteral: Node;
    readonly element: Node;
    readonly elementKind: ResolvedSourceObjectLiteralElementKind;
    readonly objectLiteralType: Type;
    readonly contextualType?: Type;
    readonly sourceElementSymbol?: Symbol;
    readonly sourceElementType: Type;
    readonly sourceSelectedSymbol?: Symbol;
    readonly sourceSelectedDeclaration?: Node;
    readonly sourceSelectedDeclarations: readonly Node[];
    readonly sourceSelectedType: Type;
}
/**
 * One step of an alias chain: what an alias binding names directly.
 *
 * "symbol": the step is a symbol, itself an alias when the chain continues.
 * - import specifier, export specifier: the module's export of that name, or the local entity that a
 *   local `export { a }` names;
 * - default import: the module's default export;
 * - `import x = require(...)`, namespace import, `export * as ns`: the module itself, or, for a module
 *   with `export =`, the symbol of that assignment (an alias when the assignment names an entity; declared
 *   by the assignment either way). The assignment is never skipped, and the symbol the checker makes for
 *   a namespace import of a CommonJS-format file is never the answer;
 * - `import x = N.v`: the named entity.
 *
 * "exported-value-member": an import or export specifier that names a member of the value a module
 * exports with `export =`. The checker finds such a member on the final value behind the assignment, so
 * the step is not a symbol of the module: `exportAssignment` is the assignment's symbol, the boundary
 * the binding passes, and `member` is the member found behind it, or nothing. When `member` is nothing,
 * the steps from `exportAssignment` tell which: they end at a value that has no such member, or they end
 * at an alias that does not resolve.
 *
 * Not covered: a destructured `require` in a JavaScript file (`const { a } = require("m")`), whose alias
 * is a binding element. It is answered as a "symbol" step with the checker's own target, which lies
 * behind the module's `export =`.
 */
export type ResolvedAliasStep = {
    readonly kind: "symbol";
    readonly symbol: Symbol;
} | {
    readonly kind: "exported-value-member";
    readonly exportAssignment: Symbol;
    readonly member: Symbol | undefined;
};
export interface ResolvedSourceStorageInfo {
    readonly expression: Node;
    readonly storageExpression: Node;
    readonly type: Type;
    readonly symbol?: Symbol;
    readonly declaration?: Node;
    readonly writable: boolean;
}
export interface TypeCheckerQueries {
    readonly getBackingConstraints: () => readonly ResolvedCheckerBackingConstraint[];
    readonly getGlobalValueSymbol: (name: string) => GoPtr<Symbol>;
    readonly isDefaultLibraryDeclaration: (node: GoPtr<Node>) => boolean;
    readonly getAwaitedType: (type: GoPtr<Type>) => GoPtr<Type>;
    readonly getTypeAtLocation: (node: GoPtr<Node>) => GoPtr<Type>;
    readonly getTypeFromTypeNode: (node: GoPtr<Node>) => GoPtr<Type>;
    readonly getContextualType: (node: GoPtr<Node>, contextFlags?: ContextFlags) => GoPtr<Type>;
    readonly getEffectivePropertyName: (node: GoPtr<Node>) => GoPtr<ResolvedSourcePropertyNameInfo>;
    readonly getSymbolAtLocation: (node: GoPtr<Node>) => GoPtr<Symbol>;
    readonly getLexicallyResolvedSymbol: (identifier: GoPtr<Node>) => GoPtr<Symbol>;
    readonly getResolvedSymbol: (node: GoPtr<Node>) => GoPtr<Symbol>;
    readonly getResolvedSymbolOrNil: (node: GoPtr<Node>) => GoPtr<Symbol>;
    readonly getAliasedSymbol: (symbol: GoPtr<Symbol>) => GoPtr<Symbol>;
    /**
     * One step of an alias chain (see ResolvedAliasStep). Nothing, and no throw, for a symbol that is not
     * an alias and for an alias whose own step did not resolve (a missing module, or a missing export of a
     * module without `export =`). A member of a circular alias chain has a step: following the steps from it
     * returns to a symbol already visited, which is how a caller finds the cycle's members.
     *
     * Compare what the two alias queries return by declaration, never by symbol identity. getAliasedSymbol
     * gives the final target of the whole chain, and for a namespace import, in an ECMAScript-format file,
     * of a CommonJS-format file that target is a symbol made for that import declaration: it has the
     * target's declarations and is a different object for each import declaration. Steps are symbols of
     * modules and declarations, but one export reached by two bindings is not promised to be one object.
     *
     * Cost: a step that did not resolve is not remembered. Each further call for that alias runs the step
     * again and creates its diagnostic again. Ask once per binding and keep the answer; never once per use.
     */
    readonly getAliasStep: (symbol: GoPtr<Symbol>) => GoPtr<ResolvedAliasStep>;
    readonly getTypeOfSymbol: (symbol: GoPtr<Symbol>) => GoPtr<Type>;
    readonly getWriteTypeOfSymbol: (symbol: GoPtr<Symbol>) => GoPtr<Type>;
    readonly getDeclaredTypeOfSymbol: (symbol: GoPtr<Symbol>) => GoPtr<Type>;
    readonly getResolvedSignature: (node: GoPtr<Node>) => GoPtr<Signature>;
    readonly getSignatureFromDeclaration: (declaration: GoPtr<Node>) => GoPtr<Signature>;
    readonly getResolvedCallInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceCallInfo>;
    readonly getResolvedPropertyAccessInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourcePropertyAccessInfo>;
    readonly getResolvedElementAccessInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceElementAccessInfo>;
    readonly getResolvedIterationInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceIterationInfo>;
    readonly getResolvedObjectLiteralElementInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceObjectLiteralElementInfo>;
    readonly getResolvedStorageInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceStorageInfo>;
    readonly getResolvedCallableCompletionInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceCallableCompletionInfo>;
    readonly getResolvedFlowConditionInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceFlowConditionInfo>;
    readonly getResolvedGeneratorInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceGeneratorInfo>;
    readonly getResolvedYieldInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceYieldInfo>;
    readonly getResolvedWellKnownSymbolInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceWellKnownSymbolInfo>;
    readonly getResolvedResourceManagementInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceResourceManagementInfo>;
    readonly getReturnTypeOfSignature: (signature: GoPtr<Signature>) => GoPtr<Type>;
    readonly getInvocationReturnTypeOfSignature: (signature: GoPtr<Signature>) => GoPtr<Type>;
    readonly getCallSignaturesOfType: (type: GoPtr<Type>) => readonly GoPtr<Signature>[];
    readonly getConstructSignaturesOfType: (type: GoPtr<Type>) => readonly GoPtr<Signature>[];
    readonly getPropertyOfType: (type: GoPtr<Type>, name: string) => GoPtr<Symbol>;
    readonly getTypeOfPropertyOfType: (type: GoPtr<Type>, name: string) => GoPtr<Type>;
    readonly getConstantValue: (node: GoPtr<Node>) => unknown;
    readonly typeToString: (type: GoPtr<Type>) => string;
    readonly getModuleSymbolFromSpecifier: (moduleSpecifier: GoPtr<Node>) => GoPtr<Symbol>;
    readonly getResolvedExternalModuleSymbol: (moduleSymbol: GoPtr<Symbol>, dontResolveAlias?: boolean) => GoPtr<Symbol>;
    readonly getExportsOfModule: (moduleSymbol: GoPtr<Symbol>) => readonly GoPtr<Symbol>[];
    readonly getSymbolName: (symbol: GoPtr<Symbol>) => string;
    readonly getSymbolDeclarations: (symbol: GoPtr<Symbol>) => readonly GoPtr<Node>[];
    readonly getRootSymbols: (symbol: GoPtr<Symbol>) => readonly GoPtr<Symbol>[];
    readonly getSymbolValueDeclaration: (symbol: GoPtr<Symbol>) => GoPtr<Node>;
    readonly getPrimarySymbolDeclaration: (symbol: GoPtr<Symbol>) => GoPtr<Node>;
    readonly getSymbolSourceFile: (symbol: GoPtr<Symbol>) => GoPtr<SourceFile>;
    readonly getTypeSymbol: (type: GoPtr<Type>) => GoPtr<Symbol>;
    readonly getTypeAliasSymbol: (type: GoPtr<Type>) => GoPtr<Symbol>;
    readonly getSignatureDeclaration: (signature: GoPtr<Signature>) => GoPtr<Node>;
    readonly getSignatureParameters: (signature: GoPtr<Signature>) => readonly GoPtr<Symbol>[];
    readonly getSignatureThisParameter: (signature: GoPtr<Signature>) => GoPtr<Symbol>;
}
export declare function createTypeCheckerQueries(program: GoPtr<Program>, defaultOptions: CreateTypeCheckerQueriesOptions): TypeCheckerQueries;
//# sourceMappingURL=type-checker.d.ts.map