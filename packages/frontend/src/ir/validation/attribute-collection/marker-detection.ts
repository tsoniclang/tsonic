/**
 * Attribute Collection — API Detection & Target/Selector Parsing
 *
 * Contains attribute target parsing, member name extraction, API usage detection,
 * on-call parsing, and selector parsing helpers.
 */

import { createDiagnostic, SourceLocation } from "../../../types/diagnostic.js";
import {
  IrModule,
  IrExpression,
  IrCallExpression,
  IrMemberExpression,
  IrIdentifierExpression,
  IrAttributeTarget,
  IrArrowFunctionExpression,
  IrSpreadExpression,
  IrObjectProperty,
  IrStatement,
} from "../../types.js";
import {
  ATTRIBUTE_TARGETS,
  ATTRIBUTE_TARGETS_SET,
  ATTRIBUTE_TARGETS_EXPORT_NAME,
  type ParseResult,
  createLocation,
  isAttributesApiIdentifier,
} from "./arg-extractor.js";

// ═══════════════════════════════════════════════════════════════════════════
// ATTRIBUTE TARGET PARSING
// ═══════════════════════════════════════════════════════════════════════════

export const parseAttributeTarget = (
  expr: IrExpression,
  module: IrModule,
  attributeTargetsApiNames: ReadonlySet<string>
): ParseResult<IrAttributeTarget> => {
  const fail = (message: string): ParseResult<IrAttributeTarget> => ({
    kind: "error",
    diagnostic: createDiagnostic(
      "TSN4005",
      "error",
      message,
      createLocation(module.filePath, expr.sourceSpan)
    ),
  });

  // Allow string literal: .target("return")
  if (expr.kind === "literal" && typeof expr.value === "string") {
    const value = expr.value;
    if (ATTRIBUTE_TARGETS_SET.has(value as IrAttributeTarget)) {
      return { kind: "ok", value: value as IrAttributeTarget };
    }
    return fail(
      `Invalid attribute target '${value}'. Expected one of: ${ATTRIBUTE_TARGETS.join(", ")}`
    );
  }

  // Allow AttributeTargets.return (imported local name can be aliased)
  if (
    expr.kind === "memberAccess" &&
    !expr.isComputed &&
    typeof expr.property === "string" &&
    expr.object.kind === "identifier" &&
    attributeTargetsApiNames.has(expr.object.name)
  ) {
    const value = expr.property;
    if (ATTRIBUTE_TARGETS_SET.has(value as IrAttributeTarget)) {
      return { kind: "ok", value: value as IrAttributeTarget };
    }
    return fail(
      `Invalid attribute target '${value}'. Expected one of: ${ATTRIBUTE_TARGETS.join(", ")}`
    );
  }

  return fail(
    `Invalid attribute target. Expected a string literal (e.g., "return") or ${ATTRIBUTE_TARGETS_EXPORT_NAME}.<target>`
  );
};

export const getMemberName = (expr: IrExpression): string | undefined => {
  if (expr.kind !== "memberAccess") return undefined;
  if (expr.isComputed) return undefined;
  if (typeof expr.property !== "string") return undefined;
  return expr.property;
};

export const unwrapTransparentSelectorExpression = (
  expr: IrExpression
): IrExpression => {
  let current = expr;
  while (true) {
    switch (current.kind) {
      case "typeAssertion":
      case "numericNarrowing":
      case "asinterface":
      case "trycast":
        current = current.expression;
        continue;
      default:
        return current;
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// API USAGE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

export const looksLikeAttributesApiUsage = (
  expr: IrExpression,
  apiNames: ReadonlySet<string>
): boolean => {
  switch (expr.kind) {
    case "call":
      return (
        looksLikeAttributesApiUsage(expr.callee, apiNames) ||
        expr.arguments.some(
          (arg: IrExpression | IrSpreadExpression) =>
            arg.kind !== "spread" && looksLikeAttributesApiUsage(arg, apiNames)
        )
      );
    case "memberAccess":
      return (
        looksLikeAttributesApiUsage(expr.object, apiNames) ||
        (typeof expr.property === "string" &&
          (expr.property === "on" || expr.property === "attr") &&
          isAttributesApiIdentifier(expr.object, apiNames))
      );
    case "arrowFunction":
      return (
        (expr.body.kind === "blockStatement"
          ? expr.body.statements.some(
              (s: IrStatement) =>
                s.kind === "expressionStatement" &&
                looksLikeAttributesApiUsage(s.expression, apiNames)
            )
          : looksLikeAttributesApiUsage(expr.body, apiNames)) || false
      );
    case "functionExpression":
      return expr.body.statements.some(
        (s: IrStatement) =>
          s.kind === "expressionStatement" &&
          looksLikeAttributesApiUsage(s.expression, apiNames)
      );
    case "array":
      return expr.elements.some(
        (el: IrExpression | IrSpreadExpression | undefined) =>
          el !== undefined &&
          el.kind !== "spread" &&
          looksLikeAttributesApiUsage(el, apiNames)
      );
    case "object":
      return expr.properties.some((p: IrObjectProperty) => {
        if (p.kind === "spread")
          return looksLikeAttributesApiUsage(p.expression, apiNames);
        if (typeof p.key !== "string")
          return looksLikeAttributesApiUsage(p.key, apiNames);
        return looksLikeAttributesApiUsage(p.value, apiNames);
      });
    default:
      return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN PARSING
// ═══════════════════════════════════════════════════════════════════════════

export const parseOnCall = (
  expr: IrExpression,
  module: IrModule,
  apiNames: ReadonlySet<string>
): ParseResult<{
  readonly target: IrIdentifierExpression;
  readonly sourceSpan?: SourceLocation;
}> => {
  if (expr.kind !== "call") return { kind: "notMatch" };
  const call = expr as IrCallExpression;
  if (call.callee.kind !== "memberAccess") return { kind: "notMatch" };

  const member = call.callee as IrMemberExpression;
  if (member.isComputed || typeof member.property !== "string")
    return { kind: "notMatch" };
  if (member.property !== "on") return { kind: "notMatch" };
  if (!isAttributesApiIdentifier(member.object, apiNames))
    return { kind: "notMatch" };

  if (call.arguments.length !== 1) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: A.on(...) expects exactly 1 argument`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  const arg0 = call.arguments[0];
  if (!arg0 || arg0.kind === "spread") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: A.on(...) does not accept spread arguments`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  if (arg0.kind !== "identifier") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: A.on(Target) target must be an identifier`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  return {
    kind: "ok",
    value: {
      target: arg0 as IrIdentifierExpression,
      sourceSpan: call.sourceSpan,
    },
  };
};

export const parseSelector = (
  selector: IrExpression,
  module: IrModule
): ParseResult<string> => {
  const unwrappedSelector = unwrapTransparentSelectorExpression(selector);
  if (unwrappedSelector.kind !== "arrowFunction") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: selector must be an arrow function (x => x.member)`,
        createLocation(module.filePath, selector.sourceSpan)
      ),
    };
  }

  const fn = unwrappedSelector as IrArrowFunctionExpression;
  if (fn.parameters.length !== 1) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: selector must have exactly 1 parameter`,
        createLocation(module.filePath, fn.sourceSpan)
      ),
    };
  }

  const p0 = fn.parameters[0];
  if (!p0 || p0.pattern.kind !== "identifierPattern") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: selector parameter must be an identifier`,
        createLocation(module.filePath, fn.sourceSpan)
      ),
    };
  }

  const paramName = p0.pattern.name;
  if (fn.body.kind !== "memberAccess") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: selector body must be a member access (x => x.member)`,
        createLocation(module.filePath, fn.sourceSpan)
      ),
    };
  }

  const body = fn.body as IrMemberExpression;
  if (body.isComputed || typeof body.property !== "string") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: selector must access a named member (no computed access)`,
        createLocation(module.filePath, fn.sourceSpan)
      ),
    };
  }

  const bodyObject = unwrapTransparentSelectorExpression(body.object);
  if (bodyObject.kind !== "identifier" || bodyObject.name !== paramName) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: selector must be of the form (x) => x.member`,
        createLocation(module.filePath, fn.sourceSpan)
      ),
    };
  }

  return { kind: "ok", value: body.property };
};
