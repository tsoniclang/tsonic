import type { GoPtr } from "../go/compat.js";
import type { Context } from "../go/context.js";
import { Background } from "../go/context.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { Program_GetTypeCheckerForFile } from "../internal/compiler/program.js";
import type { Program } from "../internal/compiler/program.js";
import { Checker_getResolvedSignature } from "../internal/checker/checker/signatures.js";
import { CheckModeNormal } from "../internal/checker/checker/state.js";
import type { Checker } from "../internal/checker/checker/state.js";
import { Checker_GetSymbolAtLocation, Checker_getDeclaredTypeOfSymbol, Checker_getResolvedSymbol, Checker_getResolvedSymbolOrNil, Checker_getTypeOfSymbol } from "../internal/checker/checker/symbols.js";
import { Checker_getContextualType, Checker_GetTypeAtLocation } from "../internal/checker/checker/types.js";
import type { ContextFlags, Signature, Type } from "../internal/checker/types.js";
import { ContextFlagsNone } from "../internal/checker/types.js";

export interface TypeCheckerQueryOptions {
  readonly context?: Context;
  readonly sourceFile?: GoPtr<SourceFile>;
}

export interface TypeCheckerQueries {
  readonly getTypeAtLocation: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
  readonly getContextualType: (node: GoPtr<Node>, contextFlags?: ContextFlags, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
  readonly getSymbolAtLocation: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
  readonly getResolvedSymbol: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
  readonly getResolvedSymbolOrNil: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Symbol>;
  readonly getTypeOfSymbol: (symbol: GoPtr<Symbol>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
  readonly getDeclaredTypeOfSymbol: (symbol: GoPtr<Symbol>, options?: TypeCheckerQueryOptions) => GoPtr<Type>;
  readonly getResolvedSignature: (node: GoPtr<Node>, options?: TypeCheckerQueryOptions) => GoPtr<Signature>;
}

export function createTypeCheckerQueries(program: GoPtr<Program>, defaultOptions: TypeCheckerQueryOptions = {}): TypeCheckerQueries {
  return {
    getTypeAtLocation: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetTypeAtLocation(checker, node)),
    getContextualType: (node, contextFlags = ContextFlagsNone, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getContextualType(checker, node, contextFlags)),
    getSymbolAtLocation: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_GetSymbolAtLocation(checker, node)),
    getResolvedSymbol: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getResolvedSymbol(checker, node)),
    getResolvedSymbolOrNil: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getResolvedSymbolOrNil(checker, node)),
    getTypeOfSymbol: (symbol, options = {}) =>
      withCheckerForSymbol(program, symbol, defaultOptions, options, (checker) => Checker_getTypeOfSymbol(checker, symbol)),
    getDeclaredTypeOfSymbol: (symbol, options = {}) =>
      withCheckerForSymbol(program, symbol, defaultOptions, options, (checker) => Checker_getDeclaredTypeOfSymbol(checker, symbol)),
    getResolvedSignature: (node, options = {}) =>
      withCheckerForNode(program, node, defaultOptions, options, (checker) => Checker_getResolvedSignature(checker, node, undefined, CheckModeNormal)),
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
