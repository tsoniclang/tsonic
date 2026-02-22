/**
 * Extension method validation
 *
 * `thisarg<T>` marks the receiver parameter of a C# extension method.
 *
 * Airplane-grade constraints:
 * - Exactly one receiver parameter
 * - Must be the first parameter
 * - Only valid on top-level function declarations (emitted into a static container class)
 * - Receiver cannot be optional/rest/destructured/initialized
 * - Receiver cannot be `out`
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";

type ReceiverMarkerInfo = {
  readonly markerNode: ts.TypeReferenceNode;
  readonly passing: "value" | "ref" | "out" | "in";
};

const unwrapWrapperType = (
  typeNode: ts.TypeNode
):
  | {
      readonly wrapperName: string;
      readonly inner: ts.TypeNode;
      readonly node: ts.TypeReferenceNode;
    }
  | undefined => {
  if (!ts.isTypeReferenceNode(typeNode)) return undefined;
  if (!typeNode.typeArguments || typeNode.typeArguments.length !== 1)
    return undefined;
  if (!ts.isIdentifier(typeNode.typeName)) return undefined;

  const inner = typeNode.typeArguments[0];
  if (!inner) return undefined;

  return {
    wrapperName: typeNode.typeName.text,
    inner,
    node: typeNode,
  };
};

const getReceiverMarkerInfo = (
  typeNode: ts.TypeNode | undefined
): ReceiverMarkerInfo | undefined => {
  if (!typeNode) return undefined;

  let current: ts.TypeNode = typeNode;
  let markerNode: ts.TypeReferenceNode | undefined;
  let passing: "value" | "ref" | "out" | "in" = "value";

  // Mirror IR conversion unwrapping rules:
  // wrappers may be nested; unwrap repeatedly.
  while (true) {
    if (ts.isParenthesizedTypeNode(current)) {
      current = current.type;
      continue;
    }

    const unwrapped = unwrapWrapperType(current);
    if (!unwrapped) break;

    const { wrapperName, inner, node } = unwrapped;

    if (wrapperName === "thisarg") {
      markerNode ??= node;
      current = inner;
      continue;
    }

    if (wrapperName === "ref" || wrapperName === "out") {
      passing = wrapperName;
      current = inner;
      continue;
    }

    if (wrapperName === "in" || wrapperName === "inref") {
      passing = "in";
      current = inner;
      continue;
    }

    break;
  }

  if (!markerNode) return undefined;
  return { markerNode, passing };
};

const addReceiverDiagnostic = (
  sourceFile: ts.SourceFile,
  collector: DiagnosticsCollector,
  node: ts.Node,
  message: string,
  hint?: string
): DiagnosticsCollector =>
  addDiagnostic(
    collector,
    createDiagnostic(
      "TSN7106",
      "error",
      message,
      getNodeLocation(sourceFile, node),
      hint
    )
  );

export const validateExtensionMethods = (
  sourceFile: ts.SourceFile,
  _program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const visitor = (node: ts.Node): void => {
    // Only check function-like nodes (where parameters exist).
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isMethodSignature(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      const receiverParams = node.parameters
        .map((p, index) => ({
          param: p,
          index,
          info: getReceiverMarkerInfo(p.type),
        }))
        .filter((p) => p.info !== undefined) as Array<{
        readonly param: ts.ParameterDeclaration;
        readonly index: number;
        readonly info: ReceiverMarkerInfo;
      }>;

      if (receiverParams.length > 0) {
        // Only allow on top-level function declarations.
        const isTopLevelFunctionDecl =
          ts.isFunctionDeclaration(node) && node.parent === sourceFile;

        if (!isTopLevelFunctionDecl) {
          for (const p of receiverParams) {
            collector = addReceiverDiagnostic(
              sourceFile,
              collector,
              p.info.markerNode,
              "`thisarg<T>` is only valid on top-level function declarations (C# extension methods).",
              "Move the function to module scope (top-level) and declare it with `export function ...`."
            );
          }
          // Still recurse to find additional violations in nested scopes.
          ts.forEachChild(node, visitor);
          return;
        }

        if (receiverParams.length > 1) {
          for (const p of receiverParams.slice(1)) {
            collector = addReceiverDiagnostic(
              sourceFile,
              collector,
              p.info.markerNode,
              "Only one `thisarg<T>` receiver parameter is allowed."
            );
          }
        }

        const receiver = receiverParams[0];
        if (!receiver) {
          ts.forEachChild(node, visitor);
          return;
        }

        if (receiver.index !== 0) {
          collector = addReceiverDiagnostic(
            sourceFile,
            collector,
            receiver.info.markerNode,
            "The `thisarg<T>` receiver parameter must be the first parameter."
          );
        }

        if (
          ts.isObjectBindingPattern(receiver.param.name) ||
          ts.isArrayBindingPattern(receiver.param.name)
        ) {
          collector = addReceiverDiagnostic(
            sourceFile,
            collector,
            receiver.param.name,
            "The `thisarg<T>` receiver parameter must be a simple identifier (no destructuring)."
          );
        }

        if (receiver.param.dotDotDotToken) {
          collector = addReceiverDiagnostic(
            sourceFile,
            collector,
            receiver.param.dotDotDotToken,
            "The `thisarg<T>` receiver parameter cannot be a rest parameter."
          );
        }

        if (receiver.param.questionToken) {
          collector = addReceiverDiagnostic(
            sourceFile,
            collector,
            receiver.param.questionToken,
            "The `thisarg<T>` receiver parameter cannot be optional."
          );
        }

        if (receiver.param.initializer) {
          collector = addReceiverDiagnostic(
            sourceFile,
            collector,
            receiver.param.initializer,
            "The `thisarg<T>` receiver parameter cannot have a default initializer."
          );
        }

        if (receiver.info.passing === "out") {
          collector = addReceiverDiagnostic(
            sourceFile,
            collector,
            receiver.info.markerNode,
            "The `thisarg<T>` receiver parameter cannot be `out`."
          );
        }
      }
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
