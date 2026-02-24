/**
 * Attribute Collection — Argument Extraction & Descriptor Parsing
 *
 * Extracts attribute arguments from IR expressions and parses
 * attribute descriptor calls (A.attr(AttrCtor, ...args)).
 * Also contains shared constants, types, and utility functions
 * used across the attribute collection pass.
 */

import {
  Diagnostic,
  createDiagnostic,
  SourceLocation,
} from "../../../types/diagnostic.js";
import {
  IrModule,
  IrExpression,
  IrCallExpression,
  IrMemberExpression,
  IrIdentifierExpression,
  IrAttributeTarget,
  IrAttributeArg,
  IrAttributePrimitiveArg,
  IrType,
  IrArrayExpression,
  IrObjectExpression,
} from "../../types.js";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const ATTRIBUTES_IMPORT_SPECIFIER = "@tsonic/core/lang.js";
export const ATTRIBUTE_TARGETS_EXPORT_NAME = "AttributeTargets";

export const ATTRIBUTE_TARGETS: readonly IrAttributeTarget[] = [
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

export const ATTRIBUTE_TARGETS_SET = new Set<IrAttributeTarget>(
  ATTRIBUTE_TARGETS
);

// ═══════════════════════════════════════════════════════════════════════════
// SHARED TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ParseResult<T> =
  | { readonly kind: "notMatch" }
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "error"; readonly diagnostic: Diagnostic };

export type ParsedAttributeDescriptor = {
  readonly attributeType: IrType;
  readonly positionalArgs: readonly IrAttributeArg[];
  readonly namedArgs: ReadonlyMap<string, IrAttributeArg>;
  readonly sourceSpan?: SourceLocation;
};

/**
 * Intermediate representation of a detected attribute marker call
 */
export type AttributeMarker = {
  readonly targetName: string;
  readonly targetSelector: "type" | "ctor" | "method" | "prop";
  readonly selectedMemberName?: string;
  readonly attributeTarget?: IrAttributeTarget;
  readonly attributeType: IrType;
  readonly positionalArgs: readonly IrAttributeArg[];
  readonly namedArgs: ReadonlyMap<string, IrAttributeArg>;
  readonly sourceSpan?: SourceLocation;
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a source location for error reporting
 */
export const createLocation = (
  filePath: string,
  sourceSpan?: SourceLocation
): SourceLocation =>
  sourceSpan ?? { file: filePath, line: 1, column: 1, length: 1 };

export const isAttributesApiIdentifier = (
  expr: IrExpression,
  apiNames: ReadonlySet<string>
): expr is IrIdentifierExpression =>
  expr.kind === "identifier" && apiNames.has(expr.name);

export const getAttributesApiLocalNames = (
  module: IrModule
): ReadonlySet<string> => {
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

export const getAttributeTargetsApiLocalNames = (
  module: IrModule
): ReadonlySet<string> => {
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

// ═══════════════════════════════════════════════════════════════════════════
// ARGUMENT EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Try to extract an attribute argument from an IR expression.
 * Returns undefined if the expression is not a valid attribute argument.
 */
export const tryExtractAttributeArg = (
  expr: IrExpression
): IrAttributeArg | undefined => {
  const tryExtractPrimitive = (
    e: IrExpression
  ): IrAttributePrimitiveArg | undefined => {
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

// ═══════════════════════════════════════════════════════════════════════════
// CLR TYPE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

export const resolveClrTypeForAttributeCtor = (
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

export const makeAttributeType = (
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
    return {
      kind: "ok",
      value: { kind: "referenceType", name: ctorIdent.name },
    };
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

// ═══════════════════════════════════════════════════════════════════════════
// DESCRIPTOR PARSING
// ═══════════════════════════════════════════════════════════════════════════

export const parseAttrDescriptorCall = (
  expr: IrExpression,
  module: IrModule,
  apiNames: ReadonlySet<string>
): ParseResult<ParsedAttributeDescriptor> => {
  if (expr.kind !== "call") return { kind: "notMatch" };

  const call = expr as IrCallExpression;
  if (call.callee.kind !== "memberAccess") return { kind: "notMatch" };

  const member = call.callee as IrMemberExpression;
  if (member.isComputed || typeof member.property !== "string")
    return { kind: "notMatch" };
  if (member.property !== "attr") return { kind: "notMatch" };
  if (!isAttributesApiIdentifier(member.object, apiNames))
    return { kind: "notMatch" };

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
