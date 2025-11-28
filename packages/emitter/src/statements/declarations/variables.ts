/**
 * Variable declaration emission
 */

import { IrStatement, IrArrayPattern } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitType } from "../../type-emitter.js";

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
    if (context.isStatic && stmt.isExported) {
      varDecl = "public static ";
      if (stmt.declarationKind === "const") {
        varDecl += "readonly ";
      }
    }

    // Determine the C# type
    // Priority: 1) Explicit/inferred IR type, 2) Arrow function inference, 3) var
    if (
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
    } else {
      varDecl += "var ";
    }

    // Handle different pattern types
    if (decl.name.kind === "identifierPattern") {
      // Simple identifier pattern
      varDecl += decl.name.name;

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
    } else if (decl.name.kind === "arrayPattern") {
      // Array destructuring: const [a, b] = arr; -> var a = arr[0]; var b = arr[1];
      if (!decl.initializer) {
        // Array destructuring requires an initializer
        declarations.push(
          `${ind}${varDecl}/* array destructuring without initializer */;`
        );
        continue;
      }

      const [initFrag, newContext] = emitExpression(
        decl.initializer,
        currentContext,
        decl.type
      );
      currentContext = newContext;

      const arrayPattern = decl.name as IrArrayPattern;
      // Use global:: prefix for Tsonic.Runtime.Array static helpers
      for (let i = 0; i < arrayPattern.elements.length; i++) {
        const element = arrayPattern.elements[i];
        if (element && element.kind === "identifierPattern") {
          // Use double literal for index (JavaScript uses doubles for all numbers)
          const elementVarDecl = `${varDecl}${element.name} = global::Tsonic.Runtime.Array.get(${initFrag.text}, ${i}.0);`;
          declarations.push(`${ind}${elementVarDecl}`);
        }
        // Skip undefined elements (holes in array pattern)
      }
    } else {
      // Object destructuring or other patterns - not yet supported
      varDecl += "/* destructuring */";

      // Add initializer if present
      if (decl.initializer) {
        const [initFrag, newContext] = emitExpression(
          decl.initializer,
          currentContext,
          decl.type
        );
        currentContext = newContext;
        varDecl += ` = ${initFrag.text}`;
      }

      declarations.push(`${ind}${varDecl};`);
    }
  }

  return [declarations.join("\n"), currentContext];
};
