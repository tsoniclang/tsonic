import type { GoPtr } from "../go/compat.js";
import type { Context } from "../go/context.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Program } from "../internal/compiler/program.js";
import type { ResolvedSourceElementAccessInfo as CheckerResolvedSourceElementAccessInfo, ResolvedSourcePropertyAccessInfo as CheckerResolvedSourcePropertyAccessInfo } from "../internal/checker/checker/symbols.js";
import type { ExtensionCheckedIterationSelection } from "../internal/checker/checker/iteration-evidence.js";
import type { ContextFlags, ResolvedCallEvidence, Signature, Type } from "../internal/checker/types.js";
export interface CreateTypeCheckerQueriesOptions {
    readonly sourceFile: GoPtr<SourceFile>;
    readonly context?: Context;
}
export type ResolvedSourceCallInfo = ResolvedCallEvidence;
export type ResolvedSourcePropertyAccessInfo = CheckerResolvedSourcePropertyAccessInfo;
export type ResolvedSourceElementAccessInfo = CheckerResolvedSourceElementAccessInfo;
export type ResolvedSourceIterationInfo = ExtensionCheckedIterationSelection;
export interface TypeCheckerQueries {
    readonly getTypeAtLocation: (node: GoPtr<Node>) => GoPtr<Type>;
    readonly getTypeFromTypeNode: (node: GoPtr<Node>) => GoPtr<Type>;
    readonly getContextualType: (node: GoPtr<Node>, contextFlags?: ContextFlags) => GoPtr<Type>;
    readonly getSymbolAtLocation: (node: GoPtr<Node>) => GoPtr<Symbol>;
    readonly getResolvedSymbol: (node: GoPtr<Node>) => GoPtr<Symbol>;
    readonly getResolvedSymbolOrNil: (node: GoPtr<Node>) => GoPtr<Symbol>;
    readonly getAliasedSymbol: (symbol: GoPtr<Symbol>) => GoPtr<Symbol>;
    readonly getTypeOfSymbol: (symbol: GoPtr<Symbol>) => GoPtr<Type>;
    readonly getWriteTypeOfSymbol: (symbol: GoPtr<Symbol>) => GoPtr<Type>;
    readonly getDeclaredTypeOfSymbol: (symbol: GoPtr<Symbol>) => GoPtr<Type>;
    readonly getResolvedSignature: (node: GoPtr<Node>) => GoPtr<Signature>;
    readonly getResolvedCallInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceCallInfo>;
    readonly getResolvedPropertyAccessInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourcePropertyAccessInfo>;
    readonly getResolvedElementAccessInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceElementAccessInfo>;
    readonly getResolvedIterationInfo: (node: GoPtr<Node>) => GoPtr<ResolvedSourceIterationInfo>;
    readonly getReturnTypeOfSignature: (signature: GoPtr<Signature>) => GoPtr<Type>;
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