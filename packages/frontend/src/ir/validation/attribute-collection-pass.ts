/**
 * Attribute Collection Pass
 *
 * This pass detects marker calls like `A.on(Class).type.add(Attr)` and transforms
 * them into attributes attached to the corresponding IR declarations.
 *
 * Supported patterns:
 * - A.on(Class).type.add(Attr) - Type-level attribute on class
 * - A.on(Class).type.add(Attr, arg1, arg2) - With positional arguments
 * - A.on(fn).type.add(Attr) - Function-level attribute
 *
 * Future patterns (not yet implemented):
 * - A.on(Class).prop(x => x.field).add(Attr) - Property attribute
 * - A.on(Class).method(x => x.fn).add(Attr) - Method attribute
 * - A.on(Class).type.add(Attr, { Name: "x" }) - Named arguments
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
  IrAttributeArg,
  IrType,
} from "../types.js";

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
  readonly targetKind: "class" | "function";
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
    if (
      object.kind === "identifier" &&
      object.inferredType &&
      object.inferredType.kind === "referenceType"
    ) {
      return { kind: "enum", type: object.inferredType, member: expr.property };
    }
  }

  return undefined;
};

/**
 * Try to detect if a call expression is an attribute marker pattern.
 *
 * Pattern: A.on(Target).type.add(Attr, ...args)
 * Structure:
 * - CallExpression (outer) - the .add(Attr, ...) call
 *   - callee: MemberAccess with property "add"
 *     - object: MemberAccess with property "type"
 *       - object: CallExpression - the A.on(Target) call
 *         - callee: MemberAccess with property "on"
 *           - object: Identifier "A" or "attributes"
 *         - arguments: [Target identifier]
 *   - arguments: [Attr type, ...positional args]
 */
const tryDetectAttributeMarker = (
  call: IrCallExpression,
  module: IrModule
): AttributeMarker | undefined => {
  // Check outer call: must be a member access call like .add(...)
  if (call.callee.kind !== "memberAccess") return undefined;

  const outerMember = call.callee as IrMemberExpression;

  // Check that property is "add" (string, not computed)
  if (outerMember.isComputed || typeof outerMember.property !== "string") {
    return undefined;
  }

  if (outerMember.property !== "add") return undefined;

  // Check that object is .type member access
  if (outerMember.object.kind !== "memberAccess") return undefined;

  const typeMember = outerMember.object as IrMemberExpression;

  if (typeMember.isComputed || typeof typeMember.property !== "string") {
    return undefined;
  }

  if (typeMember.property !== "type") return undefined;

  // Check that object of .type is A.on(Target) call
  if (typeMember.object.kind !== "call") return undefined;

  const onCall = typeMember.object as IrCallExpression;

  // Check that onCall.callee is A.on or attributes.on
  if (onCall.callee.kind !== "memberAccess") return undefined;

  const onMember = onCall.callee as IrMemberExpression;

  if (onMember.isComputed || typeof onMember.property !== "string") {
    return undefined;
  }

  if (onMember.property !== "on") return undefined;

  // Check that the object of .on is "A" or "attributes"
  if (onMember.object.kind !== "identifier") return undefined;

  const apiObject = onMember.object as IrIdentifierExpression;
  if (apiObject.name !== "A" && apiObject.name !== "attributes")
    return undefined;

  // Extract target from A.on(Target)
  if (onCall.arguments.length !== 1) return undefined;

  const targetArg = onCall.arguments[0];
  if (!targetArg || targetArg.kind === "spread") return undefined;

  // Target must be an identifier
  if (targetArg.kind !== "identifier") return undefined;

  const targetName = (targetArg as IrIdentifierExpression).name;

  // Extract attribute type from .add(Attr, ...) arguments
  if (call.arguments.length < 1) return undefined;

  const attrTypeArg = call.arguments[0];
  if (!attrTypeArg || attrTypeArg.kind === "spread") return undefined;

  // Attribute type should be an identifier referencing the attribute class
  if (attrTypeArg.kind !== "identifier") {
    // Not a simple identifier - could be a member access like System.SerializableAttribute
    // For now, we don't support this
    return undefined;
  }

  const attrIdent = attrTypeArg as IrIdentifierExpression;
  const resolveClrFromImports = (): string | undefined => {
    // If the attribute type is imported from a CLR bindings module, reconstruct the CLR FQN
    // from the module import table. Identifier expressions do not always carry resolvedClrType.
    for (const imp of module.imports) {
      if (!imp.isClr) continue;
      if (!imp.resolvedNamespace) continue;
      for (const spec of imp.specifiers) {
        if (spec.kind !== "named") continue;
        if (spec.localName !== attrIdent.name) continue;
        return `${imp.resolvedNamespace}.${spec.name}`;
      }
    }
    return undefined;
  };

  // Prefer resolvedClrType if present (bindings/globals). Otherwise resolve via CLR imports.
  // Final fallback is the identifier name (ambient declarations where name is already a CLR type).
  const clrType =
    attrIdent.resolvedClrType ?? resolveClrFromImports() ?? attrIdent.name;
  const attributeType: IrType = {
    kind: "referenceType",
    name: attrIdent.name,
    resolvedClrType: clrType,
  };

  // Extract positional arguments (skip the first which is the attribute type)
  const positionalArgs: readonly IrAttributeArg[] = call.arguments
    .slice(1)
    .filter((arg): arg is IrExpression => {
      if (!arg || arg.kind === "spread") return false;
      // Skip object literals (named arguments) for now
      if (arg.kind === "object") return false;
      return true;
    })
    .map((arg) => tryExtractAttributeArg(arg))
    .filter((arg): arg is IrAttributeArg => arg !== undefined);

  // Determine target kind - we'll resolve this against the module later
  // For now, assume it could be either class or function
  return {
    targetName,
    targetKind: "class", // Will be refined during attachment
    attributeType,
    positionalArgs,
    namedArgs: new Map(),
    sourceSpan: call.sourceSpan,
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
  // Collect detected attribute markers
  const markers: AttributeMarker[] = [];
  const markerStatementIndices: Set<number> = new Set();

  // Walk statements looking for attribute markers
  module.body.forEach((stmt, i) => {
    if (stmt.kind !== "expressionStatement") return;

    const expr = stmt.expression;
    if (expr.kind !== "call") return;

    const marker = tryDetectAttributeMarker(expr as IrCallExpression, module);
    if (marker) {
      markers.push(marker);
      markerStatementIndices.add(i);
    }
  });

  // If no markers found, return module unchanged
  if (markers.length === 0) {
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
  const functionAttributes = new Map<number, IrAttribute[]>();

  for (const marker of markers) {
    const classIndex = classDeclarations.get(marker.targetName);
    const funcIndex = functionDeclarations.get(marker.targetName);

    if (classIndex !== undefined) {
      // Attach to class
      const attrs = classAttributes.get(classIndex) ?? [];
      attrs.push({
        kind: "attribute",
        attributeType: marker.attributeType,
        positionalArgs: marker.positionalArgs,
        namedArgs: marker.namedArgs,
      });
      classAttributes.set(classIndex, attrs);
    } else if (funcIndex !== undefined) {
      // Attach to function
      const attrs = functionAttributes.get(funcIndex) ?? [];
      attrs.push({
        kind: "attribute",
        attributeType: marker.attributeType,
        positionalArgs: marker.positionalArgs,
        namedArgs: marker.namedArgs,
      });
      functionAttributes.set(funcIndex, attrs);
    } else {
      // Target not found - emit warning diagnostic
      // This is not a hard failure since the marker may reference a declaration
      // in another module (cross-module attribute attachment not yet supported)
      diagnostics.push(
        createDiagnostic(
          "TSN5002",
          "warning",
          `Attribute target '${marker.targetName}' not found in module`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
    }
  }

  // Rebuild module body:
  // 1. Filter out marker statements
  // 2. Update declarations with attached attributes
  const newBody: IrStatement[] = [];

  module.body.forEach((stmt, i) => {
    // Skip marker statements
    if (markerStatementIndices.has(i)) return;

    if (stmt.kind === "classDeclaration" && classAttributes.has(i)) {
      // Update class with attributes
      const classStmt = stmt as IrClassDeclaration;
      const existingAttrs = classStmt.attributes ?? [];
      const newAttrs = classAttributes.get(i) ?? [];
      newBody.push({
        ...classStmt,
        attributes: [...existingAttrs, ...newAttrs],
      });
    } else if (
      stmt.kind === "functionDeclaration" &&
      functionAttributes.has(i)
    ) {
      // Update function with attributes
      const funcStmt = stmt as IrFunctionDeclaration;
      const existingAttrs = funcStmt.attributes ?? [];
      const newAttrs = functionAttributes.get(i) ?? [];
      newBody.push({
        ...funcStmt,
        attributes: [...existingAttrs, ...newAttrs],
      });
    } else {
      // Keep statement unchanged
      newBody.push(stmt);
    }
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
