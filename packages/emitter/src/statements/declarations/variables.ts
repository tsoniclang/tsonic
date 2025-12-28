/**
 * Variable declaration emission
 */

import { IrStatement, NUMERIC_KIND_TO_CSHARP } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitType } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { lowerPattern } from "../../patterns.js";

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
    } else if (
      decl.type &&
      !(decl.type.kind === "functionType" && !context.isStatic)
    ) {
      // Emit explicit type UNLESS it's a function type in a non-static context
      // (let C# infer lambda types in local contexts)
      // Note: For module-level exports, type is always set (from annotation or inference)
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
      } else {
        varDecl += "object ";
      }
    } else {
      varDecl += "var ";
    }

    // Handle different pattern types
    if (decl.name.kind === "identifierPattern") {
      // Simple identifier pattern (escape C# keywords)
      varDecl += escapeCSharpIdentifier(decl.name.name);

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

      declarations.push(`${ind}${varDecl};`);
    } else if (
      decl.name.kind === "arrayPattern" ||
      decl.name.kind === "objectPattern"
    ) {
      // Destructuring patterns: use lowerPattern for full support
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

      // Lower the pattern to C# statements
      const result = lowerPattern(
        decl.name,
        initFrag.text,
        decl.type,
        ind,
        currentContext
      );

      // Add all generated statements
      declarations.push(...result.statements);
      currentContext = result.context;
    } else {
      // Unknown pattern kind - emit placeholder
      varDecl += "/* unsupported pattern */";
      declarations.push(`${ind}${varDecl};`);
    }
  }

  return [declarations.join("\n"), currentContext];
};
