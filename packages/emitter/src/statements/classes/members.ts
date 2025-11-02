/**
 * Class member emission (properties, methods, constructors)
 */

import { IrClassMember } from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  dedent,
  withAsync,
  addUsing,
} from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitType, emitTypeParameters } from "../../type-emitter.js";
import { emitBlockStatement } from "../blocks.js";
import { emitParameters } from "./parameters.js";

/**
 * Emit a class member (property, method, or constructor)
 */
export const emitClassMember = (
  member: IrClassMember,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  switch (member.kind) {
    case "propertyDeclaration": {
      let currentContext = context;
      const parts: string[] = [];

      // Access modifier
      const accessibility = member.accessibility ?? "public";
      parts.push(accessibility);

      if (member.isStatic) {
        parts.push("static");
      }

      // Override modifier (from metadata or TS base class detection)
      if (member.isOverride) {
        parts.push("override");
      }

      if (member.isReadonly) {
        parts.push("readonly");
      }

      // Property type
      if (member.type) {
        const [typeName, newContext] = emitType(member.type, currentContext);
        currentContext = newContext;
        parts.push(typeName);
      } else {
        parts.push("object");
      }

      // Property name
      parts.push(member.name);

      // Emit as field (TypeScript class fields map to C# fields, not properties)
      let code = `${ind}${parts.join(" ")}`;
      if (member.initializer) {
        const [initFrag, finalContext] = emitExpression(
          member.initializer,
          currentContext
        );
        code += ` = ${initFrag.text}`;
        currentContext = finalContext;
      }
      return [`${code};`, currentContext];
    }

    case "methodDeclaration": {
      let currentContext = context;
      const parts: string[] = [];

      // Access modifier
      const accessibility = member.accessibility ?? "public";
      parts.push(accessibility);

      if (member.isStatic) {
        parts.push("static");
      }

      // Override modifier (from metadata or TS base class detection)
      if (member.isOverride) {
        parts.push("override");
      }

      if (member.isAsync) {
        parts.push("async");
        currentContext = addUsing(currentContext, "System.Threading.Tasks");
      }

      // Return type
      if (member.returnType) {
        const [returnType, newContext] = emitType(
          member.returnType,
          currentContext
        );
        currentContext = newContext;
        // If async and return type is Promise, it's already converted to Task
        // Don't wrap it again
        if (
          member.isAsync &&
          member.returnType.kind === "referenceType" &&
          member.returnType.name === "Promise"
        ) {
          parts.push(returnType); // Already Task<T> from emitType
        } else {
          parts.push(member.isAsync ? `Task<${returnType}>` : returnType);
        }
      } else {
        parts.push(member.isAsync ? "Task" : "void");
      }

      // Method name
      parts.push(member.name);

      // Type parameters
      const [typeParamsStr, whereClauses, typeParamContext] =
        emitTypeParameters(member.typeParameters, currentContext);
      currentContext = typeParamContext;

      // Parameters
      const params = emitParameters(member.parameters, currentContext);
      currentContext = params[1];

      const whereClause =
        whereClauses.length > 0
          ? `\n${ind}    ${whereClauses.join(`\n${ind}    `)}`
          : "";

      // Method body
      const bodyContext = withAsync(indent(currentContext), member.isAsync);

      if (!member.body) {
        // Abstract method without body
        const signature = parts.join(" ");
        const code = `${ind}${signature}${typeParamsStr}(${params[0]})${whereClause};`;
        return [code, currentContext];
      }

      const [bodyCode, finalContext] = emitBlockStatement(
        member.body,
        bodyContext
      );

      const signature = parts.join(" ");
      const code = `${ind}${signature}${typeParamsStr}(${params[0]})${whereClause}\n${bodyCode}`;

      return [code, dedent(finalContext)];
    }

    case "constructorDeclaration": {
      let currentContext = context;
      const parts: string[] = [];

      // Access modifier
      const accessibility = member.accessibility ?? "public";
      parts.push(accessibility);

      // Constructor name (same as class name)
      const constructorName = context.className ?? "UnknownClass";
      parts.push(constructorName);

      // Parameters
      const params = emitParameters(member.parameters, currentContext);
      currentContext = params[1];

      // Constructor body
      if (!member.body) {
        // Abstract or interface constructor without body
        const signature = parts.join(" ");
        const code = `${ind}${signature}(${params[0]});`;
        return [code, currentContext];
      }

      // Check for super() call - MUST be the first statement if present
      // C# base() calls execute before the constructor body, so we can't preserve
      // TypeScript semantics if there are statements before super()
      let baseCall = "";
      let bodyStatements = member.body.statements;

      if (bodyStatements.length > 0) {
        const firstStmt = bodyStatements[0];
        if (
          firstStmt &&
          firstStmt.kind === "expressionStatement" &&
          firstStmt.expression.kind === "call" &&
          firstStmt.expression.callee.kind === "identifier" &&
          firstStmt.expression.callee.name === "super"
        ) {
          // Found super() call as first statement - convert to : base(...)
          const superCall = firstStmt.expression;
          const argFrags: string[] = [];
          for (const arg of superCall.arguments) {
            const [argFrag, newContext] = emitExpression(arg, currentContext);
            argFrags.push(argFrag.text);
            currentContext = newContext;
          }
          baseCall = ` : base(${argFrags.join(", ")})`;
          // Remove super() call from body statements
          bodyStatements = bodyStatements.slice(1);
        }
      }

      // Check if super() appears later in the body (not supported)
      for (const stmt of bodyStatements) {
        if (
          stmt.kind === "expressionStatement" &&
          stmt.expression.kind === "call" &&
          stmt.expression.callee.kind === "identifier" &&
          stmt.expression.callee.name === "super"
        ) {
          // TODO: This should be a compile error in the IR builder
          // For now, emit a comment noting the issue
          const signature = parts.join(" ");
          const errorComment = `${ind}// ERROR: super() must be the first statement in constructor`;
          const code = `${errorComment}\n${ind}${signature}(${params[0]})\n${ind}{\n${ind}    // Constructor body omitted due to error\n${ind}}`;
          return [code, currentContext];
        }
      }

      // Emit body without the super() call
      const bodyContext = indent(currentContext);
      const modifiedBody: typeof member.body = {
        ...member.body,
        statements: bodyStatements,
      };
      const [bodyCode, finalContext] = emitBlockStatement(
        modifiedBody,
        bodyContext
      );

      const signature = parts.join(" ");
      const code = `${ind}${signature}(${params[0]})${baseCall}\n${bodyCode}`;

      return [code, dedent(finalContext)];
    }

    default:
      return [`${ind}// TODO: unhandled class member`, context];
  }
};
