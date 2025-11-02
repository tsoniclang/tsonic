/**
 * Statement Emitter - IR statements to C# code
 */

import {
  IrStatement,
  IrExpression,
  IrClassMember,
  IrInterfaceMember,
  IrParameter,
  IrArrayPattern,
} from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  dedent,
  withAsync,
  withClassName,
  addUsing,
} from "./types.js";
import { emitExpression } from "./expression-emitter.js";
import {
  emitType,
  emitParameterType,
  emitTypeParameters,
} from "./type-emitter.js";

/**
 * Emit a C# statement from an IR statement
 */
export const emitStatement = (
  stmt: IrStatement,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  switch (stmt.kind) {
    case "variableDeclaration":
      return emitVariableDeclaration(stmt, context);

    case "functionDeclaration":
      return emitFunctionDeclaration(stmt, context);

    case "classDeclaration":
      return emitClassDeclaration(stmt, context);

    case "interfaceDeclaration":
      return emitInterfaceDeclaration(stmt, context);

    case "enumDeclaration":
      return emitEnumDeclaration(stmt, context);

    case "typeAliasDeclaration":
      return emitTypeAliasDeclaration(stmt, context);

    case "blockStatement":
      return emitBlockStatement(stmt, context);

    case "ifStatement":
      return emitIfStatement(stmt, context);

    case "whileStatement":
      return emitWhileStatement(stmt, context);

    // Note: doWhileStatement not in current IR types
    // case "doWhileStatement":
    //   return emitDoWhileStatement(stmt, context);

    case "forStatement":
      return emitForStatement(stmt, context);

    case "forOfStatement":
      return emitForOfStatement(stmt, context);

    // Note: forInStatement not in current IR types
    // case "forInStatement":
    //   return emitForInStatement(stmt, context);

    case "switchStatement":
      return emitSwitchStatement(stmt, context);

    case "tryStatement":
      return emitTryStatement(stmt, context);

    case "throwStatement":
      return emitThrowStatement(stmt, context);

    case "returnStatement":
      return emitReturnStatement(stmt, context);

    case "breakStatement":
      return [`${ind}break;`, context];

    case "continueStatement":
      return [`${ind}continue;`, context];

    case "expressionStatement":
      return emitExpressionStatement(stmt, context);

    case "emptyStatement":
      return [`${ind};`, context];

    default:
      return [`${ind}// TODO: unhandled statement`, context];
  }
};

const emitVariableDeclaration = (
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
    if (decl.type) {
      const [typeName, newContext] = emitType(decl.type, currentContext);
      currentContext = newContext;
      varDecl += `${typeName} `;
    } else if (decl.initializer && decl.initializer.kind === "arrowFunction" && context.isStatic) {
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
        const [retType, newCtx] = emitType(arrowFunc.returnType, currentContext);
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
        declarations.push(`${ind}${varDecl}/* array destructuring without initializer */;`);
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

const emitFunctionDeclaration = (
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

  // Function body
  const bodyContext = withAsync(indent(currentContext), stmt.isAsync);
  const [bodyCode, finalContext] = emitBlockStatement(stmt.body, bodyContext);

  // For generators, inject exchange variable initialization at start of body
  let finalBodyCode = bodyCode;
  if (stmt.isGenerator) {
    const exchangeName = `${stmt.name}_exchange`;
    const bodyInd = getIndent(bodyContext);
    const initLine = `${bodyInd}var exchange = new ${exchangeName}();`;

    // Insert after opening brace
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

  return [code, dedent(finalContext)];
};

const emitClassDeclaration = (
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
  // Note: superClass in IR is an expression, not a type
  // For MVP, we'll skip superclass handling
  // TODO: Handle superClass properly

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
  const bodyContext = withClassName(indent(currentContext), stmt.name);
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

const emitClassMember = (
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

      const bodyContext = indent(currentContext);
      const [bodyCode, finalContext] = emitBlockStatement(
        member.body,
        bodyContext
      );

      const signature = parts.join(" ");
      const code = `${ind}${signature}(${params[0]})\n${bodyCode}`;

      return [code, dedent(finalContext)];
    }

    default:
      return [`${ind}// TODO: unhandled class member`, context];
  }
};

const emitInterfaceDeclaration = (
  stmt: Extract<IrStatement, { kind: "interfaceDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // Per spec/16-types-and-interfaces.md §2.1:
  // TypeScript interfaces map to C# classes (not C# interfaces)
  // because TS interfaces are structural and we need nominal types in C#

  const ind = getIndent(context);
  let currentContext = context;
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
  const code = `${ind}${signature}\n${ind}{\n${memberCode}\n${ind}}`;

  return [code, currentContext];
};

/**
 * Emit interface member as C# auto-property (for classes)
 * Per spec/16-types-and-interfaces.md §2.1
 */
const emitInterfaceMemberAsProperty = (
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
        const [typeName, newContext] = emitType(member.type, currentContext);
        currentContext = newContext;
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

      // Optional properties need default initializer to suppress nullability warnings
      const initializer = member.isOptional ? " = default!" : "";

      return [
        `${ind}${parts.join(" ")} ${accessors}${initializer}`,
        currentContext,
      ];
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

const emitEnumDeclaration = (
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

const emitTypeAliasDeclaration = (
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

const emitBlockStatement = (
  stmt: Extract<IrStatement, { kind: "blockStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const statements: string[] = [];

  for (const s of stmt.statements) {
    const [code, newContext] = emitStatement(s, currentContext);
    statements.push(code);
    currentContext = newContext;
  }

  const bodyCode = statements.join("\n");
  return [`${ind}{\n${bodyCode}\n${ind}}`, currentContext];
};

const emitIfStatement = (
  stmt: Extract<IrStatement, { kind: "ifStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [condFrag, condContext] = emitExpression(stmt.condition, context);
  const [thenCode, thenContext] = emitStatement(
    stmt.thenStatement,
    indent(condContext)
  );

  let code = `${ind}if (${condFrag.text})\n${thenCode}`;
  let finalContext = dedent(thenContext);

  if (stmt.elseStatement) {
    const [elseCode, elseContext] = emitStatement(
      stmt.elseStatement,
      indent(finalContext)
    );
    code += `\n${ind}else\n${elseCode}`;
    finalContext = dedent(elseContext);
  }

  return [code, finalContext];
};

const emitWhileStatement = (
  stmt: Extract<IrStatement, { kind: "whileStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [condFrag, condContext] = emitExpression(stmt.condition, context);
  const [bodyCode, bodyContext] = emitStatement(stmt.body, indent(condContext));

  const code = `${ind}while (${condFrag.text})\n${bodyCode}`;
  return [code, dedent(bodyContext)];
};

const emitForStatement = (
  stmt: Extract<IrStatement, { kind: "forStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;

  // Initializer
  let init = "";
  if (stmt.initializer) {
    if (stmt.initializer.kind === "variableDeclaration") {
      const [initCode, newContext] = emitStatement(
        stmt.initializer,
        currentContext
      );
      currentContext = newContext;
      // Strip trailing semicolon from variable declaration
      init = initCode.trim().replace(/;$/, "");
    } else {
      const [initFrag, newContext] = emitExpression(
        stmt.initializer,
        currentContext
      );
      currentContext = newContext;
      init = initFrag.text;
    }
  }

  // Condition
  let cond = "";
  if (stmt.condition) {
    const [condFrag, newContext] = emitExpression(
      stmt.condition,
      currentContext
    );
    currentContext = newContext;
    cond = condFrag.text;
  }

  // Update
  let update = "";
  if (stmt.update) {
    const [updateFrag, newContext] = emitExpression(
      stmt.update,
      currentContext
    );
    currentContext = newContext;
    update = updateFrag.text;
  }

  // Body
  const [bodyCode, bodyContext] = emitStatement(
    stmt.body,
    indent(currentContext)
  );

  const code = `${ind}for (${init}; ${cond}; ${update})\n${bodyCode}`;
  return [code, dedent(bodyContext)];
};

const emitForOfStatement = (
  stmt: Extract<IrStatement, { kind: "forOfStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [exprFrag, exprContext] = emitExpression(stmt.expression, context);
  const [bodyCode, bodyContext] = emitStatement(stmt.body, indent(exprContext));

  // Use foreach in C#
  const varName =
    stmt.variable.kind === "identifierPattern" ? stmt.variable.name : "item";
  const code = `${ind}foreach (var ${varName} in ${exprFrag.text})\n${bodyCode}`;
  return [code, dedent(bodyContext)];
};

const emitSwitchStatement = (
  stmt: Extract<IrStatement, { kind: "switchStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [exprFrag, exprContext] = emitExpression(stmt.expression, context);

  let currentContext = indent(exprContext);
  const caseInd = getIndent(currentContext);
  const cases: string[] = [];

  for (const switchCase of stmt.cases) {
    if (switchCase.test) {
      const [testFrag, testContext] = emitExpression(
        switchCase.test,
        currentContext
      );
      currentContext = testContext;
      cases.push(`${caseInd}case ${testFrag.text}:`);
    } else {
      cases.push(`${caseInd}default:`);
    }

    const stmtContext = indent(currentContext);
    for (const s of switchCase.statements) {
      const [code, newContext] = emitStatement(s, stmtContext);
      cases.push(code);
      currentContext = newContext;
    }

    // Add break if not already present
    const lastStmt = switchCase.statements[switchCase.statements.length - 1];
    if (
      !lastStmt ||
      (lastStmt.kind !== "breakStatement" &&
        lastStmt.kind !== "returnStatement")
    ) {
      cases.push(`${getIndent(stmtContext)}break;`);
    }
  }

  const code = `${ind}switch (${exprFrag.text})\n${ind}{\n${cases.join("\n")}\n${ind}}`;
  return [code, dedent(currentContext)];
};

const emitTryStatement = (
  stmt: Extract<IrStatement, { kind: "tryStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [tryBlock, tryContext] = emitBlockStatement(stmt.tryBlock, context);

  let code = `${ind}try\n${tryBlock}`;
  let currentContext = tryContext;

  if (stmt.catchClause) {
    const param =
      stmt.catchClause.parameter?.kind === "identifierPattern"
        ? stmt.catchClause.parameter.name
        : "ex";

    const [catchBlock, catchContext] = emitBlockStatement(
      stmt.catchClause.body,
      currentContext
    );
    code += `\n${ind}catch (Exception ${param})\n${catchBlock}`;
    currentContext = catchContext;
  }

  if (stmt.finallyBlock) {
    const [finallyBlock, finallyContext] = emitBlockStatement(
      stmt.finallyBlock,
      currentContext
    );
    code += `\n${ind}finally\n${finallyBlock}`;
    currentContext = finallyContext;
  }

  return [code, currentContext];
};

const emitThrowStatement = (
  stmt: Extract<IrStatement, { kind: "throwStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const [exprFrag, newContext] = emitExpression(stmt.expression, context);
  return [`${ind}throw ${exprFrag.text};`, newContext];
};

const emitReturnStatement = (
  stmt: Extract<IrStatement, { kind: "returnStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  if (stmt.expression) {
    const [exprFrag, newContext] = emitExpression(stmt.expression, context);
    return [`${ind}return ${exprFrag.text};`, newContext];
  }

  return [`${ind}return;`, context];
};

/**
 * Emit yield expression as C# yield return with exchange object pattern
 *
 * TypeScript: yield value
 * C#:
 *   exchange.Output = value;
 *   yield return exchange;
 *
 * TypeScript: yield* otherGenerator()
 * C#:
 *   foreach (var item in OtherGenerator())
 *     yield return item;
 */
const emitYieldStatement = (
  expr: Extract<IrExpression, { kind: "yield" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  if (expr.delegate) {
    // yield* delegation
    if (expr.expression) {
      const [delegateFrag, newContext] = emitExpression(
        expr.expression,
        currentContext
      );
      currentContext = newContext;
      parts.push(`${ind}foreach (var item in ${delegateFrag.text})`);
      parts.push(`${ind}    yield return item;`);
    }
  } else {
    // Regular yield
    if (expr.expression) {
      const [valueFrag, newContext] = emitExpression(
        expr.expression,
        currentContext
      );
      currentContext = newContext;
      parts.push(`${ind}exchange.Output = ${valueFrag.text};`);
      parts.push(`${ind}yield return exchange;`);
    } else {
      // Bare yield (no value)
      parts.push(`${ind}yield return exchange;`);
    }
  }

  return [parts.join("\n"), currentContext];
};

const emitExpressionStatement = (
  stmt: Extract<IrStatement, { kind: "expressionStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  // Special handling for yield expressions in generators
  if (stmt.expression.kind === "yield") {
    return emitYieldStatement(stmt.expression, context);
  }

  const [exprFrag, newContext] = emitExpression(stmt.expression, context);
  return [`${ind}${exprFrag.text};`, newContext];
};

/**
 * Emit parameters for functions and methods
 */
const emitParameters = (
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
    }

    // Add params keyword for rest parameters
    if (isRest) {
      paramType = `params ${paramType}[]`;
    }

    // Parameter name
    let paramName = "param";
    if (param.pattern.kind === "identifierPattern") {
      paramName = param.pattern.name;
    }

    // Default value
    let paramStr = `${paramType} ${paramName}`;
    if (param.initializer) {
      const [defaultFrag, newContext] = emitExpression(
        param.initializer,
        currentContext
      );
      currentContext = newContext;
      paramStr += ` = ${defaultFrag.text}`;
    } else if (isOptional && !isRest) {
      paramStr += " = default";
    }

    params.push(paramStr);
  }

  return [params.join(", "), currentContext];
};
