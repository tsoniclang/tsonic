/**
 * Variable declaration emission
 */

import { IrStatement, IrArrayPattern } from "@tsonic/frontend";
import { EmitterContext, getIndent, addUsing } from "../../types.js";
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
    if (
      decl.type &&
      !(decl.type.kind === "functionType" && !context.isStatic)
    ) {
      // Emit explicit type UNLESS it's a function type in a non-static context
      // (let C# infer lambda types in local contexts)
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
          paramTypes.push("dynamic");
        }
      }

      // Infer return type from arrow function if available
      let returnType = "dynamic";
      if (arrowFunc.returnType) {
        const [retType, newCtx] = emitType(
          arrowFunc.returnType,
          currentContext
        );
        returnType = retType;
        currentContext = newCtx;
      }

      const allTypes = [...paramTypes, returnType];
      const funcType = `Func<${allTypes.join(", ")}>`;
      currentContext = addUsing(currentContext, "System");
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
      for (let i = 0; i < arrayPattern.elements.length; i++) {
        const element = arrayPattern.elements[i];
        if (element && element.kind === "identifierPattern") {
          const elementVarDecl = `${varDecl}${element.name} = ${initFrag.text}[${i}];`;
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
