/**
 * Type parameter substitution for specialization
 */

import { IrType, IrStatement, IrExpression } from "@tsonic/frontend";

/**
 * Substitute type parameters in an IR type
 */
export const substituteType = (
  type: IrType,
  substitutions: Map<string, IrType>
): IrType => {
  switch (type.kind) {
    case "typeParameterType": {
      const substituted = substitutions.get(type.name);
      return substituted ?? type;
    }

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
export const substituteStatement = (
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

    case "generatorReturnStatement":
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
export const substituteExpression = (
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
