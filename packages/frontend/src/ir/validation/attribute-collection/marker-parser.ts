/**
 * Attribute Collection — API Detection & Pattern Matching
 *
 * Detects attribute API usage patterns and parses marker call chains
 * like A.on(Target).type.add(AttrCtor, ...args).
 */

import { createDiagnostic, SourceLocation } from "../../../types/diagnostic.js";
import {
  IrModule,
  IrExpression,
  IrCallExpression,
  IrMemberExpression,
  IrIdentifierExpression,
  IrAttributeTarget,
  IrAttributeArg,
  IrArrowFunctionExpression,
  IrObjectExpression,
} from "../../types.js";
import {
  ATTRIBUTE_TARGETS,
  ATTRIBUTE_TARGETS_SET,
  ATTRIBUTE_TARGETS_EXPORT_NAME,
  type ParseResult,
  type ParsedAttributeDescriptor,
  type AttributeMarker,
  createLocation,
  isAttributesApiIdentifier,
  parseAttrDescriptorCall,
  tryExtractAttributeArg,
  makeAttributeType,
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
          (arg) =>
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
              (s) =>
                s.kind === "expressionStatement" &&
                looksLikeAttributesApiUsage(s.expression, apiNames)
            )
          : looksLikeAttributesApiUsage(expr.body, apiNames)) || false
      );
    case "functionExpression":
      return expr.body.statements.some(
        (s) =>
          s.kind === "expressionStatement" &&
          looksLikeAttributesApiUsage(s.expression, apiNames)
      );
    case "array":
      return expr.elements.some(
        (el) =>
          el !== undefined &&
          el.kind !== "spread" &&
          looksLikeAttributesApiUsage(el, apiNames)
      );
    case "object":
      return expr.properties.some((p) => {
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
  if (selector.kind !== "arrowFunction") {
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

  const fn = selector as IrArrowFunctionExpression;
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

  if (body.object.kind !== "identifier" || body.object.name !== paramName) {
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

// ═══════════════════════════════════════════════════════════════════════════
// MARKER DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Try to detect if a call expression is an attribute marker pattern.
 *
 * Patterns:
 * - A.on(Target).type.add(...)
 * - A.on(Target).ctor.add(...)
 * - A.on(Target).method(selector).add(...)
 * - A.on(Target).prop(selector).add(...)
 */
export const tryDetectAttributeMarker = (
  call: IrCallExpression,
  module: IrModule,
  apiNames: ReadonlySet<string>,
  attributeTargetsApiNames: ReadonlySet<string>,
  descriptors: ReadonlyMap<string, ParsedAttributeDescriptor>
): ParseResult<AttributeMarker> => {
  if (call.callee.kind !== "memberAccess") return { kind: "notMatch" };
  const outerMember = call.callee as IrMemberExpression;
  if (outerMember.isComputed || typeof outerMember.property !== "string") {
    return { kind: "notMatch" };
  }
  if (outerMember.property !== "add") return { kind: "notMatch" };

  // Optional `.target(...)` before `.add(...)`
  let attributeTarget: IrAttributeTarget | undefined;
  let selectorRoot: IrExpression = outerMember.object;

  if (selectorRoot.kind === "call") {
    const maybeTargetCall = selectorRoot as IrCallExpression;
    if (maybeTargetCall.callee.kind === "memberAccess") {
      const targetMember = maybeTargetCall.callee as IrMemberExpression;
      const prop = getMemberName(targetMember);
      if (prop === "target") {
        if (maybeTargetCall.arguments.length !== 1) {
          return {
            kind: "error",
            diagnostic: createDiagnostic(
              "TSN4005",
              "error",
              `Invalid attribute marker: .target(...) expects exactly 1 argument`,
              createLocation(module.filePath, maybeTargetCall.sourceSpan)
            ),
          };
        }

        const arg0 = maybeTargetCall.arguments[0];
        if (!arg0 || arg0.kind === "spread") {
          return {
            kind: "error",
            diagnostic: createDiagnostic(
              "TSN4005",
              "error",
              `Invalid attribute marker: .target(...) does not accept spread arguments`,
              createLocation(module.filePath, maybeTargetCall.sourceSpan)
            ),
          };
        }

        const parsedTarget = parseAttributeTarget(
          arg0,
          module,
          attributeTargetsApiNames
        );
        if (parsedTarget.kind !== "ok") return parsedTarget;

        attributeTarget = parsedTarget.value;
        selectorRoot = targetMember.object;
      }
    }
  }

  // Determine the target selector: `.type`, `.ctor`, `.method(selector)`, `.prop(selector)`
  let selector: AttributeMarker["targetSelector"] | undefined;
  let selectedMemberName: string | undefined;
  let onCallExpr: IrExpression | undefined;

  if (selectorRoot.kind === "memberAccess") {
    const targetMember = selectorRoot as IrMemberExpression;
    const prop = getMemberName(targetMember);
    if (prop !== "type" && prop !== "ctor") return { kind: "notMatch" };
    selector = prop;
    onCallExpr = targetMember.object;
  } else if (selectorRoot.kind === "call") {
    const selectorCall = selectorRoot as IrCallExpression;
    if (selectorCall.callee.kind !== "memberAccess")
      return { kind: "notMatch" };
    const selectorMember = selectorCall.callee as IrMemberExpression;
    const prop = getMemberName(selectorMember);
    if (prop !== "method" && prop !== "prop") return { kind: "notMatch" };
    selector = prop;

    if (selectorCall.arguments.length !== 1) {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4005",
          "error",
          `Invalid attribute marker: .${prop}(selector) expects exactly 1 argument`,
          createLocation(module.filePath, selectorCall.sourceSpan)
        ),
      };
    }

    const arg0 = selectorCall.arguments[0];
    if (!arg0 || arg0.kind === "spread") {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4005",
          "error",
          `Invalid attribute marker: selector cannot be a spread argument`,
          createLocation(module.filePath, selectorCall.sourceSpan)
        ),
      };
    }

    const sel = parseSelector(arg0, module);
    if (sel.kind !== "ok") return sel;
    selectedMemberName = sel.value;

    onCallExpr = selectorMember.object;
  } else {
    return { kind: "notMatch" };
  }

  if (!onCallExpr) return { kind: "notMatch" };

  const on = parseOnCall(onCallExpr, module, apiNames);
  if (on.kind !== "ok") return on;
  const targetName = on.value.target.name;

  // Parse `.add(...)` arguments
  if (call.arguments.length < 1) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: .add(...) requires at least one argument`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  const addArgs: IrExpression[] = [];
  for (const arg of call.arguments) {
    if (!arg || arg.kind === "spread") {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4006",
          "error",
          `Invalid attribute argument: spreads are not allowed in attributes`,
          createLocation(module.filePath, call.sourceSpan)
        ),
      };
    }
    addArgs.push(arg);
  }

  const first = addArgs[0];
  if (!first) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: .add(...) first argument is missing`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  // .add(A.attr(...)) inline descriptor
  if (addArgs.length === 1) {
    const descCall = parseAttrDescriptorCall(first, module, apiNames);
    if (descCall.kind === "ok") {
      return {
        kind: "ok",
        value: {
          targetName,
          targetSelector: selector,
          selectedMemberName,
          attributeTarget,
          attributeType: descCall.value.attributeType,
          positionalArgs: descCall.value.positionalArgs,
          namedArgs: descCall.value.namedArgs,
          sourceSpan: call.sourceSpan,
        },
      };
    }

    // .add(descriptorVar)
    if (first.kind === "identifier") {
      const desc = descriptors.get((first as IrIdentifierExpression).name);
      if (desc) {
        return {
          kind: "ok",
          value: {
            targetName,
            targetSelector: selector,
            selectedMemberName,
            attributeTarget,
            attributeType: desc.attributeType,
            positionalArgs: desc.positionalArgs,
            namedArgs: desc.namedArgs,
            sourceSpan: call.sourceSpan,
          },
        };
      }
    }
  }

  // .add(AttrCtor, ...args)
  if (first.kind !== "identifier") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: .add(AttrCtor, ...args) requires attribute constructor to be an identifier`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  const attributeTypeResult = makeAttributeType(
    first as IrIdentifierExpression,
    module
  );
  if (attributeTypeResult.kind !== "ok") {
    return attributeTypeResult;
  }
  const positionalArgs: IrAttributeArg[] = [];
  const namedArgs = new Map<string, IrAttributeArg>();
  let sawNamed = false;

  for (const arg of addArgs.slice(1)) {
    if (arg.kind === "object") {
      sawNamed = true;
      const obj = arg as IrObjectExpression;
      for (const prop of obj.properties) {
        if (prop.kind === "spread") {
          return {
            kind: "error",
            diagnostic: createDiagnostic(
              "TSN4006",
              "error",
              `Invalid attribute argument: spreads are not allowed in named arguments`,
              createLocation(module.filePath, obj.sourceSpan)
            ),
          };
        }
        if (prop.kind !== "property" || typeof prop.key !== "string") {
          return {
            kind: "error",
            diagnostic: createDiagnostic(
              "TSN4006",
              "error",
              `Invalid attribute argument: named arguments must be simple { Name: value } properties`,
              createLocation(module.filePath, obj.sourceSpan)
            ),
          };
        }
        const v = tryExtractAttributeArg(prop.value);
        if (!v) {
          return {
            kind: "error",
            diagnostic: createDiagnostic(
              "TSN4006",
              "error",
              `Invalid attribute argument: named argument '${prop.key}' must be a compile-time constant`,
              createLocation(module.filePath, prop.value.sourceSpan)
            ),
          };
        }
        namedArgs.set(prop.key, v);
      }
      continue;
    }

    if (sawNamed) {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4006",
          "error",
          `Invalid attribute argument: positional arguments cannot appear after named arguments`,
          createLocation(module.filePath, arg.sourceSpan)
        ),
      };
    }

    const v = tryExtractAttributeArg(arg);
    if (!v) {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4006",
          "error",
          `Invalid attribute argument: attribute arguments must be compile-time constants (string/number/boolean/typeof/enum/array)`,
          createLocation(module.filePath, arg.sourceSpan)
        ),
      };
    }
    positionalArgs.push(v);
  }

  return {
    kind: "ok",
    value: {
      targetName,
      targetSelector: selector,
      selectedMemberName,
      attributeTarget,
      attributeType: attributeTypeResult.value,
      positionalArgs,
      namedArgs,
      sourceSpan: call.sourceSpan,
    },
  };
};
