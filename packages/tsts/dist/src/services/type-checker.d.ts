import type { GoPtr } from "../go/compat.js";
import type { Context } from "../go/context.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Program } from "../internal/compiler/program.js";
import type { ResolvedSourceElementAccessInfo as CheckerResolvedSourceElementAccessInfo, ResolvedSourcePropertyAccessInfo as CheckerResolvedSourcePropertyAccessInfo } from "../internal/checker/checker/symbols.js";
import type { ExtensionCheckedIterationSelection } from "../internal/checker/checker/iteration-evidence.js";
import type { ContextFlags, ResolvedCallEvidence, Signature, Type } from "../internal/checker/types.js";
export interface TypeCheckerQueryOptions {
    readonly context?: Context;
    readonly sourceFile?: GoPtr<SourceFile>;
}
export type ResolvedSourceCallInfo = ResolvedCallEvidence;
export type ResolvedSourcePropertyAccessInfo = CheckerResolvedSourcePropertyAccessInfo;
export type ResolvedSourceElementAccessInfo = CheckerResolvedSourceElementAccessInfo;
export type ResolvedSourceIterationInfo = ExtensionCheckedIterationSelection;
export interface TypeCheckerQueries {
    readonly getTypeAtLocation: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
    readonly getTypeFromTypeNode: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
    readonly getContextualType: (node: GoPtr<Node>, contextFlags?: ContextFlags, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
    readonly getSymbolAtLocation: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
    readonly getResolvedSymbol: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
    readonly getResolvedSymbolOrNil: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
    readonly getAliasedSymbol: (symbol: GoPtr<Symbol>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
    readonly getTypeOfSymbol: (symbol: GoPtr<Symbol>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
    readonly getWriteTypeOfSymbol: (symbol: GoPtr<Symbol>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
    readonly getDeclaredTypeOfSymbol: (symbol: GoPtr<Symbol>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
    readonly getResolvedSignature: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Signature>;
    readonly getResolvedCallInfo: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<ResolvedSourceCallInfo>;
    readonly getResolvedPropertyAccessInfo: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<ResolvedSourcePropertyAccessInfo>;
    readonly getResolvedElementAccessInfo: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<ResolvedSourceElementAccessInfo>;
    readonly getResolvedIterationInfo: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<ResolvedSourceIterationInfo>;
    readonly getReturnTypeOfSignature: (signature: GoPtr<Signature>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
    readonly getCallSignaturesOfType: (type: GoPtr<Type>, options?: TypeCheckerQueryOptions) => readonly GoPtr<Signature>[];
    readonly getConstructSignaturesOfType: (type: GoPtr<Type>, options?: TypeCheckerQueryOptions) => readonly GoPtr<Signature>[];
    readonly getPropertyOfType: (type: GoPtr<Type>, name: string, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
    readonly getTypeOfPropertyOfType: (type: GoPtr<Type>, name: string, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
    readonly getConstantValue: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => unknown;
    readonly typeToString: (type: GoPtr<Type>, options?: TypeCheckerQueryOptions) => string;
    readonly getModuleSymbolFromSpecifier: (moduleSpecifier: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
    readonly getResolvedExternalModuleSymbol: (moduleSymbol: GoPtr<Symbol>, dontResolveAlias?: boolean, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
    readonly getExportsOfModule: (moduleSymbol: GoPtr<Symbol>, options?: TypeCheckerQueryOptions) => readonly GoPtr<Symbol>[];
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
export declare function createTypeCheckerQueries(program: GoPtr<Program>, defaultOptions?: TypeCheckerQueryOptions): TypeCheckerQueries;
//# sourceMappingURL=type-checker.d.ts.map