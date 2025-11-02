/**
 * Class-related helpers (members, constructors, parameters, interface members)
 */

import {
  IrClassMember,
  IrInterfaceMember,
  IrParameter,
} from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  dedent,
  withAsync,
  addUsing,
} from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitType, emitParameterType, emitTypeParameters } from "../type-emitter.js";
import { emitBlockStatement } from "./blocks.js";

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

/**
 * Capitalize first letter of a string (for generating class names from property names)
 */
export const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Extract inline object types from interface members and generate class declarations
 */
export type ExtractedType = {
  readonly className: string;
  readonly members: readonly IrInterfaceMember[];
};

export const extractInlineObjectTypes = (
  members: readonly IrInterfaceMember[]
): readonly ExtractedType[] => {
  const extracted: ExtractedType[] = [];

  for (const member of members) {
    if (
      member.kind === "propertySignature" &&
      member.type?.kind === "objectType"
    ) {
      // Generate class name from property name (capitalize)
      const className = capitalize(member.name);
      extracted.push({
        className,
        members: member.type.members,
      });
    }
  }

  return extracted;
};

/**
 * Emit an extracted inline object type as a class
 */
export const emitExtractedType = (
  extracted: ExtractedType,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;

  const parts: string[] = [];
  parts.push(`${ind}public class ${extracted.className}`);
  parts.push(`${ind}{`);

  // Emit properties
  const bodyContext = indent(currentContext);
  const propertyParts: string[] = [];
  let bodyCurrentContext = bodyContext;

  for (const member of extracted.members) {
    const [memberCode, newContext] = emitInterfaceMemberAsProperty(
      member,
      bodyCurrentContext
    );
    propertyParts.push(memberCode);
    bodyCurrentContext = newContext;
  }

  if (propertyParts.length > 0) {
    parts.push(propertyParts.join("\n"));
  }

  parts.push(`${ind}}`);

  // Return context at original indent level, preserving only usings
  const finalContext = {
    ...context,
    usings: bodyCurrentContext.usings,
  };

  return [parts.join("\n"), finalContext];
};

/**
 * Emit interface member as C# auto-property (for classes)
 * Per spec/16-types-and-interfaces.md §2.1
 */
export const emitInterfaceMemberAsProperty = (
  member: IrInterfaceMember,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  switch (member.kind) {
    case "propertySignature": {
      let currentContext = context;
      const parts: string[] = [];

      parts.push("public"); // All properties public

      // Property type
      if (member.type) {
        // If this is an inline object type, use the extracted class name
        let typeName: string;
        if (member.type.kind === "objectType") {
          // Use capitalized property name as the class name
          typeName = capitalize(member.name);
        } else {
          const [emittedType, newContext] = emitType(
            member.type,
            currentContext
          );
          currentContext = newContext;
          typeName = emittedType;
        }
        // Optional members become nullable (spec §2.1)
        const typeStr = member.isOptional ? `${typeName}?` : typeName;
        parts.push(typeStr);
      } else {
        const typeStr = member.isOptional ? "object?" : "object";
        parts.push(typeStr);
      }

      // Property name
      parts.push(member.name);

      // Getter/setter (readonly is get-only)
      const accessors = member.isReadonly ? "{ get; }" : "{ get; set; }";

      return [`${ind}${parts.join(" ")} ${accessors}`, currentContext];
    }

    case "methodSignature": {
      let currentContext = context;
      const parts: string[] = [];

      parts.push("public"); // All methods public

      // Return type
      if (member.returnType) {
        const [returnType, newContext] = emitType(
          member.returnType,
          currentContext
        );
        currentContext = newContext;
        parts.push(returnType);
      } else {
        parts.push("void");
      }

      // Method name
      parts.push(member.name);

      // Parameters
      const params = emitParameters(member.parameters, currentContext);
      currentContext = params[1];

      // Methods in interfaces are abstract declarations
      return [
        `${ind}${parts.join(" ")}(${params[0]}) => throw new NotImplementedException();`,
        currentContext,
      ];
    }

    default:
      return [`${ind}// TODO: unhandled interface member`, context];
  }
};

/**
 * Emit parameters for functions and methods
 */
export const emitParameters = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;
  const params: string[] = [];

  for (const param of parameters) {
    const isRest = param.isRest;
    const isOptional = param.isOptional;

    // Parameter type
    let paramType = "object";
    if (param.type) {
      const [typeName, newContext] = emitParameterType(
        param.type,
        isOptional,
        currentContext
      );
      currentContext = newContext;
      paramType = typeName;
      // TODO: Rest parameters currently map to Tsonic.Runtime.Array<T> to preserve
      // JavaScript semantics (reduce, join, etc.). In future, could optimize to
      // params T[] and wrap with Array.from() at call sites.
    }

    // Parameter name
    let paramName = "param";
    if (param.pattern.kind === "identifierPattern") {
      paramName = param.pattern.name;
    }

    // Default value - emit the actual default value in the parameter signature
    let paramStr = `${paramType} ${paramName}`;
    if (param.initializer) {
      // Emit the default value directly
      const [defaultExpr, newContext] = emitExpression(
        param.initializer,
        currentContext
      );
      currentContext = newContext;
      paramStr = `${paramType} ${paramName} = ${defaultExpr.text}`;
    } else if (isOptional && !isRest) {
      paramStr += " = default";
    }

    params.push(paramStr);
  }

  return [params.join(", "), currentContext];
};
