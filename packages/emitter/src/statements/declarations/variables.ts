/**
 * Variable declaration emission
 */

import { IrStatement, IrType, NUMERIC_KIND_TO_CSHARP } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitType } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { lowerPattern } from "../../patterns.js";
import { resolveTypeAlias, stripNullish } from "../../core/type-resolution.js";
import { emitCSharpName } from "../../naming-policy.js";

const computeLocalName = (
  originalName: string,
  context: EmitterContext
): { emittedName: string; updatedContext: EmitterContext } => {
  const alreadyDeclared = context.localNameMap?.has(originalName) ?? false;
  if (!alreadyDeclared) {
    return { emittedName: escapeCSharpIdentifier(originalName), updatedContext: context };
  }

  const nextId = (context.tempVarId ?? 0) + 1;
  const renamed = `${originalName}__${nextId}`;
  return {
    emittedName: escapeCSharpIdentifier(renamed),
    updatedContext: { ...context, tempVarId: nextId },
  };
};

const registerLocalName = (
  originalName: string,
  emittedName: string,
  context: EmitterContext
): EmitterContext => {
  const nextMap = new Map(context.localNameMap ?? []);
  nextMap.set(originalName, emittedName);
  return { ...context, localNameMap: nextMap };
};

/**
 * Types that require explicit LHS type because C# has no literal suffix for them.
 * For these types, `var x = 200;` would infer `int`, not the intended type.
 */
const TYPES_NEEDING_EXPLICIT_DECL = new Set([
  "byte",
  "sbyte",
  "short",
  "ushort",
]);

/**
 * Check if a type can be explicitly emitted as a C# type.
 * Returns false for types that cannot be named in C# (any, unknown, anonymous).
 */
const canEmitTypeExplicitly = (type: IrType): boolean => {
  // Reject any/unknown (these are separate type kinds, not primitive names)
  if (type.kind === "anyType" || type.kind === "unknownType") {
    return false;
  }

  // Accept primitives
  if (type.kind === "primitiveType") {
    return true;
  }

  // Accept arrays, functions, references, tuples, dictionaries
  if (
    type.kind === "arrayType" ||
    type.kind === "functionType" ||
    type.kind === "referenceType" ||
    type.kind === "tupleType" ||
    type.kind === "dictionaryType"
  ) {
    return true;
  }

  // Reject anonymous object types (no CLR backing)
  if (type.kind === "objectType") {
    return false;
  }

  // Reject unions containing any/unknown
  if (type.kind === "unionType") {
    return type.types.every(canEmitTypeExplicitly);
  }

  return false;
};

/**
 * Check if a type requires explicit local variable declaration.
 * Returns true for types like byte, sbyte, short, ushort that have no C# suffix.
 * Resolves type aliases to get the underlying type.
 */
const needsExplicitLocalType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  // Resolve aliases (e.g., local type aliases)
  const resolved = resolveTypeAlias(stripNullish(type), context);

  // Check primitive types
  if (resolved.kind === "primitiveType") {
    return TYPES_NEEDING_EXPLICIT_DECL.has(resolved.name);
  }

  // Check reference types - these may be CLR types from @tsonic/core
  // (byte, sbyte, short, ushort are imported as reference types, not primitives)
  if (resolved.kind === "referenceType") {
    return TYPES_NEEDING_EXPLICIT_DECL.has(resolved.name);
  }

  return false;
};

/**
 * Emit a variable declaration
 */
export const emitVariableDeclaration = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const declarations: string[] = [];

  for (const decl of stmt.declarations) {
    // Handle destructuring patterns EARLY - they use lowerPattern which generates `var` declarations
    // Skip all the type inference logic for these
    if (
      decl.name.kind === "arrayPattern" ||
      decl.name.kind === "objectPattern"
    ) {
      if (!decl.initializer) {
        // Destructuring requires an initializer
        declarations.push(
          `${ind}/* destructuring without initializer - error */`
        );
        continue;
      }

      // Emit the RHS expression
      const [initFrag, newContext] = emitExpression(
        decl.initializer,
        currentContext,
        decl.type
      );
      currentContext = newContext;

      // Use explicit type annotation if present, otherwise use initializer's inferred type
      const patternType = decl.type ?? decl.initializer.inferredType;

      // Lower the pattern to C# statements
      const result = lowerPattern(
        decl.name,
        initFrag.text,
        patternType,
        ind,
        currentContext
      );

      // Add all generated statements
      declarations.push(...result.statements);
      currentContext = result.context;
      continue;
    }

    let varDecl = "";

    // In static contexts, variable declarations become fields with modifiers
    if (context.isStatic) {
      // Exported: public, non-exported: private
      varDecl = stmt.isExported ? "public static " : "private static ";
      if (stmt.declarationKind === "const") {
        varDecl += "readonly ";
      }
    }

    // Determine the C# type
    // Priority:
    // 1) numericNarrowing initializer (e.g., `1000 as int`) - use CLR type
    // 2) typeAssertion initializer (e.g., `obj as Person`) - use target type
    // 3) Explicit/inferred IR type
    // 4) Arrow function inference
    // 5) var
    if (context.isStatic && decl.initializer?.kind === "numericNarrowing") {
      // Numeric narrowing: `1000 as int` -> emit the target CLR type
      const narrowingExpr = decl.initializer;
      const csharpType =
        NUMERIC_KIND_TO_CSHARP.get(narrowingExpr.targetKind) ?? "double";
      varDecl += `${csharpType} `;
    } else if (context.isStatic && decl.initializer?.kind === "typeAssertion") {
      // Type assertion: `obj as Person` -> emit the target type
      const assertExpr = decl.initializer;
      const [typeName, newContext] = emitType(
        assertExpr.targetType,
        currentContext
      );
      currentContext = newContext;
      varDecl += `${typeName} `;
    } else if (context.isStatic && decl.type) {
      // Static fields: emit explicit type (required - can't use 'var' for fields)
      const [typeName, newContext] = emitType(decl.type, currentContext);
      currentContext = newContext;
      varDecl += `${typeName} `;
    } else if (
      decl.initializer &&
      decl.initializer.kind === "arrowFunction" &&
      context.isStatic
    ) {
      // For arrow functions in static context without explicit type, infer Func<> type
      const arrowFunc = decl.initializer;
      const paramTypes: string[] = [];

      for (const param of arrowFunc.parameters) {
        if (param.type) {
          const [paramType, newCtx] = emitType(param.type, currentContext);
          paramTypes.push(paramType);
          currentContext = newCtx;
        } else {
          // ICE: Frontend validation (TSN7405) should have caught this.
          const paramName =
            param.pattern.kind === "identifierPattern"
              ? param.pattern.name
              : "unknown";
          throw new Error(
            `ICE: Untyped parameter '${paramName}' reached emitter - validation missed TSN7405`
          );
        }
      }

      // Get return type: explicit annotation, or infer from TS checker
      const arrowReturnType =
        arrowFunc.returnType ??
        (arrowFunc.inferredType?.kind === "functionType"
          ? arrowFunc.inferredType.returnType
          : undefined);

      if (!arrowReturnType) {
        // ICE: Neither explicit nor inferred return type available
        throw new Error(
          "ICE: Arrow function without return type reached emitter - neither explicit nor inferred type available"
        );
      }

      const [returnType, retCtx] = emitType(arrowReturnType, currentContext);
      currentContext = retCtx;

      const allTypes = [...paramTypes, returnType];
      const funcType = `global::System.Func<${allTypes.join(", ")}>`;
      varDecl += `${funcType} `;
    } else if (context.isStatic) {
      // Static fields cannot use 'var' - infer type from initializer if possible
      // Priority: 1) new expression with type args, 2) literals, 3) fall back to object
      if (decl.initializer?.kind === "new") {
        // Construct type from the new expression's callee and type arguments
        // This preserves explicit type arguments like `int` instead of using
        // inferredType which TypeScript sees as `number`
        const newExpr = decl.initializer;
        const [calleeFrag, calleeContext] = emitExpression(
          newExpr.callee,
          currentContext
        );
        currentContext = calleeContext;

        if (newExpr.typeArguments && newExpr.typeArguments.length > 0) {
          // Emit type with explicit type arguments
          const typeArgs: string[] = [];
          for (const typeArg of newExpr.typeArguments) {
            const [typeArgStr, newCtx] = emitType(typeArg, currentContext);
            typeArgs.push(typeArgStr);
            currentContext = newCtx;
          }
          varDecl += `${calleeFrag.text}<${typeArgs.join(", ")}> `;
        } else {
          // Non-generic constructor
          varDecl += `${calleeFrag.text} `;
        }
      } else if (decl.initializer?.kind === "literal") {
        const lit = decl.initializer;
        if (typeof lit.value === "string") {
          varDecl += "string ";
        } else if (typeof lit.value === "number") {
          // Use expression-level numericIntent (from literal lexeme) to determine int vs double
          // INVARIANT: numericIntent is on the literal expression, NOT on the type
          const numericIntent = lit.numericIntent;
          const csharpType = numericIntent
            ? (NUMERIC_KIND_TO_CSHARP.get(numericIntent) ?? "double")
            : "double";
          varDecl += `${csharpType} `;
        } else if (typeof lit.value === "boolean") {
          varDecl += "bool ";
        } else {
          varDecl += "object ";
        }
      } else if (
        decl.initializer?.inferredType &&
        canEmitTypeExplicitly(decl.initializer.inferredType)
      ) {
        // Use initializer's inferred type (function return types, etc.)
        const [typeName, newContext] = emitType(
          decl.initializer.inferredType,
          currentContext
        );
        currentContext = newContext;
        varDecl += `${typeName} `;
      } else {
        varDecl += "object ";
      }
    } else if (
      !context.isStatic &&
      decl.type &&
      canEmitTypeExplicitly(decl.type)
    ) {
      // Local variables with an explicit TypeScript annotation must preserve that type in C#.
      // Using `var` would re-infer from the initializer and can break semantics (e.g. base-typed
      // variables that are reassigned to different derived instances).
      const [typeName, newContext] = emitType(decl.type, currentContext);
      currentContext = newContext;
      varDecl += `${typeName} `;
    } else if (
      !context.isStatic &&
      decl.type &&
      decl.initializer &&
      ((decl.initializer.kind === "literal" &&
        (decl.initializer.value === undefined ||
          decl.initializer.value === null)) ||
        (decl.initializer.kind === "identifier" &&
          (decl.initializer.name === "undefined" ||
            decl.initializer.name === "null")))
    ) {
      // `var x = default;` / `var x = null;` is invalid because there is no target type.
      // When the TypeScript source has an explicit type annotation, emit the explicit C# type.
      const [typeName, newContext] = emitType(decl.type, currentContext);
      currentContext = newContext;
      varDecl += `${typeName} `;
    } else if (
      !context.isStatic &&
      !decl.type &&
      decl.initializer &&
      ((decl.initializer.kind === "literal" &&
        (decl.initializer.value === undefined ||
          decl.initializer.value === null)) ||
        (decl.initializer.kind === "identifier" &&
          (decl.initializer.name === "undefined" ||
            decl.initializer.name === "null")))
    ) {
      // Nullish initializer without an explicit annotation cannot be emitted with `var`.
      // Prefer the initializer's inferred type if it is explicitly nameable in C#,
      // otherwise fall back to object? to keep emission valid.
      const fallbackType = decl.initializer.inferredType;
      if (fallbackType && canEmitTypeExplicitly(fallbackType)) {
        const [typeName, newContext] = emitType(fallbackType, currentContext);
        currentContext = newContext;
        varDecl += `${typeName} `;
      } else {
        varDecl += "object? ";
      }
    } else if (
      !context.isStatic &&
      decl.type &&
      decl.initializer?.kind !== "stackalloc" &&
      needsExplicitLocalType(decl.type, currentContext)
    ) {
      // Local variable with type that has no C# literal suffix (byte, sbyte, short, ushort)
      // Must emit explicit type since `var x = 200;` would infer `int`
      const [typeName, newContext] = emitType(decl.type, currentContext);
      currentContext = newContext;
      varDecl += `${typeName} `;
    } else if (!context.isStatic && decl.initializer?.kind === "stackalloc") {
      // stackalloc expressions must be target-typed to produce Span<T> (otherwise they become T* and require unsafe).
      const targetType = decl.type ?? decl.initializer.inferredType;
      if (!targetType) {
        throw new Error(
          "ICE: stackalloc initializer missing target type (no decl.type and no inferredType)"
        );
      }
      const [typeName, newContext] = emitType(targetType, currentContext);
      currentContext = newContext;
      varDecl += `${typeName} `;
    } else {
      // Local variables use `var` - idiomatic C# when RHS is self-documenting
      varDecl += "var ";
    }

    // Handle different pattern types
    if (decl.name.kind === "identifierPattern") {
      // Simple identifier pattern (escape C# keywords)
      const originalName = decl.name.name;
      const localNameInfo = context.isStatic
        ? { emittedName: emitCSharpName(originalName, "fields", context), updatedContext: currentContext }
        : computeLocalName(originalName, currentContext);
      const localName = localNameInfo.emittedName;
      currentContext = localNameInfo.updatedContext;
      varDecl += localName;

      // Add initializer if present
      if (decl.initializer) {
        const [initFrag, newContext] = emitExpression(
          decl.initializer,
          currentContext,
          decl.type // Pass expected type for contextual typing (e.g., array literals)
        );
        currentContext = newContext;
        varDecl += ` = ${initFrag.text}`;
      }

      // Register local names after emitting the initializer (C# scoping rules).
      // Static fields are not locals and must not participate in shadowing logic.
      if (!context.isStatic) {
        currentContext = registerLocalName(originalName, localName, currentContext);
      }
      declarations.push(`${ind}${varDecl};`);
    } else {
      // Unknown pattern kind - emit placeholder
      // (arrayPattern and objectPattern are handled early with continue)
      varDecl += "/* unsupported pattern */";
      declarations.push(`${ind}${varDecl};`);
    }
  }

  return [declarations.join("\n"), currentContext];
};
