import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import { isTstsRestParameter, TstsSyntax } from "@tsonic/tsts";
import type { DiagnosticsCollector } from "../types/diagnostic.js";
import { addDiagnostic, createDiagnostic } from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";
import { lambdaHasExpectedTypeContext } from "./contextual-type-analysis.js";
import {
  getNodeInitializer,
  getNodeParameters,
  getNodeType,
} from "./tsts-helpers.js";

const isSimpleArrow = (
  node: TstsNode
):
  | { readonly isSimple: true }
  | { readonly isSimple: false; readonly reason: string } => {
  for (const param of getNodeParameters(node)) {
    if (TstsSyntax.Node_Name(param)?.Kind !== TstsSyntax.KindIdentifier) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with destructuring patterns require explicit type annotations.",
      };
    }
  }

  for (const param of getNodeParameters(node)) {
    if (getNodeInitializer(param) !== undefined) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with default parameter values require explicit type annotations.",
      };
    }
  }

  for (const param of getNodeParameters(node)) {
    if (isTstsRestParameter(param)) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with rest parameters require explicit type annotations.",
      };
    }
  }

  return { isSimple: true };
};

export const validateArrowEscapeHatch = (
  node: TstsNode,
  sourceFile: TstsSourceFile,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const hasExplicitReturnType = getNodeType(node) !== undefined;
  const allParamsExplicitlyTyped = getNodeParameters(node).every(
    (param) => getNodeType(param) !== undefined
  );

  if (hasExplicitReturnType && allParamsExplicitlyTyped) {
    return collector;
  }

  if (lambdaHasExpectedTypeContext(node)) {
    return collector;
  }

  const simpleArrowResult = isSimpleArrow(node);
  if (simpleArrowResult.isSimple) {
    return addDiagnostic(
      collector,
      createDiagnostic(
        "TSN7430",
        "error",
        "Arrow function requires explicit types. No contextual type available for inference.",
        getNodeLocation(sourceFile, node),
        "Add explicit type annotations: (x: Type, y: Type): ReturnType => expression"
      )
    );
  }

  return addDiagnostic(
    collector,
    createDiagnostic(
      "TSN7430",
      "error",
      `Arrow function requires explicit types. ${simpleArrowResult.reason}`,
      getNodeLocation(sourceFile, node),
      "Only expression-bodied arrows with simple identifier parameters can infer types from context. Add explicit parameter and return type annotations."
    )
  );
};
