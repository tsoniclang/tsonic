/**
 * Attribute Collection — Marker Chain Parser
 *
 * Contains tryDetectAttributeMarker which parses the full marker call chain
 * pattern: A<T>().add(...), A<T>().ctor.add(...), A<T>().method(selector).add(...),
 * A<T>().prop(selector).add(...), and A(fn).add(...)
 */

import { createDiagnostic } from "../../../types/diagnostic.js";
import {
  IrModule,
  IrExpression,
  IrCallExpression,
  IrIdentifierExpression,
  IrMemberExpression,
  IrAttributeTarget,
  IrAttributeArg,
  IrObjectExpression,
} from "../../types.js";
import {
  type ParseResult,
  type ParsedAttributeDescriptor,
  type AttributeMarker,
  createLocation,
  parseAttrDescriptorCall,
  tryExtractAttributeArg,
  makeAttributeType,
} from "./arg-extractor.js";
import {
  parseAttributeTarget,
  getMemberName,
  parseRootCall,
  parseSelector,
} from "./marker-detection.js";

// ═══════════════════════════════════════════════════════════════════════════
// MARKER DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Try to detect if a call expression is an attribute marker pattern.
 *
 * Patterns:
 * - A<T>().add(...)
 * - A<T>().ctor.add(...)
 * - A<T>().method(selector).add(...)
 * - A<T>().prop(selector).add(...)
 * - A(fn).add(...)
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

  // Determine the target selector: root `.add(...)`, `.ctor.add(...)`,
  // `.method(selector).add(...)`, `.prop(selector).add(...)`
  let selector: AttributeMarker["targetSelector"] | undefined;
  let selectedMemberName: string | undefined;
  let rootCallExpr: IrExpression | undefined;

  if (selectorRoot.kind === "memberAccess") {
    const targetMember = selectorRoot as IrMemberExpression;
    const prop = getMemberName(targetMember);
    if (prop !== "ctor") return { kind: "notMatch" };
    selector = prop;
    rootCallExpr = targetMember.object;
  } else if (selectorRoot.kind === "call") {
    const selectorCall = selectorRoot as IrCallExpression;
    if (selectorCall.callee.kind !== "memberAccess") {
      selector = "root";
      rootCallExpr = selectorRoot;
    } else {
    const selectorMember = selectorCall.callee as IrMemberExpression;
    const prop = getMemberName(selectorMember);
      if (prop !== "method" && prop !== "prop") {
        selector = "root";
        rootCallExpr = selectorRoot;
      } else {
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

        rootCallExpr = selectorMember.object;
      }
    }
  } else {
    return { kind: "notMatch" };
  }

  if (!rootCallExpr) return { kind: "notMatch" };

  const root = parseRootCall(rootCallExpr, module, apiNames);
  if (root.kind !== "ok") return root;

  if (
    selector === "root" &&
    attributeTarget !== undefined &&
    attributeTarget !== "type"
  ) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: declaration attributes only support .target("type").`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

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
          target: root.value,
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
      const desc = descriptors.get(first.name);
      if (desc) {
        return {
          kind: "ok",
          value: {
            target: root.value,
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
      target: root.value,
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
