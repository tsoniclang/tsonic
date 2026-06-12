import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/spine.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Checker } from "../internal/checker/checker/state.js";
import {
  CheckModeNormal,
} from "../internal/checker/checker/state.js";
import {
  Checker_GetTypeAtLocation,
} from "../internal/checker/checker/types.js";
import {
  Checker_GetSymbolAtLocation,
} from "../internal/checker/checker/symbols.js";
import {
  Checker_getResolvedSignature,
} from "../internal/checker/checker/signatures.js";
import {
  Checker_GetContextualType,
} from "../internal/checker/services.js";
import {
  Checker_GetTypeOfSymbol,
} from "../internal/checker/exports.js";
import {
  Checker_TypeToString,
} from "../internal/checker/printer.js";
import type { ContextFlags, Signature, Type } from "../internal/checker/types.js";
import { ContextFlagsNone } from "../internal/checker/types.js";
import type { Expression } from "../internal/ast/generated/unions.js";

export type ExtensionTypeChecker = {
  getTypeAtLocation(node: GoPtr<Node>): GoPtr<Type>;
  getNarrowedTypeAtLocation(node: GoPtr<Node>): GoPtr<Type>;
  getSymbolAtLocation(node: GoPtr<Node>): GoPtr<Symbol>;
  getDeclaredTypeOfSymbol(symbol: GoPtr<Symbol>): GoPtr<Type>;
  getContextualType(node: GoPtr<Node>, contextFlags?: ContextFlags): GoPtr<Type>;
  getResolvedSignature(node: GoPtr<Node>): GoPtr<Signature>;
  typeToString(type: GoPtr<Type>): string;
};

export type ExtensionCheckerHandle = {
  readonly checker: GoPtr<Checker>;
  readonly facade: ExtensionTypeChecker;
};

export const createExtensionTypeChecker = (
  checker: GoPtr<Checker>,
): ExtensionTypeChecker => ({
  getTypeAtLocation: (node: GoPtr<Node>): GoPtr<Type> =>
    Checker_GetTypeAtLocation(checker, node),
  getNarrowedTypeAtLocation: (node: GoPtr<Node>): GoPtr<Type> =>
    Checker_GetTypeAtLocation(checker, node),
  getSymbolAtLocation: (node: GoPtr<Node>): GoPtr<Symbol> =>
    Checker_GetSymbolAtLocation(checker, node),
  getDeclaredTypeOfSymbol: (symbol: GoPtr<Symbol>): GoPtr<Type> =>
    Checker_GetTypeOfSymbol(checker, symbol),
  getContextualType: (
    node: GoPtr<Node>,
    contextFlags: ContextFlags = ContextFlagsNone,
  ): GoPtr<Type> =>
    Checker_GetContextualType(checker, node as GoPtr<Expression>, contextFlags),
  getResolvedSignature: (node: GoPtr<Node>): GoPtr<Signature> =>
    Checker_getResolvedSignature(
      checker,
      node,
      undefined,
      CheckModeNormal,
    ),
  typeToString: (type: GoPtr<Type>): string =>
    Checker_TypeToString(checker, type),
});

export const createExtensionCheckerHandle = (
  checker: GoPtr<Checker>,
): ExtensionCheckerHandle => ({
  checker,
  facade: createExtensionTypeChecker(checker),
});

export const hasTstsChecker = (
  handle: ExtensionCheckerHandle | undefined,
): handle is ExtensionCheckerHandle =>
  (handle !== undefined) as bool;
