/**
 * Declaration emitters (variables, functions, classes, interfaces, enums, type aliases)
 */

import { IrStatement, IrArrayPattern } from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  withAsync,
  withStatic,
  withClassName,
  addUsing,
} from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitType, emitTypeParameters } from "../type-emitter.js";
import { emitBlockStatement } from "./blocks.js";
import {
  emitClassMember,
  emitParameters,
  extractInlineObjectTypes,
  emitExtractedType,
  emitInterfaceMemberAsProperty,
} from "./classes.js";

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

/**
 * Emit a function declaration
 */
export const emitFunctionDeclaration = (
  stmt: Extract<IrStatement, { kind: "functionDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  // Access modifiers
  const accessibility = stmt.isExported ? "public" : "private";
  parts.push(accessibility);

  if (context.isStatic) {
    parts.push("static");
  }

  if (stmt.isAsync && !stmt.isGenerator) {
    parts.push("async");
    currentContext = addUsing(currentContext, "System.Threading.Tasks");
  }

  // Return type
  if (stmt.isGenerator) {
    // Generator functions return IEnumerable<exchange> or IAsyncEnumerable<exchange>
    const exchangeName = `${stmt.name}_exchange`;
    if (stmt.isAsync) {
      parts.push(`async IAsyncEnumerable<${exchangeName}>`);
      currentContext = addUsing(currentContext, "System.Collections.Generic");
    } else {
      parts.push(`IEnumerable<${exchangeName}>`);
      currentContext = addUsing(currentContext, "System.Collections.Generic");
    }
  } else if (stmt.returnType) {
    const [returnType, newContext] = emitType(stmt.returnType, currentContext);
    currentContext = newContext;
    // If async and return type is Promise, it's already converted to Task
    // Don't wrap it again
    if (
      stmt.isAsync &&
      stmt.returnType.kind === "referenceType" &&
      stmt.returnType.name === "Promise"
    ) {
      parts.push(returnType); // Already Task<T> from emitType
    } else {
      parts.push(stmt.isAsync ? `Task<${returnType}>` : returnType);
    }
  } else {
    parts.push(stmt.isAsync ? "Task" : "void");
  }

  // Function name
  parts.push(stmt.name);

  // Type parameters
  const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext
  );
  currentContext = typeParamContext;

  // Parameters
  const params = emitParameters(stmt.parameters, currentContext);
  currentContext = params[1];

  // Function body (not a static context - local variables)
  const bodyContext = withAsync(
    withStatic(indent(currentContext), false),
    stmt.isAsync
  );
  const [bodyCode, finalContext] = emitBlockStatement(stmt.body, bodyContext);

  // Inject initialization code for generators
  let finalBodyCode = bodyCode;
  if (stmt.isGenerator) {
    const bodyInd = getIndent(bodyContext);
    const exchangeName = `${stmt.name}_exchange`;
    const initLine = `${bodyInd}var exchange = new ${exchangeName}();`;

    const lines = bodyCode.split("\n");
    if (lines.length > 1) {
      lines.splice(1, 0, initLine, "");
      finalBodyCode = lines.join("\n");
    }
  }

  const signature = parts.join(" ");
  const whereClause =
    whereClauses.length > 0
      ? `\n${ind}    ${whereClauses.join(`\n${ind}    `)}`
      : "";
  const code = `${ind}${signature}${typeParamsStr}(${params[0]})${whereClause}\n${finalBodyCode}`;

  // Return context preserving usings from body but keeping original context flags
  return [code, { ...currentContext, usings: finalContext.usings }];
};

/**
 * Emit a class declaration
 */
export const emitClassDeclaration = (
  stmt: Extract<IrStatement, { kind: "classDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  // Access modifiers
  const accessibility = stmt.isExported ? "public" : "internal";
  parts.push(accessibility);

  parts.push("class");
  parts.push(stmt.name);

  // Type parameters
  const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext
  );
  currentContext = typeParamContext;

  // Base class and interfaces
  const heritage: string[] = [];

  // Handle superclass (extends clause)
  if (stmt.superClass) {
    const [superClassFrag, newContext] = emitExpression(
      stmt.superClass,
      currentContext
    );
    currentContext = newContext;
    heritage.push(superClassFrag.text);
  }

  // Handle interfaces (implements clause)
  if (stmt.implements && stmt.implements.length > 0) {
    for (const iface of stmt.implements) {
      const [ifaceType, newContext] = emitType(iface, currentContext);
      currentContext = newContext;
      heritage.push(ifaceType);
    }
  }

  const heritageStr = heritage.length > 0 ? ` : ${heritage.join(", ")}` : "";
  const whereClause =
    whereClauses.length > 0
      ? `\n${ind}    ${whereClauses.join(`\n${ind}    `)}`
      : "";

  // Class body
  const baseContext = withClassName(indent(currentContext), stmt.name);
  // Only set hasSuperClass flag if there's actually a superclass (for inheritance)
  const bodyContext = stmt.superClass
    ? { ...baseContext, hasSuperClass: true }
    : baseContext;
  const members: string[] = [];

  for (const member of stmt.members) {
    const [memberCode, newContext] = emitClassMember(member, bodyContext);
    members.push(memberCode);
    currentContext = newContext;
  }

  const signature = parts.join(" ");
  const memberCode = members.join("\n\n");
  const code = `${ind}${signature}${typeParamsStr}${heritageStr}${whereClause}\n${ind}{\n${memberCode}\n${ind}}`;

  return [code, currentContext];
};

/**
 * Emit an interface declaration (as C# class)
 */
export const emitInterfaceDeclaration = (
  stmt: Extract<IrStatement, { kind: "interfaceDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // Per spec/16-types-and-interfaces.md §2.1:
  // TypeScript interfaces map to C# classes (not C# interfaces)
  // because TS interfaces are structural and we need nominal types in C#

  const ind = getIndent(context);
  let currentContext = context;

  // Extract inline object types and emit them as separate classes
  const extractedTypes = extractInlineObjectTypes(stmt.members);
  const extractedClassCodes: string[] = [];

  for (const extracted of extractedTypes) {
    const [classCode, newContext] = emitExtractedType(
      extracted,
      currentContext
    );
    extractedClassCodes.push(classCode);
    currentContext = newContext;
  }

  const parts: string[] = [];

  // Access modifier
  const accessibility = stmt.isExported ? "public" : "internal";
  parts.push(accessibility);
  parts.push("class"); // Class, not interface!
  parts.push(stmt.name);

  // Type parameters (if any)
  if (stmt.typeParameters && stmt.typeParameters.length > 0) {
    const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
      stmt.typeParameters,
      currentContext
    );
    parts.push(typeParamsStr);
    currentContext = typeParamContext;

    // Extended interfaces/classes
    if (stmt.extends && stmt.extends.length > 0) {
      const extended: string[] = [];
      for (const ext of stmt.extends) {
        const [extType, newContext] = emitType(ext, currentContext);
        currentContext = newContext;
        extended.push(extType);
      }
      parts.push(":");
      parts.push(extended.join(", "));
    }

    // Where clauses for type parameters
    if (whereClauses.length > 0) {
      parts.push("\n" + ind + "    " + whereClauses.join("\n" + ind + "    "));
    }
  } else {
    // Extended interfaces/classes (no generics)
    if (stmt.extends && stmt.extends.length > 0) {
      const extended: string[] = [];
      for (const ext of stmt.extends) {
        const [extType, newContext] = emitType(ext, currentContext);
        currentContext = newContext;
        extended.push(extType);
      }
      parts.push(":");
      parts.push(extended.join(", "));
    }
  }

  // Class body with auto-properties
  const bodyContext = indent(currentContext);
  const members: string[] = [];

  for (const member of stmt.members) {
    const [memberCode, newContext] = emitInterfaceMemberAsProperty(
      member,
      bodyContext
    );
    members.push(memberCode);
    currentContext = newContext;
  }

  const signature = parts.join(" ");
  const memberCode = members.join("\n\n");
  const mainClassCode = `${ind}${signature}\n${ind}{\n${memberCode}\n${ind}}`;

  // Combine main interface and extracted classes (extracted classes come after)
  const allParts: string[] = [];
  allParts.push(mainClassCode);
  if (extractedClassCodes.length > 0) {
    allParts.push(...extractedClassCodes);
  }

  const code = allParts.join("\n");

  return [code, currentContext];
};

/**
 * Emit an enum declaration
 */
export const emitEnumDeclaration = (
  stmt: Extract<IrStatement, { kind: "enumDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const memberInd = getIndent(indent(context));

  const accessibility = stmt.isExported ? "public" : "internal";
  const members = stmt.members
    .map((member) => {
      if (member.initializer) {
        const [initFrag] = emitExpression(member.initializer, context);
        return `${memberInd}${member.name} = ${initFrag.text}`;
      }
      return `${memberInd}${member.name}`;
    })
    .join(",\n");

  const code = `${ind}${accessibility} enum ${stmt.name}\n${ind}{\n${members}\n${ind}}`;
  return [code, context];
};

/**
 * Emit a type alias declaration
 */
export const emitTypeAliasDeclaration = (
  stmt: Extract<IrStatement, { kind: "typeAliasDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // Per spec/16-types-and-interfaces.md §3:
  // - Structural type aliases generate C# classes with __Alias suffix
  // - Simple aliases (primitives, references) emit as comments or using aliases

  const ind = getIndent(context);
  let currentContext = context;

  // Check if this is a structural (object) type alias
  if (stmt.type.kind === "objectType") {
    // Generate a sealed class for structural type alias
    const parts: string[] = [];

    const accessibility = stmt.isExported ? "public" : "internal";
    parts.push(accessibility);
    parts.push("sealed");
    parts.push("class");
    parts.push(`${stmt.name}__Alias`); // Add __Alias suffix per spec §3.4

    // Type parameters (if any)
    if (stmt.typeParameters && stmt.typeParameters.length > 0) {
      const [typeParamsStr, whereClauses, typeParamContext] =
        emitTypeParameters(stmt.typeParameters, currentContext);
      parts.push(typeParamsStr);
      currentContext = typeParamContext;

      if (whereClauses.length > 0) {
        parts.push(
          "\n" + ind + "    " + whereClauses.join("\n" + ind + "    ")
        );
      }
    }

    // Generate properties from object type members
    const bodyContext = indent(currentContext);
    const properties: string[] = [];

    if (stmt.type.kind === "objectType") {
      for (const member of stmt.type.members) {
        if (member.kind === "propertySignature") {
          const propParts: string[] = [];
          propParts.push("public");

          // Property type
          if (member.type) {
            const [propType, newContext] = emitType(
              member.type,
              currentContext
            );
            currentContext = newContext;
            // Optional members become nullable
            const typeStr = member.isOptional ? `${propType}?` : propType;
            propParts.push(typeStr);
          } else {
            propParts.push(member.isOptional ? "object?" : "object");
          }

          propParts.push(member.name);

          // Readonly uses private set
          const accessors = member.isReadonly
            ? "{ get; private set; }"
            : "{ get; set; }";
          propParts.push(accessors);

          // Default initializer
          propParts.push("= default!;");

          properties.push(`${getIndent(bodyContext)}${propParts.join(" ")}`);
        }
      }
    }

    const signature = parts.join(" ");
    const propsCode = properties.join("\n");
    const code = `${ind}${signature}\n${ind}{\n${propsCode}\n${ind}}`;

    return [code, currentContext];
  }

  // For non-structural aliases, emit as comment (C# using aliases are limited)
  const [typeName, newContext] = emitType(stmt.type, context);
  const code = `${ind}// type ${stmt.name} = ${typeName}`;
  return [code, newContext];
};
