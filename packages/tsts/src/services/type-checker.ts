import type { GoPtr } from "../go/compat.js";
import type { Context } from "../go/context.js";
import { Background } from "../go/context.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import { Node_Symbol, SourceFile_as_ast_HasFileName } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import { GetSourceFileOfNode, IsStringLiteralLike } from "../internal/ast/utilities.js";
import { Program_GetResolvedModuleFromModuleSpecifier, Program_GetSourceFileForResolvedModule, Program_GetTypeCheckerForFile } from "../internal/compiler/program.js";
import type { Program } from "../internal/compiler/program.js";
import { Checker_TryGetMemberInModuleExports } from "../internal/checker/services.js";
import { Checker_getResolvedSignature, Checker_getReturnTypeOfSignature, Checker_getSignatureFromDeclaration } from "../internal/checker/checker/signatures.js";
import { CheckModeNormal } from "../internal/checker/checker/state.js";
import type { Checker } from "../internal/checker/checker/state.js";
import { Checker_GetAliasedSymbol, Checker_GetSymbolAtLocation, Checker_getDeclaredTypeOfSymbol, Checker_getEnumMemberValue, Checker_getResolvedSymbol, Checker_getResolvedSymbolOrNil, Checker_getTypeOfSymbol } from "../internal/checker/checker/symbols.js";
import { Checker_getContextualType, Checker_getTypeFromTypeNode, Checker_GetTypeAtLocation } from "../internal/checker/checker/types.js";
import { Checker_TypeToString } from "../internal/checker/printer.js";
import type { ContextFlags, Signature, Type } from "../internal/checker/types.js";
import { ContextFlagsNone } from "../internal/checker/types.js";
import { KindEnumMember } from "../internal/ast/generated/kinds.js";
import { SymbolFlagsAlias } from "../internal/ast/generated/flags.js";

export interface TypeCheckerQueryOptions {
  readonly context?: Context;
  readonly sourceFile?: GoPtr<SourceFile>;
}

export interface TypeScriptEnumMemberValue {
  readonly value: string | number | undefined;
  readonly isSyntacticallyString: boolean;
  readonly resolvedOtherFiles: boolean;
  readonly hasExternalReferences: boolean;
}

export interface TypeCheckerQueries {
  readonly getTypeAtLocation: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
  readonly getTypeFromTypeNode: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
  readonly getContextualType: (node: GoPtr<Node>, contextFlags?: ContextFlags, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
  readonly getSymbolAtLocation: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
  readonly getResolvedSymbol: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
  readonly getResolvedSymbolOrNil: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
  readonly getAliasedSymbol: (symbol: GoPtr<Symbol>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
  readonly getResolvedModuleSourceFile: (containingSourceFile: GoPtr<SourceFile>, moduleSpecifier: GoPtr<Node>) => GoPtr<SourceFile>;
  readonly getModuleExportSymbol: (moduleSourceFile: GoPtr<SourceFile>, exportName: string, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
  readonly getTypeOfSymbol: (symbol: GoPtr<Symbol>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
  readonly getDeclaredTypeOfSymbol: (symbol: GoPtr<Symbol>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
  readonly getResolvedSignature: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Signature>;
  readonly getSignatureFromDeclaration: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Signature>;
  readonly getReturnTypeOfSignature: (signature: GoPtr<Signature>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
  readonly getEnumMemberValue: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => TypeScriptEnumMemberValue | undefined;
  readonly typeToString: (type: GoPtr<Type>, options?: TypeCheckerQueryOptions) => string | undefined;
}

export function createTypeCheckerQueries(program: GoPtr<Program>, defaultOptions: TypeCheckerQueryOptions = {}): TypeCheckerQueries {
  return {
    getTypeAtLocation: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetTypeAtLocation(checker, node)),
    getTypeFromTypeNode: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getTypeFromTypeNode(checker, node)),
    getContextualType: (node, contextFlags = ContextFlagsNone, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getContextualType(checker, node, contextFlags)),
    getSymbolAtLocation: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetSymbolAtLocation(checker, node)),
    getResolvedSymbol: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getResolvedSymbol(checker, node)),
    getResolvedSymbolOrNil: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getResolvedSymbolOrNil(checker, node)),
    getAliasedSymbol: (symbol, options = {}) => {
      if (symbol === undefined || (symbol.Flags & SymbolFlagsAlias) === 0) {
        return undefined;
      }
      return withCheckerForSymbol(program, symbol, defaultOptions, options, (checker) => Checker_GetAliasedSymbol(checker, symbol));
    },
    getResolvedModuleSourceFile: (containingSourceFile, moduleSpecifier) =>
      getResolvedModuleSourceFile(program, containingSourceFile, moduleSpecifier),
    getModuleExportSymbol: (moduleSourceFile, exportName, options = {}) =>
      withChecker(program, moduleSourceFile, defaultOptions, options, (checker) => {
        const moduleSymbol = Node_Symbol(moduleSourceFile);
        return moduleSymbol === undefined
          ? undefined
          : Checker_TryGetMemberInModuleExports(checker, exportName, moduleSymbol);
      }),
    getTypeOfSymbol: (symbol, options = {}) =>
      withCheckerForSymbol(program, symbol, defaultOptions, options, (checker) => Checker_getTypeOfSymbol(checker, symbol)),
    getDeclaredTypeOfSymbol: (symbol, options = {}) =>
      withCheckerForSymbol(program, symbol, defaultOptions, options, (checker) => Checker_getDeclaredTypeOfSymbol(checker, symbol)),
    getResolvedSignature: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getResolvedSignature(checker, node, undefined, CheckModeNormal)),
    getSignatureFromDeclaration: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getSignatureFromDeclaration(checker, node)),
    getReturnTypeOfSignature: (signature, options = {}) =>
      withCheckerForSignature(program, signature, defaultOptions, options, (checker) => Checker_getReturnTypeOfSignature(checker, signature)),
    getEnumMemberValue: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => getEnumMemberValue(checker, node)),
    typeToString: (type, options = {}) =>
      withChecker(program, options.sourceFile ?? defaultOptions.sourceFile, defaultOptions, options, (checker) =>
        type === undefined ? undefined : Checker_TypeToString(checker, type)),
  };
}

function getResolvedModuleSourceFile(
  program: GoPtr<Program>,
  containingSourceFile: GoPtr<SourceFile>,
  moduleSpecifier: GoPtr<Node>,
): GoPtr<SourceFile> {
  if (
    program === undefined ||
    containingSourceFile === undefined ||
    moduleSpecifier === undefined ||
    !IsStringLiteralLike(moduleSpecifier)
  ) {
    return undefined;
  }
  const resolved = Program_GetResolvedModuleFromModuleSpecifier(
    program,
    SourceFile_as_ast_HasFileName(containingSourceFile),
    moduleSpecifier,
  );
  return resolved === undefined || resolved.ResolvedFileName === ""
    ? undefined
    : Program_GetSourceFileForResolvedModule(program, resolved.ResolvedFileName);
}

function getEnumMemberValue(checker: GoPtr<Checker>, node: GoPtr<Node>): TypeScriptEnumMemberValue | undefined {
  if (checker === undefined || node === undefined || node.Kind !== KindEnumMember) {
    return undefined;
  }
  const result = Checker_getEnumMemberValue(checker, node);
  const value = typeof result.Value === "number" || typeof result.Value === "string"
    ? result.Value
    : undefined;
  return {
    value,
    isSyntacticallyString: result.IsSyntacticallyString,
    resolvedOtherFiles: result.ResolvedOtherFiles,
    hasExternalReferences: result.HasExternalReferences,
  };
}

function withCheckerForNode<T>(
  program: GoPtr<Program>,
  node: GoPtr<Node>,
  defaultOptions: TypeCheckerQueryOptions,
  options: TypeCheckerQueryOptions,
  callback: (checker: GoPtr<Checker>) => GoPtr<T>,
): GoPtr<T> {
  if (node === undefined) {
    return undefined;
  }
  return withChecker(program, options.sourceFile ?? defaultOptions.sourceFile ?? GetSourceFileOfNode(node), defaultOptions, options, callback);
}

function withCheckerForSymbol<T>(
  program: GoPtr<Program>,
  symbol: GoPtr<Symbol>,
  defaultOptions: TypeCheckerQueryOptions,
  options: TypeCheckerQueryOptions,
  callback: (checker: GoPtr<Checker>) => GoPtr<T>,
): GoPtr<T> {
  if (symbol === undefined) {
    return undefined;
  }
  return withChecker(program, options.sourceFile ?? defaultOptions.sourceFile ?? getSymbolSourceFile(symbol), defaultOptions, options, callback);
}

function withCheckerForSignature<T>(
  program: GoPtr<Program>,
  signature: GoPtr<Signature>,
  defaultOptions: TypeCheckerQueryOptions,
  options: TypeCheckerQueryOptions,
  callback: (checker: GoPtr<Checker>) => GoPtr<T>,
): GoPtr<T> {
  if (signature === undefined) {
    return undefined;
  }
  return withChecker(program, options.sourceFile ?? defaultOptions.sourceFile ?? GetSourceFileOfNode(signature.declaration), defaultOptions, options, callback);
}

function withChecker<T>(
  program: GoPtr<Program>,
  sourceFile: GoPtr<SourceFile>,
  defaultOptions: TypeCheckerQueryOptions,
  options: TypeCheckerQueryOptions,
  callback: (checker: GoPtr<Checker>) => GoPtr<T>,
): GoPtr<T> {
  if (program === undefined || sourceFile === undefined) {
    return undefined;
  }
  const [checker, done] = Program_GetTypeCheckerForFile(program, options.context ?? defaultOptions.context ?? Background(), sourceFile);
  try {
    return callback(checker);
  } finally {
    done();
  }
}

function getSymbolSourceFile(symbol: GoPtr<Symbol>): GoPtr<SourceFile> {
  const declaration = symbol?.ValueDeclaration ?? symbol?.Declarations?.find((candidate) => candidate !== undefined);
  return GetSourceFileOfNode(declaration);
}
