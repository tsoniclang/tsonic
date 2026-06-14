/**
 * Extension method validation
 *
 * `thisarg<T>` marks the receiver parameter of a source-level extension method.
 *
 * Airplane-grade constraints:
 * - Exactly one receiver parameter
 * - Must be the first parameter
 * - Only valid on top-level function declarations
 * - Receiver cannot be optional/rest/destructured/initialized
 * - Receiver cannot be `out`
 */

import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  forEachTstsChild,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";
import {
  extensionReceiverSemanticsFactKey,
  parameterPassingFactKey,
  parameterPassingModeFromFact,
} from "../source-frontend/index.js";
import {
  getNodeInitializer,
  getNodeParameters,
  getNodeType,
  isFunctionLikeWithParameters,
} from "./tsts-helpers.js";

type ReceiverMarkerInfo = {
  readonly markerNode: TstsNode;
  readonly passing: "value" | "ref" | "out" | "in";
};

const unwrapWrapperType = (
  typeNode: TstsNode
):
  | {
      readonly inner: TstsNode;
      readonly node: TstsNode;
    }
  | undefined => {
  if (typeNode.Kind !== TstsSyntax.KindTypeReference) return undefined;
  const typeReference = TstsSyntax.AsTypeReferenceNode(typeNode);
  const inner = typeReference?.TypeArguments?.Nodes[0];
  if (
    !typeReference?.TypeArguments ||
    typeReference.TypeArguments.Nodes.length !== 1 ||
    typeReference.TypeName?.Kind !== TstsSyntax.KindIdentifier ||
    !inner
  ) {
    return undefined;
  }

  return {
    inner,
    node: typeNode,
  };
};

const getReceiverMarkerInfo = (
  typeNode: TstsNode | undefined,
  program: TsonicProgram
): ReceiverMarkerInfo | undefined => {
  if (!typeNode) return undefined;

  let current: TstsNode | undefined = typeNode;
  let markerNode: TstsNode | undefined;
  let passing: "value" | "ref" | "out" | "in" = "value";

  while (current) {
    if (current.Kind === TstsSyntax.KindParenthesizedType) {
      current = getNodeType(current);
      continue;
    }

    const unwrapped = unwrapWrapperType(current);
    if (!unwrapped) break;

    const { inner, node } = unwrapped;

    if (
      program.sourceSemantics.getFact(node, extensionReceiverSemanticsFactKey)
    ) {
      markerNode ??= node;
      current = inner;
      continue;
    }

    const mode = parameterPassingModeFromFact(
      program.sourceSemantics.getFact(node, parameterPassingFactKey)
    );
    if (mode && mode !== "value") {
      passing = mode;
      current = inner;
      continue;
    }

    break;
  }

  if (!markerNode) return undefined;
  return { markerNode, passing };
};

const addReceiverDiagnostic = (
  sourceFile: TstsSourceFile,
  collector: DiagnosticsCollector,
  node: TstsNode,
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
  sourceFile: TstsSourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const visitor = (node: TstsNode | undefined): void => {
    if (!node) return;

    if (isFunctionLikeWithParameters(node)) {
      const receiverParams = getNodeParameters(node)
        .map((param, index) => ({
          param,
          index,
          info: getReceiverMarkerInfo(getNodeType(param), program),
        }))
        .filter((entry) => entry.info !== undefined) as Array<{
        readonly param: TstsNode;
        readonly index: number;
        readonly info: ReceiverMarkerInfo;
      }>;

      if (receiverParams.length > 0) {
        const isTopLevelFunctionDecl =
          node.Kind === TstsSyntax.KindFunctionDeclaration &&
          node.Parent === sourceFile;

        if (!isTopLevelFunctionDecl) {
          for (const param of receiverParams) {
            collector = addReceiverDiagnostic(
              sourceFile,
              collector,
              param.info.markerNode,
              "`thisarg<T>` is only valid on top-level function declarations.",
              "Move the function to module scope (top-level) and declare it with `export function ...`."
            );
          }
          forEachTstsChild(node, visitor);
          return;
        }

        if (receiverParams.length > 1) {
          for (const param of receiverParams.slice(1)) {
            collector = addReceiverDiagnostic(
              sourceFile,
              collector,
              param.info.markerNode,
              "Only one `thisarg<T>` receiver parameter is allowed."
            );
          }
        }

        const receiver = receiverParams[0];
        if (!receiver) {
          forEachTstsChild(node, visitor);
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

        const receiverName = TstsSyntax.Node_Name(receiver.param);
        if (
          receiverName?.Kind === TstsSyntax.KindObjectBindingPattern ||
          receiverName?.Kind === TstsSyntax.KindArrayBindingPattern
        ) {
          collector = addReceiverDiagnostic(
            sourceFile,
            collector,
            receiverName,
            "The `thisarg<T>` receiver parameter must be a simple identifier (no destructuring)."
          );
        }

        if (isTstsRestParameter(receiver.param)) {
          collector = addReceiverDiagnostic(
            sourceFile,
            collector,
            TstsSyntax.AsParameterDeclaration(receiver.param)?.DotDotDotToken ??
              receiver.param,
            "The `thisarg<T>` receiver parameter cannot be a rest parameter."
          );
        }

        const questionToken = TstsSyntax.Node_QuestionToken(receiver.param);
        if (questionToken) {
          collector = addReceiverDiagnostic(
            sourceFile,
            collector,
            questionToken,
            "The `thisarg<T>` receiver parameter cannot be optional."
          );
        }

        const initializer = getNodeInitializer(receiver.param);
        if (initializer) {
          collector = addReceiverDiagnostic(
            sourceFile,
            collector,
            initializer,
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

    forEachTstsChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
