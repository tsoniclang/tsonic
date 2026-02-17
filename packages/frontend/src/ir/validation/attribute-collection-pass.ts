/**
 * Attribute Collection Pass
 *
 * This pass detects compiler-only marker calls and transforms them into IR attributes
 * attached to the corresponding declarations, removing the marker statements.
 *
 * Supported patterns:
 * - A.on(Class).type.add(AttrCtor, ...args)           - Type attribute
 * - A.on(Class).ctor.add(AttrCtor, ...args)           - Constructor attribute
 * - A.on(Class).method(x => x.method).add(AttrCtor)   - Method attribute
 * - A.on(Class).prop(x => x.prop).add(AttrCtor)       - Property attribute
 * - add(A.attr(AttrCtor, ...args))                    - Descriptor form
 * - add(descriptor) where `const descriptor = A.attr(...)`
 *
 * Backward compatibility:
 * - A.on(fn).type.add(AttrCtor, ...args) attaches to a function declaration
 *
 * Notes:
 * - This API is compiler-only. All recognized marker statements are removed.
 * - Invalid marker calls are errors (no silent drops).
 */

import {
  Diagnostic,
  createDiagnostic,
  SourceLocation,
} from "../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrExpression,
  IrCallExpression,
  IrMemberExpression,
  IrIdentifierExpression,
  IrClassDeclaration,
  IrFunctionDeclaration,
  IrAttribute,
  IrAttributeTarget,
  IrAttributeArg,
  IrAttributePrimitiveArg,
  IrType,
  IrVariableDeclaration,
  IrArrowFunctionExpression,
  IrArrayExpression,
  IrObjectExpression,
} from "../types.js";

const ATTRIBUTES_IMPORT_SPECIFIER = "@tsonic/core/lang.js";
const ATTRIBUTE_TARGETS_EXPORT_NAME = "AttributeTargets";

const ATTRIBUTE_TARGETS: readonly IrAttributeTarget[] = [
  "assembly",
  "module",
  "type",
  "method",
  "property",
  "field",
  "event",
  "param",
  "return",
];

const ATTRIBUTE_TARGETS_SET = new Set<IrAttributeTarget>(ATTRIBUTE_TARGETS);

/**
 * Result of attribute collection pass
 */
export type AttributeCollectionResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Intermediate representation of a detected attribute marker call
 */
type AttributeMarker = {
  readonly targetName: string;
  readonly targetSelector: "type" | "ctor" | "method" | "prop";
  readonly selectedMemberName?: string;
  readonly attributeTarget?: IrAttributeTarget;
  readonly attributeType: IrType;
  readonly positionalArgs: readonly IrAttributeArg[];
  readonly namedArgs: ReadonlyMap<string, IrAttributeArg>;
  readonly sourceSpan?: SourceLocation;
};

/**
 * Try to extract an attribute argument from an IR expression.
 * Returns undefined if the expression is not a valid attribute argument.
 */
const tryExtractAttributeArg = (
  expr: IrExpression
): IrAttributeArg | undefined => {
  const tryExtractPrimitive = (e: IrExpression): IrAttributePrimitiveArg | undefined => {
    const extracted = tryExtractAttributeArg(e);
    if (!extracted) return undefined;
    if (extracted.kind === "array") return undefined;
    return extracted;
  };

  if (expr.kind === "literal") {
    if (typeof expr.value === "string") {
      return { kind: "string", value: expr.value };
    }
    if (typeof expr.value === "number") {
      return { kind: "number", value: expr.value };
    }
    if (typeof expr.value === "boolean") {
      return { kind: "boolean", value: expr.value };
    }
  }

  // Arrays of compile-time constants are valid attribute arguments in C#.
  // Example: [Index(new[] { "PropertyId", "Ts" })]
  if (expr.kind === "array") {
    const arr = expr as IrArrayExpression;
    const elements: IrAttributePrimitiveArg[] = [];
    if (arr.elements.length === 0) return undefined;
    for (const el of arr.elements) {
      if (!el || el.kind === "spread") {
        return undefined;
      }
      const v = tryExtractPrimitive(el);
      if (!v) return undefined;
      elements.push(v);
    }
    return { kind: "array", elements };
  }

  // typeof(SomeType) → C# typeof(SomeType) attribute argument
  if (expr.kind === "unary" && expr.operator === "typeof") {
    const targetType = expr.expression.inferredType;
    if (targetType && targetType.kind !== "unknownType") {
      return { kind: "typeof", type: targetType };
    }
  }

  // Enum.Member → enum literal argument
  if (
    expr.kind === "memberAccess" &&
    !expr.isComputed &&
    typeof expr.property === "string"
  ) {
    const object = expr.object;
    const enumType =
      expr.inferredType && expr.inferredType.kind === "referenceType"
        ? expr.inferredType
        : object.kind === "identifier" &&
            object.inferredType &&
            object.inferredType.kind === "referenceType"
          ? object.inferredType
          : undefined;

    if (enumType) {
      const binding = (expr as IrMemberExpression).memberBinding;
      const member = binding?.member ?? expr.property;
      return { kind: "enum", type: enumType, member };
    }
  }

  return undefined;
};

type ParseResult<T> =
  | { readonly kind: "notMatch" }
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "error"; readonly diagnostic: Diagnostic };

const getAttributesApiLocalNames = (module: IrModule): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const imp of module.imports) {
    if (imp.source !== ATTRIBUTES_IMPORT_SPECIFIER) continue;
    for (const spec of imp.specifiers) {
      if (spec.kind !== "named") continue;
      if (spec.name !== "attributes") continue;
      names.add(spec.localName);
    }
  }
  return names;
};

const getAttributeTargetsApiLocalNames = (module: IrModule): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const imp of module.imports) {
    if (imp.source !== ATTRIBUTES_IMPORT_SPECIFIER) continue;
    for (const spec of imp.specifiers) {
      if (spec.kind !== "named") continue;
      if (spec.name !== ATTRIBUTE_TARGETS_EXPORT_NAME) continue;
      names.add(spec.localName);
    }
  }
  return names;
};

const isAttributesApiIdentifier = (
  expr: IrExpression,
  apiNames: ReadonlySet<string>
): expr is IrIdentifierExpression => expr.kind === "identifier" && apiNames.has(expr.name);

const parseAttributeTarget = (
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

const getMemberName = (expr: IrExpression): string | undefined => {
  if (expr.kind !== "memberAccess") return undefined;
  if (expr.isComputed) return undefined;
  if (typeof expr.property !== "string") return undefined;
  return expr.property;
};

const looksLikeAttributesApiUsage = (
  expr: IrExpression,
  apiNames: ReadonlySet<string>
): boolean => {
  switch (expr.kind) {
    case "call":
      return (
        looksLikeAttributesApiUsage(expr.callee, apiNames) ||
        expr.arguments.some((arg) => arg.kind !== "spread" && looksLikeAttributesApiUsage(arg, apiNames))
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
          ? expr.body.statements.some((s) =>
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
        (el) => el !== undefined && el.kind !== "spread" && looksLikeAttributesApiUsage(el, apiNames)
      );
    case "object":
      return expr.properties.some((p) => {
        if (p.kind === "spread") return looksLikeAttributesApiUsage(p.expression, apiNames);
        if (typeof p.key !== "string") return looksLikeAttributesApiUsage(p.key, apiNames);
        return looksLikeAttributesApiUsage(p.value, apiNames);
      });
    default:
      return false;
  }
};

const parseOnCall = (
  expr: IrExpression,
  module: IrModule,
  apiNames: ReadonlySet<string>
): ParseResult<{ readonly target: IrIdentifierExpression; readonly sourceSpan?: SourceLocation }> => {
  if (expr.kind !== "call") return { kind: "notMatch" };
  const call = expr as IrCallExpression;
  if (call.callee.kind !== "memberAccess") return { kind: "notMatch" };

  const member = call.callee as IrMemberExpression;
  if (member.isComputed || typeof member.property !== "string") return { kind: "notMatch" };
  if (member.property !== "on") return { kind: "notMatch" };
  if (!isAttributesApiIdentifier(member.object, apiNames)) return { kind: "notMatch" };

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
    value: { target: arg0 as IrIdentifierExpression, sourceSpan: call.sourceSpan },
  };
};

const parseSelector = (
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

type ParsedAttributeDescriptor = {
  readonly attributeType: IrType;
  readonly positionalArgs: readonly IrAttributeArg[];
  readonly namedArgs: ReadonlyMap<string, IrAttributeArg>;
  readonly sourceSpan?: SourceLocation;
};

const resolveClrTypeForAttributeCtor = (
  ctorIdent: IrIdentifierExpression,
  module: IrModule
): string | undefined => {
  if (ctorIdent.resolvedClrType) return ctorIdent.resolvedClrType;

  // Prefer CLR imports: these are the authoritative mapping for runtime type names.
  for (const imp of module.imports) {
    if (!imp.isClr) continue;
    if (!imp.resolvedNamespace) continue;
    for (const spec of imp.specifiers) {
      if (spec.kind !== "named") continue;
      if (spec.localName !== ctorIdent.name) continue;
      return `${imp.resolvedNamespace}.${spec.name}`;
    }
  }

  return undefined;
};

const makeAttributeType = (
  ctorIdent: IrIdentifierExpression,
  module: IrModule
): ParseResult<IrType> => {
  const resolvedClrType = resolveClrTypeForAttributeCtor(ctorIdent, module);
  if (resolvedClrType) {
    return {
      kind: "ok",
      value: {
        kind: "referenceType",
        name: ctorIdent.name,
        resolvedClrType,
      },
    };
  }

  // Allow locally-emitted attribute types (non-ambient class declarations).
  const hasLocalClass = module.body.some(
    (s) => s.kind === "classDeclaration" && s.name === ctorIdent.name
  );
  if (hasLocalClass) {
    return { kind: "ok", value: { kind: "referenceType", name: ctorIdent.name } };
  }

  return {
    kind: "error",
    diagnostic: createDiagnostic(
      "TSN4004",
      "error",
      `Missing CLR binding for attribute constructor '${ctorIdent.name}'. Import the attribute type from a CLR bindings module (e.g., @tsonic/dotnet) or define it as a local class.`,
      createLocation(module.filePath, ctorIdent.sourceSpan)
    ),
  };
};

const parseAttrDescriptorCall = (
  expr: IrExpression,
  module: IrModule,
  apiNames: ReadonlySet<string>
): ParseResult<ParsedAttributeDescriptor> => {
  if (expr.kind !== "call") return { kind: "notMatch" };

  const call = expr as IrCallExpression;
  if (call.callee.kind !== "memberAccess") return { kind: "notMatch" };

  const member = call.callee as IrMemberExpression;
  if (member.isComputed || typeof member.property !== "string") return { kind: "notMatch" };
  if (member.property !== "attr") return { kind: "notMatch" };
  if (!isAttributesApiIdentifier(member.object, apiNames)) return { kind: "notMatch" };

  if (call.arguments.length < 1) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: A.attr(AttrCtor, ...args) requires at least the attribute constructor`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  const rawArgs: IrExpression[] = [];
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
    rawArgs.push(arg);
  }

  const ctorExpr = rawArgs[0];
  if (!ctorExpr || ctorExpr.kind !== "identifier") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid attribute marker: A.attr(...) attribute constructor must be an identifier`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  const attributeCtor = ctorExpr as IrIdentifierExpression;
  const attributeTypeResult = makeAttributeType(attributeCtor, module);
  if (attributeTypeResult.kind !== "ok") {
    return attributeTypeResult;
  }
  const positionalArgs: IrAttributeArg[] = [];
  const namedArgs = new Map<string, IrAttributeArg>();
  let sawNamed = false;

  for (const arg of rawArgs.slice(1)) {
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
      attributeType: attributeTypeResult.value,
      positionalArgs,
      namedArgs,
      sourceSpan: call.sourceSpan,
    },
  };
};

/**
 * Try to detect if a call expression is an attribute marker pattern.
 *
 * Patterns:
 * - A.on(Target).type.add(...)
 * - A.on(Target).ctor.add(...)
 * - A.on(Target).method(selector).add(...)
 * - A.on(Target).prop(selector).add(...)
 */
const tryDetectAttributeMarker = (
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
    if (selectorCall.callee.kind !== "memberAccess") return { kind: "notMatch" };
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

  const attributeTypeResult = makeAttributeType(first as IrIdentifierExpression, module);
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

/**
 * Create a source location for error reporting
 */
const createLocation = (
  filePath: string,
  sourceSpan?: SourceLocation
): SourceLocation =>
  sourceSpan ?? { file: filePath, line: 1, column: 1, length: 1 };

/**
 * Process a single module: detect attribute markers and attach to declarations
 */
const processModule = (
  module: IrModule,
  diagnostics: Diagnostic[]
): IrModule => {
  const apiNames = getAttributesApiLocalNames(module);
  const attributeTargetsApiNames = getAttributeTargetsApiLocalNames(module);
  if (apiNames.size === 0) {
    return module;
  }

  // Collect detected attribute descriptors declared as variables:
  //   const d = A.attr(AttrCtor, ...args)
  const descriptors = new Map<string, ParsedAttributeDescriptor>();
  const removedStatementIndices: Set<number> = new Set();

  module.body.forEach((stmt, i) => {
    if (stmt.kind !== "variableDeclaration") return;
    const decl = stmt as IrVariableDeclaration;

    // Only handle simple, single declarator `const name = A.attr(...)`.
    if (decl.declarationKind !== "const") return;
    if (decl.declarations.length !== 1) return;

    const d0 = decl.declarations[0];
    if (!d0) return;
    if (d0.name.kind !== "identifierPattern") return;
    if (!d0.initializer) return;

    const parsed = parseAttrDescriptorCall(d0.initializer, module, apiNames);
    if (parsed.kind === "notMatch") return;
    if (parsed.kind === "error") {
      diagnostics.push(parsed.diagnostic);
      removedStatementIndices.add(i);
      return;
    }

    descriptors.set(d0.name.name, parsed.value);
    removedStatementIndices.add(i);
  });

  // Collect detected attribute markers
  const markers: AttributeMarker[] = [];

  // Walk statements looking for attribute markers
  module.body.forEach((stmt, i) => {
    if (removedStatementIndices.has(i)) return;
    if (stmt.kind !== "expressionStatement") return;

    const expr = stmt.expression;
    if (expr.kind !== "call") return;

    const marker = tryDetectAttributeMarker(
      expr as IrCallExpression,
      module,
      apiNames,
      attributeTargetsApiNames,
      descriptors
    );
    if (marker.kind === "ok") {
      markers.push(marker.value);
      removedStatementIndices.add(i);
      return;
    }
    if (marker.kind === "error") {
      diagnostics.push(marker.diagnostic);
      removedStatementIndices.add(i);
      return;
    }

    // If it looks like an attribute API call but doesn't match a supported marker,
    // fail deterministically instead of leaving runtime-dead code in the output.
    if (looksLikeAttributesApiUsage(expr, apiNames)) {
      diagnostics.push(
        createDiagnostic(
          "TSN4005",
          "error",
          `Invalid attribute marker call. Expected one of: A.on(X).type.add(...), A.on(X).ctor.add(...), A.on(X).method(x => x.m).add(...), A.on(X).prop(x => x.p).add(...), with optional .target(...) before .add(...)`,
          createLocation(module.filePath, expr.sourceSpan)
        )
      );
      removedStatementIndices.add(i);
    }
  });

  // If nothing to do, return module unchanged
  if (markers.length === 0 && removedStatementIndices.size === 0) {
    return module;
  }

  // Build map of declaration names to their indices
  const classDeclarations = new Map<string, number>();
  const functionDeclarations = new Map<string, number>();

  module.body.forEach((stmt, i) => {
    if (stmt.kind === "classDeclaration") {
      classDeclarations.set(stmt.name, i);
    } else if (stmt.kind === "functionDeclaration") {
      functionDeclarations.set(stmt.name, i);
    }
  });

  // Build map of attributes per declaration
  const classAttributes = new Map<number, IrAttribute[]>();
  const classCtorAttributes = new Map<number, IrAttribute[]>();
  const classMethodAttributes = new Map<number, Map<string, IrAttribute[]>>();
  const classPropAttributes = new Map<number, Map<string, IrAttribute[]>>();
  const functionAttributes = new Map<number, IrAttribute[]>();

  for (const marker of markers) {
    const classIndex = classDeclarations.get(marker.targetName);
    const funcIndex = functionDeclarations.get(marker.targetName);

    const attr: IrAttribute = {
      kind: "attribute",
      target: marker.attributeTarget,
      attributeType: marker.attributeType,
      positionalArgs: marker.positionalArgs,
      namedArgs: marker.namedArgs,
    };

    if (marker.targetSelector === "type") {
      if (classIndex !== undefined && funcIndex !== undefined) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Attribute target '${marker.targetName}' is ambiguous (matches both class and function)`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }

      if (classIndex !== undefined) {
        if (
          marker.attributeTarget !== undefined &&
          marker.attributeTarget !== "type"
        ) {
          diagnostics.push(
            createDiagnostic(
              "TSN4005",
              "error",
              `Invalid attribute target '${marker.attributeTarget}' for type attribute. Expected 'type' or omit .target(...)`,
              createLocation(module.filePath, marker.sourceSpan)
            )
          );
          continue;
        }
        const attrs = classAttributes.get(classIndex) ?? [];
        attrs.push(attr);
        classAttributes.set(classIndex, attrs);
        continue;
      }

      if (funcIndex !== undefined) {
        if (marker.attributeTarget !== undefined) {
          diagnostics.push(
            createDiagnostic(
              "TSN4005",
              "error",
              `.target(...) is not supported for function attributes via A.on(fn).type. Use A.on(Class).method(...) instead.`,
              createLocation(module.filePath, marker.sourceSpan)
            )
          );
          continue;
        }
        const attrs = functionAttributes.get(funcIndex) ?? [];
        attrs.push(attr);
        functionAttributes.set(funcIndex, attrs);
        continue;
      }

      diagnostics.push(
        createDiagnostic(
          "TSN4007",
          "error",
          `Attribute target '${marker.targetName}' not found in module`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
      continue;
    }

    if (classIndex === undefined) {
      diagnostics.push(
        createDiagnostic(
          "TSN4007",
          "error",
          `Attribute target '${marker.targetName}' not found in module`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
      continue;
    }

    const classStmt = module.body[classIndex] as IrClassDeclaration;

    if (marker.targetSelector === "ctor") {
      if (
        marker.attributeTarget !== undefined &&
        marker.attributeTarget !== "method"
      ) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Invalid attribute target '${marker.attributeTarget}' for constructor attribute. Expected 'method' or omit .target(...)`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const hasCtor = classStmt.members.some(
        (m) => m.kind === "constructorDeclaration"
      );
      if (classStmt.isStruct && !hasCtor) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Cannot apply constructor attributes to struct '${classStmt.name}' without an explicit constructor`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const attrs = classCtorAttributes.get(classIndex) ?? [];
      attrs.push(attr);
      classCtorAttributes.set(classIndex, attrs);
      continue;
    }

    if (marker.targetSelector === "method") {
      if (
        marker.attributeTarget !== undefined &&
        marker.attributeTarget !== "method" &&
        marker.attributeTarget !== "return"
      ) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Invalid attribute target '${marker.attributeTarget}' for method attribute. Expected 'method', 'return', or omit .target(...)`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const memberName = marker.selectedMemberName;
      if (!memberName) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Invalid attribute marker: method target missing member name`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const hasMember = classStmt.members.some(
        (m) => m.kind === "methodDeclaration" && m.name === memberName
      );
      if (!hasMember) {
        diagnostics.push(
          createDiagnostic(
            "TSN4007",
            "error",
            `Method '${classStmt.name}.${memberName}' not found for attribute target`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const perClass = classMethodAttributes.get(classIndex) ?? new Map();
      const attrs = perClass.get(memberName) ?? [];
      attrs.push(attr);
      perClass.set(memberName, attrs);
      classMethodAttributes.set(classIndex, perClass);
      continue;
    }

    if (marker.targetSelector === "prop") {
      const memberName = marker.selectedMemberName;
      if (!memberName) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Invalid attribute marker: property target missing member name`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const member = classStmt.members.find(
        (m) => m.kind === "propertyDeclaration" && m.name === memberName
      );
      if (!member || member.kind !== "propertyDeclaration") {
        diagnostics.push(
          createDiagnostic(
            "TSN4007",
            "error",
            `Property '${classStmt.name}.${memberName}' not found for attribute target`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }

      if (marker.attributeTarget !== undefined) {
        if (member.emitAsField) {
          if (marker.attributeTarget !== "field") {
            diagnostics.push(
              createDiagnostic(
                "TSN4005",
                "error",
                `Invalid attribute target '${marker.attributeTarget}' for field-emitted property '${classStmt.name}.${memberName}'. Expected 'field' or omit .target(...)`,
                createLocation(module.filePath, marker.sourceSpan)
              )
            );
            continue;
          }
        } else if (
          marker.attributeTarget !== "property" &&
          marker.attributeTarget !== "field"
        ) {
          diagnostics.push(
            createDiagnostic(
              "TSN4005",
              "error",
              `Invalid attribute target '${marker.attributeTarget}' for property attribute. Expected 'property', 'field', or omit .target(...)`,
              createLocation(module.filePath, marker.sourceSpan)
            )
          );
          continue;
        }

        if (marker.attributeTarget === "field") {
          const isAccessorProperty =
            member.getterBody !== undefined || member.setterBody !== undefined;
          if (isAccessorProperty) {
            diagnostics.push(
              createDiagnostic(
                "TSN4005",
                "error",
                `Cannot apply [field: ...] attribute target to accessor property '${classStmt.name}.${memberName}'. Apply the attribute to the actual field instead.`,
                createLocation(module.filePath, marker.sourceSpan)
              )
            );
            continue;
          }
        }
      }

      const perClass = classPropAttributes.get(classIndex) ?? new Map();
      const attrs = perClass.get(memberName) ?? [];
      attrs.push(attr);
      perClass.set(memberName, attrs);
      classPropAttributes.set(classIndex, perClass);
    }
  }

  // Rebuild module body:
  // 1. Filter out marker statements
  // 2. Update declarations with attached attributes
  const newBody: IrStatement[] = [];

  module.body.forEach((stmt, i) => {
    // Skip marker statements
    if (removedStatementIndices.has(i)) return;

    if (stmt.kind === "classDeclaration") {
      // Update class with attributes
      const classStmt = stmt as IrClassDeclaration;
      const existingAttrs = classStmt.attributes ?? [];
      const typeAttrs = classAttributes.get(i) ?? [];
      const ctorAttrs = classCtorAttributes.get(i) ?? [];
      const methodAttrs = classMethodAttributes.get(i);
      const propAttrs = classPropAttributes.get(i);

      const updatedMembers =
        methodAttrs || propAttrs
          ? classStmt.members.map((m) => {
              if (m.kind === "methodDeclaration" && methodAttrs) {
                const extras = methodAttrs.get(m.name);
                if (extras && extras.length > 0) {
                  return {
                    ...m,
                    attributes: [...(m.attributes ?? []), ...extras],
                  };
                }
              }
              if (m.kind === "propertyDeclaration" && propAttrs) {
                const extras = propAttrs.get(m.name);
                if (extras && extras.length > 0) {
                  return {
                    ...m,
                    attributes: [...(m.attributes ?? []), ...extras],
                  };
                }
              }
              return m;
            })
          : classStmt.members;

      const updated: IrClassDeclaration = {
        ...classStmt,
        members: updatedMembers,
        attributes:
          typeAttrs.length > 0
            ? [...existingAttrs, ...typeAttrs]
            : classStmt.attributes,
        ctorAttributes:
          ctorAttrs.length > 0
            ? [...(classStmt.ctorAttributes ?? []), ...ctorAttrs]
            : classStmt.ctorAttributes,
      };

      // Avoid allocating new nodes when there are no changes.
      if (
        typeAttrs.length === 0 &&
        ctorAttrs.length === 0 &&
        !methodAttrs &&
        !propAttrs
      ) {
        newBody.push(classStmt);
      } else {
        newBody.push(updated);
      }
      return;
    }

    if (stmt.kind === "functionDeclaration" && functionAttributes.has(i)) {
      // Update function with attributes
      const funcStmt = stmt as IrFunctionDeclaration;
      const existingAttrs = funcStmt.attributes ?? [];
      const newAttrs = functionAttributes.get(i) ?? [];
      newBody.push({
        ...funcStmt,
        attributes: [...existingAttrs, ...newAttrs],
      });
      return;
    }

    // Keep statement unchanged
    newBody.push(stmt);
  });

  return {
    ...module,
    body: newBody,
  };
};

/**
 * Run the attribute collection pass on a set of modules.
 *
 * This pass:
 * 1. Detects attribute marker calls (A.on(X).type.add(Y))
 * 2. Attaches IrAttribute nodes to the corresponding declarations
 * 3. Removes the marker statements from the module body
 * 4. Emits diagnostics for invalid patterns
 */
export const runAttributeCollectionPass = (
  modules: readonly IrModule[]
): AttributeCollectionResult => {
  const diagnostics: Diagnostic[] = [];
  const processedModules: IrModule[] = [];

  for (const module of modules) {
    const processed = processModule(module, diagnostics);
    processedModules.push(processed);
  }

  const hasErrors = diagnostics.some((d) => d.severity === "error");

  return {
    ok: !hasErrors,
    modules: processedModules,
    diagnostics,
  };
};
