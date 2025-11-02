/**
 * Specialization Generator - Generate monomorphized versions of generic declarations
 * Per spec/15-generics.md §5-6 - Monomorphisation
 */

import {
  IrModule,
  IrFunctionDeclaration,
  IrClassDeclaration,
  IrType,
  IrStatement,
  IrExpression,
  IrBlockStatement,
} from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import { emitStatement } from "./statement-emitter.js";

/**
 * Specialization request - tracks a function/class that needs a specialized version
 */
export type SpecializationRequest = {
  readonly kind: "function" | "class";
  readonly name: string;
  readonly typeArguments: readonly IrType[];
  readonly declaration: IrFunctionDeclaration | IrClassDeclaration;
};

/**
 * Collect all specialization requests from a module
 * Walks the IR tree looking for calls/news with requiresSpecialization flag
 */
export const collectSpecializations = (
  module: IrModule
): readonly SpecializationRequest[] => {
  const requests: SpecializationRequest[] = [];
  const seen = new Set<string>(); // Avoid duplicates

  // Walk through all statements and expressions to find specialization needs
  for (const stmt of module.body) {
    collectFromStatement(stmt, requests, seen, module);
  }

  return requests;
};

/**
 * Collect specializations from a statement
 */
const collectFromStatement = (
  stmt: IrStatement,
  requests: SpecializationRequest[],
  seen: Set<string>,
  module: IrModule
): void => {
  switch (stmt.kind) {
    case "expressionStatement":
      collectFromExpression(stmt.expression, requests, seen, module);
      break;

    case "variableDeclaration":
      for (const decl of stmt.declarations) {
        if (decl.initializer) {
          collectFromExpression(decl.initializer, requests, seen, module);
        }
      }
      break;

    case "returnStatement":
      if (stmt.expression) {
        collectFromExpression(stmt.expression, requests, seen, module);
      }
      break;

    case "ifStatement":
      collectFromExpression(stmt.condition, requests, seen, module);
      collectFromStatement(stmt.thenStatement, requests, seen, module);
      if (stmt.elseStatement) {
        collectFromStatement(stmt.elseStatement, requests, seen, module);
      }
      break;

    case "blockStatement":
      for (const s of stmt.statements) {
        collectFromStatement(s, requests, seen, module);
      }
      break;

    case "whileStatement":
      collectFromExpression(stmt.condition, requests, seen, module);
      collectFromStatement(stmt.body, requests, seen, module);
      break;

    case "forStatement":
      if (stmt.initializer) {
        if (stmt.initializer.kind === "variableDeclaration") {
          collectFromStatement(stmt.initializer, requests, seen, module);
        } else {
          collectFromExpression(stmt.initializer, requests, seen, module);
        }
      }
      if (stmt.condition) {
        collectFromExpression(stmt.condition, requests, seen, module);
      }
      if (stmt.update) {
        collectFromExpression(stmt.update, requests, seen, module);
      }
      collectFromStatement(stmt.body, requests, seen, module);
      break;

    case "functionDeclaration":
      if (stmt.body) {
        collectFromStatement(stmt.body, requests, seen, module);
      }
      break;

    case "classDeclaration":
      for (const member of stmt.members) {
        if (member.kind === "methodDeclaration" && member.body) {
          collectFromStatement(member.body, requests, seen, module);
        }
      }
      break;

    // Other statement types don't contain expressions
    default:
      break;
  }
};

/**
 * Collect specializations from an expression
 */
const collectFromExpression = (
  expr: IrExpression,
  requests: SpecializationRequest[],
  seen: Set<string>,
  module: IrModule
): void => {
  switch (expr.kind) {
    case "call":
      // Check if this call requires specialization
      if (
        expr.requiresSpecialization &&
        expr.typeArguments &&
        expr.typeArguments.length > 0
      ) {
        // Get function name from callee
        if (expr.callee.kind === "identifier") {
          const funcName = expr.callee.name;
          const key = createSpecializationKey(funcName, expr.typeArguments);

          if (!seen.has(key)) {
            seen.add(key);

            // Find the function declaration in the module
            const funcDecl = module.body.find(
              (stmt) =>
                stmt.kind === "functionDeclaration" && stmt.name === funcName
            ) as IrFunctionDeclaration | undefined;

            if (funcDecl) {
              requests.push({
                kind: "function",
                name: funcName,
                typeArguments: expr.typeArguments,
                declaration: funcDecl,
              });
            }
          }
        }
      }

      // Recurse into callee and arguments
      collectFromExpression(expr.callee, requests, seen, module);
      for (const arg of expr.arguments) {
        if (arg.kind !== "spread") {
          collectFromExpression(arg, requests, seen, module);
        }
      }
      break;

    case "new":
      // Check if this constructor call requires specialization
      if (
        expr.requiresSpecialization &&
        expr.typeArguments &&
        expr.typeArguments.length > 0
      ) {
        if (expr.callee.kind === "identifier") {
          const className = expr.callee.name;
          const key = createSpecializationKey(className, expr.typeArguments);

          if (!seen.has(key)) {
            seen.add(key);

            // Find the class declaration in the module
            const classDecl = module.body.find(
              (stmt) =>
                stmt.kind === "classDeclaration" && stmt.name === className
            ) as IrClassDeclaration | undefined;

            if (classDecl) {
              requests.push({
                kind: "class",
                name: className,
                typeArguments: expr.typeArguments,
                declaration: classDecl,
              });
            }
          }
        }
      }

      // Recurse into callee and arguments
      collectFromExpression(expr.callee, requests, seen, module);
      for (const arg of expr.arguments) {
        if (arg.kind !== "spread") {
          collectFromExpression(arg, requests, seen, module);
        }
      }
      break;

    case "binary":
    case "logical":
      collectFromExpression(expr.left, requests, seen, module);
      collectFromExpression(expr.right, requests, seen, module);
      break;

    case "unary":
    case "update":
    case "await":
      collectFromExpression(expr.expression, requests, seen, module);
      break;

    case "assignment":
      if ("kind" in expr.left) {
        collectFromExpression(
          expr.left as IrExpression,
          requests,
          seen,
          module
        );
      }
      collectFromExpression(expr.right, requests, seen, module);
      break;

    case "conditional":
      collectFromExpression(expr.condition, requests, seen, module);
      collectFromExpression(expr.whenTrue, requests, seen, module);
      collectFromExpression(expr.whenFalse, requests, seen, module);
      break;

    case "memberAccess":
      collectFromExpression(expr.object, requests, seen, module);
      if (expr.isComputed && typeof expr.property !== "string") {
        collectFromExpression(expr.property, requests, seen, module);
      }
      break;

    case "array":
      for (const elem of expr.elements) {
        if (elem && elem.kind !== "spread") {
          collectFromExpression(elem, requests, seen, module);
        }
      }
      break;

    case "object":
      for (const prop of expr.properties) {
        if (prop.kind !== "spread") {
          collectFromExpression(prop.value, requests, seen, module);
        }
      }
      break;

    case "arrowFunction":
      if (typeof expr.body === "object" && "kind" in expr.body) {
        if (expr.body.kind === "blockStatement") {
          collectFromStatement(expr.body, requests, seen, module);
        } else {
          collectFromExpression(expr.body, requests, seen, module);
        }
      }
      break;

    case "templateLiteral":
      for (const expr2 of expr.expressions) {
        collectFromExpression(expr2, requests, seen, module);
      }
      break;

    case "spread":
      collectFromExpression(expr.expression, requests, seen, module);
      break;

    // Literals, identifiers, this - no recursion needed
    default:
      break;
  }
};

/**
 * Create a unique key for a specialization request
 */
const createSpecializationKey = (
  name: string,
  typeArgs: readonly IrType[]
): string => {
  // Simple serialization of type arguments for deduplication
  const typeStrs = typeArgs.map((t) => serializeType(t));
  return `${name}<${typeStrs.join(",")}>`;
};

/**
 * Simple type serialization for deduplication
 */
const serializeType = (type: IrType): string => {
  switch (type.kind) {
    case "primitiveType":
      return type.name;
    case "referenceType":
      if (type.typeArguments && type.typeArguments.length > 0) {
        const args = type.typeArguments.map(serializeType).join(",");
        return `${type.name}<${args}>`;
      }
      return type.name;
    case "arrayType":
      return `${serializeType(type.elementType)}[]`;
    case "literalType":
      return `literal:${type.value}`;
    default:
      return type.kind;
  }
};

/**
 * Generate specialized declarations from requests
 * Returns C# code for the specialized declarations
 */
export const generateSpecializations = (
  requests: readonly SpecializationRequest[],
  context: EmitterContext
): [string, EmitterContext] => {
  if (requests.length === 0) {
    return ["", context];
  }

  const parts: string[] = [];
  let currentContext = context;

  for (const request of requests) {
    if (request.kind === "function") {
      const [code, newContext] = generateSpecializedFunction(
        request,
        currentContext
      );
      parts.push(code);
      currentContext = newContext;
    } else if (request.kind === "class") {
      const [code, newContext] = generateSpecializedClass(
        request,
        currentContext
      );
      parts.push(code);
      currentContext = newContext;
    }
  }

  return [parts.join("\n\n"), currentContext];
};

/**
 * Generate a specialized function by substituting type parameters
 */
const generateSpecializedFunction = (
  request: SpecializationRequest,
  context: EmitterContext
): [string, EmitterContext] => {
  const funcDecl = request.declaration as IrFunctionDeclaration;

  // Create type substitution map
  const substitutions = new Map<string, IrType>();
  if (funcDecl.typeParameters) {
    funcDecl.typeParameters.forEach((tp, index) => {
      const typeArg = request.typeArguments[index];
      if (typeArg) {
        substitutions.set(tp.name, typeArg);
      }
    });
  }

  // Substitute types in the function declaration
  const specializedDecl: IrFunctionDeclaration = {
    ...funcDecl,
    name: generateSpecializedFunctionName(funcDecl.name, request.typeArguments),
    typeParameters: undefined, // Remove type parameters
    parameters: funcDecl.parameters.map((param) => ({
      ...param,
      type: param.type ? substituteType(param.type, substitutions) : undefined,
    })),
    returnType: funcDecl.returnType
      ? substituteType(funcDecl.returnType, substitutions)
      : undefined,
    body: substituteStatement(funcDecl.body, substitutions) as IrBlockStatement,
  };

  // Emit the specialized function using the statement emitter
  return emitStatement(specializedDecl, context);
};

/**
 * Generate a specialized class by substituting type parameters
 */
const generateSpecializedClass = (
  request: SpecializationRequest,
  context: EmitterContext
): [string, EmitterContext] => {
  const classDecl = request.declaration as IrClassDeclaration;

  // Create type substitution map
  const substitutions = new Map<string, IrType>();
  if (classDecl.typeParameters) {
    classDecl.typeParameters.forEach((tp, index) => {
      const typeArg = request.typeArguments[index];
      if (typeArg) {
        substitutions.set(tp.name, typeArg);
      }
    });
  }

  // Generate specialized class name
  const specializedName = generateSpecializedClassName(
    classDecl.name,
    request.typeArguments
  );

  // Substitute types in class members
  const specializedMembers = classDecl.members.map((member) => {
    if (member.kind === "propertyDeclaration") {
      return {
        ...member,
        type: member.type
          ? substituteType(member.type, substitutions)
          : undefined,
      };
    } else if (member.kind === "methodDeclaration") {
      return {
        ...member,
        parameters: member.parameters.map((param) => ({
          ...param,
          type: param.type
            ? substituteType(param.type, substitutions)
            : undefined,
        })),
        returnType: member.returnType
          ? substituteType(member.returnType, substitutions)
          : undefined,
        body: member.body
          ? (substituteStatement(
              member.body,
              substitutions
            ) as IrBlockStatement)
          : undefined,
      };
    } else if (member.kind === "constructorDeclaration") {
      return {
        ...member,
        parameters: member.parameters.map((param) => ({
          ...param,
          type: param.type
            ? substituteType(param.type, substitutions)
            : undefined,
        })),
        body: member.body
          ? (substituteStatement(
              member.body,
              substitutions
            ) as IrBlockStatement)
          : undefined,
      };
    }
    return member;
  });

  // Create specialized class declaration
  const specializedDecl: IrClassDeclaration = {
    ...classDecl,
    name: specializedName,
    typeParameters: undefined, // Remove type parameters
    members: specializedMembers,
    superClass: classDecl.superClass
      ? substituteExpression(classDecl.superClass, substitutions)
      : undefined,
    implements: classDecl.implements.map((iface) =>
      substituteType(iface, substitutions)
    ),
  };

  // Emit the specialized class using the statement emitter
  return emitStatement(specializedDecl, context);
};

/**
 * Generate specialized function name
 */
const generateSpecializedFunctionName = (
  baseName: string,
  typeArgs: readonly IrType[]
): string => {
  const typeNames = typeArgs.map((t) => {
    const serialized = serializeType(t);
    return serialized.replace(/[<>?,\s]/g, "_").replace(/\./g, "_");
  });
  return `${baseName}__${typeNames.join("__")}`;
};

/**
 * Generate specialized class name
 */
const generateSpecializedClassName = (
  baseName: string,
  typeArgs: readonly IrType[]
): string => {
  const typeNames = typeArgs.map((t) => {
    const serialized = serializeType(t);
    return serialized.replace(/[<>?,\s]/g, "_").replace(/\./g, "_");
  });
  return `${baseName}__${typeNames.join("__")}`;
};

/**
 * Substitute type parameters in an IR type
 */
const substituteType = (
  type: IrType,
  substitutions: Map<string, IrType>
): IrType => {
  switch (type.kind) {
    case "referenceType":
      // Check if this is a type parameter that needs substitution
      if (substitutions.has(type.name)) {
        const substituted = substitutions.get(type.name);
        if (substituted) {
          return substituted;
        }
      }

      // Recursively substitute in type arguments
      if (type.typeArguments && type.typeArguments.length > 0) {
        return {
          ...type,
          typeArguments: type.typeArguments.map((arg) =>
            substituteType(arg, substitutions)
          ),
        };
      }

      return type;

    case "arrayType":
      return {
        ...type,
        elementType: substituteType(type.elementType, substitutions),
      };

    case "functionType":
      return {
        ...type,
        parameters: type.parameters.map((param) => {
          const substitutedType = param.type
            ? substituteType(param.type, substitutions)
            : param.type;
          return {
            ...param,
            type: substitutedType,
          };
        }),
        returnType: type.returnType
          ? substituteType(type.returnType, substitutions)
          : type.returnType,
      };

    case "unionType":
      return {
        ...type,
        types: type.types.map((t) => substituteType(t, substitutions)),
      };

    case "intersectionType":
      return {
        ...type,
        types: type.types.map((t) => substituteType(t, substitutions)),
      };

    // Primitive types, literal types, etc. don't need substitution
    default:
      return type;
  }
};

/**
 * Substitute type parameters in a statement
 */
const substituteStatement = (
  stmt: IrStatement,
  substitutions: Map<string, IrType>
): IrStatement => {
  switch (stmt.kind) {
    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((s) =>
          substituteStatement(s, substitutions)
        ),
      };

    case "returnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? substituteExpression(stmt.expression, substitutions)
          : undefined,
      };

    case "expressionStatement":
      return {
        ...stmt,
        expression: substituteExpression(stmt.expression, substitutions),
      };

    case "variableDeclaration":
      return {
        ...stmt,
        declarations: stmt.declarations.map((decl) => ({
          ...decl,
          initializer: decl.initializer
            ? substituteExpression(decl.initializer, substitutions)
            : undefined,
        })),
      };

    case "ifStatement":
      return {
        ...stmt,
        condition: substituteExpression(stmt.condition, substitutions),
        thenStatement: substituteStatement(stmt.thenStatement, substitutions),
        elseStatement: stmt.elseStatement
          ? substituteStatement(stmt.elseStatement, substitutions)
          : undefined,
      };

    // For other statement types, return as-is for now
    default:
      return stmt;
  }
};

/**
 * Substitute type parameters in an expression
 */
const substituteExpression = (
  expr: IrExpression,
  substitutions: Map<string, IrType>
): IrExpression => {
  switch (expr.kind) {
    case "call":
      return {
        ...expr,
        callee: substituteExpression(expr.callee, substitutions),
        arguments: expr.arguments.map((arg) =>
          arg.kind === "spread"
            ? {
                ...arg,
                expression: substituteExpression(arg.expression, substitutions),
              }
            : substituteExpression(arg, substitutions)
        ),
        typeArguments: expr.typeArguments
          ? expr.typeArguments.map((arg) => substituteType(arg, substitutions))
          : undefined,
      };

    case "memberAccess":
      return {
        ...expr,
        object: substituteExpression(expr.object, substitutions),
        property:
          typeof expr.property === "string"
            ? expr.property
            : substituteExpression(expr.property, substitutions),
      };

    case "binary":
      return {
        ...expr,
        left: substituteExpression(expr.left, substitutions),
        right: substituteExpression(expr.right, substitutions),
      };

    case "unary":
      return {
        ...expr,
        expression: substituteExpression(expr.expression, substitutions),
      };

    // For other expressions, return as-is
    default:
      return expr;
  }
};
