import * as ts from "typescript";
import type { DiagnosticsCollector } from "../types/diagnostic.js";
import { addDiagnostic, createDiagnostic } from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";
import { lambdaHasExpectedTypeContext } from "./contextual-type-analysis.js";

const isSimpleArrow = (
  node: ts.ArrowFunction
):
  | { readonly isSimple: true }
  | { readonly isSimple: false; readonly reason: string } => {
  for (const param of node.parameters) {
    if (!ts.isIdentifier(param.name)) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with destructuring patterns require explicit type annotations.",
      };
    }
  }

  for (const param of node.parameters) {
    if (param.initializer !== undefined) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with default parameter values require explicit type annotations.",
      };
    }
  }

  for (const param of node.parameters) {
    if (param.dotDotDotToken !== undefined) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with rest parameters require explicit type annotations.",
      };
    }
  }

  return { isSimple: true };
};

/**
 * TSN7430: Arrow function escape hatch validation.
 *
 * Arrow functions can infer types from context when a deterministic expected
 * callable type exists. Without contextual typing, only "simple arrows" are
 * allowed to rely on inference.
 */
export const validateArrowEscapeHatch = (
  node: ts.ArrowFunction,
  sourceFile: ts.SourceFile,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const hasExplicitReturnType = node.type !== undefined;
  const allParamsExplicitlyTyped = node.parameters.every(
    (param) => param.type !== undefined
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
