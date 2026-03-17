/**
 * Unsupported feature validation
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  getDynamicImportLiteralSpecifier,
  isClosedWorldDynamicImportSpecifier,
  isSideEffectOnlyDynamicImport,
  resolveDynamicImportNamespace,
} from "../resolver/dynamic-import.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";

const SUPPORTED_IMPORT_META_FIELDS = new Set(["url", "filename", "dirname"]);

const isSupportedImportMetaUsage = (node: ts.MetaProperty): boolean => {
  if (
    node.keywordToken !== ts.SyntaxKind.ImportKeyword ||
    node.name.text !== "meta"
  ) {
    return false;
  }

  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
    return SUPPORTED_IMPORT_META_FIELDS.has(parent.name.text);
  }

  return !ts.isElementAccessExpression(parent);
};

const isDynamicImportCall = (node: ts.CallExpression): boolean =>
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

const isLengthElementAccess = (
  node: ts.ElementAccessExpression | ts.ElementAccessChain
): boolean =>
  ts.isStringLiteralLike(node.argumentExpression) &&
  node.argumentExpression.text === "length";

const isFunctionLikeType = (
  type: ts.Type,
  checker: ts.TypeChecker,
  seen: ReadonlySet<ts.Type> = new Set<ts.Type>()
): boolean => {
  if (seen.has(type)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(type);

  if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0) {
    return true;
  }

  if (type.isUnionOrIntersection()) {
    return type.types.some((member) =>
      isFunctionLikeType(member, checker, nextSeen)
    );
  }

  return false;
};

const isKnownRuntimeLengthCarrier = (
  type: ts.Type,
  checker: ts.TypeChecker,
  seen: ReadonlySet<ts.Type> = new Set<ts.Type>()
): boolean => {
  if (seen.has(type)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(type);
  const apparent = checker.getApparentType(type);

  if (apparent.isUnion()) {
    return apparent.types.every((member) =>
      isKnownRuntimeLengthCarrier(member, checker, nextSeen)
    );
  }

  if (isFunctionLikeType(apparent, checker, nextSeen)) {
    return false;
  }

  if (checker.isTupleType(apparent) || checker.isArrayType(apparent)) {
    return true;
  }

  if (
    (apparent.flags & ts.TypeFlags.StringLike) !== 0 ||
    (apparent.flags & ts.TypeFlags.StringLiteral) !== 0
  ) {
    return true;
  }

  const symbolName = apparent.getSymbol()?.getName();
  if (
    symbolName === "Uint8Array" ||
    symbolName === "Int8Array" ||
    symbolName === "Uint16Array" ||
    symbolName === "Int16Array" ||
    symbolName === "Uint32Array" ||
    symbolName === "Int32Array" ||
    symbolName === "Float32Array" ||
    symbolName === "Float64Array" ||
    symbolName === "Uint8ClampedArray" ||
    symbolName === "BigInt64Array" ||
    symbolName === "BigUint64Array"
  ) {
    return true;
  }

  return false;
};

const isUnknownAnyOrObjectLike = (type: ts.Type): boolean => {
  if (
    (type.flags & ts.TypeFlags.Any) !== 0 ||
    (type.flags & ts.TypeFlags.Unknown) !== 0
  ) {
    return true;
  }

  if (type.isUnionOrIntersection()) {
    return type.types.some(isUnknownAnyOrObjectLike);
  }

  return (type.flags & ts.TypeFlags.Object) !== 0;
};

type TracedExpression = {
  readonly expression: ts.Expression;
  readonly throughAssertion: boolean;
};

const traceLengthAccessOrigin = (
  expression: ts.Expression,
  checker: ts.TypeChecker,
  depth = 0,
  throughAssertion = false
): TracedExpression => {
  if (depth > 8) {
    return { expression, throughAssertion };
  }

  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return traceLengthAccessOrigin(
      expression.expression,
      checker,
      depth + 1,
      throughAssertion
    );
  }

  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    return traceLengthAccessOrigin(
      expression.expression,
      checker,
      depth + 1,
      true
    );
  }

  if (ts.isIdentifier(expression)) {
    const symbol = checker.getSymbolAtLocation(expression);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    if (
      declaration &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer
    ) {
      return traceLengthAccessOrigin(
        declaration.initializer,
        checker,
        depth + 1,
        throughAssertion
      );
    }
  }

  return { expression, throughAssertion };
};

const getLengthAccessReceiver = (
  node: ts.Node
): ts.Expression | undefined => {
  if (
    (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) &&
    node.name.text === "length"
  ) {
    return node.expression;
  }

  if (
    (ts.isElementAccessExpression(node) || ts.isElementAccessChain(node)) &&
    isLengthElementAccess(node)
  ) {
    return node.expression;
  }

  return undefined;
};

const isUnsupportedFunctionLengthAccess = (
  node: ts.Node,
  checker: ts.TypeChecker
): boolean => {
  const receiver = getLengthAccessReceiver(node);
  if (!receiver) {
    return false;
  }

  const receiverType = checker.getTypeAtLocation(receiver);
  if (isFunctionLikeType(receiverType, checker)) {
    return true;
  }

  if (isKnownRuntimeLengthCarrier(receiverType, checker)) {
    return false;
  }

  const traced = traceLengthAccessOrigin(receiver, checker);
  if (!traced.throughAssertion) {
    return false;
  }

  const originType = checker.getTypeAtLocation(traced.expression);
  return (
    isFunctionLikeType(originType, checker) ||
    isUnknownAnyOrObjectLike(originType)
  );
};

/**
 * Validate that unsupported features are not used
 */
export const validateUnsupportedFeatures = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const checker = program.checker;
  const sourceFilesByPath = new Map<string, ts.SourceFile>(
    program.sourceFiles.map((currentSourceFile) => [
      currentSourceFile.fileName.replace(/\\/g, "/"),
      currentSourceFile,
    ])
  );

  const getDynamicImportSupportFailure = (
    node: ts.CallExpression
  ): string | undefined => {
    const specifier = getDynamicImportLiteralSpecifier(node);
    if (!specifier) {
      return "Dynamic import() is only supported for string-literal specifiers.";
    }

    if (!isClosedWorldDynamicImportSpecifier(specifier)) {
      return "Dynamic import() is only supported for closed-world local specifiers ('./' or '../').";
    }

    if (isSideEffectOnlyDynamicImport(node)) {
      return undefined;
    }

    if (ts.isExpressionStatement(node.parent)) {
      return 'Dynamic import() in bare side-effect position must be written as `await import("./local-module.js")`.';
    }

    const resolution = resolveDynamicImportNamespace(
      node,
      sourceFile.fileName,
      {
        checker: program.checker,
        compilerOptions: program.program.getCompilerOptions(),
        sourceFilesByPath,
      }
    );

    return resolution.ok ? undefined : resolution.reason;
  };

  const visitor = (node: ts.Node): void => {
    // Check for features we don't support yet
    if (ts.isWithStatement(node)) {
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          "'with' statement is not supported in strict AOT mode",
          getNodeLocation(sourceFile, node)
        )
      );
    }

    if (ts.isMetaProperty(node) && !isSupportedImportMetaUsage(node)) {
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          "Meta properties (import.meta) not supported in this form",
          getNodeLocation(sourceFile, node)
        )
      );
    }

    if (
      ts.isCallExpression(node) &&
      isDynamicImportCall(node) &&
      getDynamicImportSupportFailure(node) !== undefined
    ) {
      const message =
        getDynamicImportSupportFailure(node) ??
        "Dynamic import() is only supported for deterministic closed-world local modules.";
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN2001",
          "error",
          message,
          getNodeLocation(sourceFile, node),
          "Use static import declarations, or restrict dynamic import() to deterministic closed-world local modules."
        )
      );
    }

    if (isUnsupportedFunctionLengthAccess(node, checker)) {
      collector = addDiagnostic(
        collector,
        createDiagnostic(
          "TSN5001",
          "error",
          "JavaScript function.length is not supported in the NativeAOT backend. Use an explicit handler kind/tag or another deterministic discriminator instead.",
          getNodeLocation(sourceFile, node),
          "Avoid function arity inspection. Model the distinction with explicit tagged handler types or separate APIs."
        )
      );
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
