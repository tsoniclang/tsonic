/**
 * Anonymous Type IR Rewriting -- expression, statement, block, variable-
 * declaration, and class-member lowering. Mutual recursion with
 * anon-type-lower-types.ts (circular import safe: const arrow functions).
 */
import type {
  IrType,
  IrInterfaceMember,
  IrReferenceType,
  IrExpression,
  IrClassMember,
  IrBlockStatement,
  IrVariableDeclaration,
  IrStatement,
} from "../types.js";
import { stripNullishFromType } from "./anon-type-shape-analysis.js";
import { getOrCreateBehavioralObjectTypeName } from "./anon-type-declaration-synthesis.js";
export type { LoweringContext } from "./anon-type-lower-types.js";
import type { LoweringContext } from "./anon-type-lower-types.js";
import {
  lowerType,
  lowerParameter,
  lowerTypeParameter,
  lowerInterfaceMember,
  lowerPattern,
} from "./anon-type-lower-types.js";

/** Lower an expression */
export const lowerExpression = (
  expr: IrExpression,
  ctx: LoweringContext
): IrExpression => {
  const lowered: IrExpression = (() => {
    switch (expr.kind) {
      case "literal":
      case "this":
        return expr;

      case "identifier": {
        // IMPORTANT: Only lower inferredType for identifiers that refer to a real declaration
        // (locals/parameters). Imported CLR symbols often carry placeholder inferred types
        // that are not part of emission and must not trigger anonymous type synthesis.
        if (!expr.declId || !expr.inferredType) return expr;
        if (expr.resolvedClrType || expr.resolvedAssembly || expr.importedFrom)
          return expr;
        // Treat empty object types (`{}`) as `object`-like placeholders; do not synthesize.
        if (
          expr.inferredType.kind === "objectType" &&
          expr.inferredType.members.length === 0
        ) {
          return expr;
        }
        const loweredInferred = lowerType(expr.inferredType, ctx);
        return loweredInferred === expr.inferredType
          ? expr
          : { ...expr, inferredType: loweredInferred };
      }

      case "array":
        return {
          ...expr,
          inferredType: expr.inferredType
            ? lowerType(expr.inferredType, ctx)
            : undefined,
          elements: expr.elements.map((e) =>
            e ? lowerExpression(e, ctx) : undefined
          ),
        };

      case "object": {
        const rawContextualType = expr.contextualType;
        const rawInferredType = expr.inferredType;
        const objectTypeForBehavior = (() => {
          if (
            rawContextualType?.kind === "objectType" &&
            rawContextualType.members.length > 0
          ) {
            return rawContextualType;
          }
          if (
            rawInferredType?.kind === "objectType" &&
            rawInferredType.members.length > 0
          ) {
            return rawInferredType;
          }
          return undefined;
        })();

        const loweredBehaviorMembers = expr.behaviorMembers?.map((member) =>
          lowerClassMember(member, ctx)
        );
        const behaviorTypeName =
          objectTypeForBehavior &&
          loweredBehaviorMembers &&
          loweredBehaviorMembers.length > 0
            ? getOrCreateBehavioralObjectTypeName(
                objectTypeForBehavior,
                loweredBehaviorMembers,
                expr.sourceSpan,
                ctx
              )
            : undefined;
        const loweredBehaviorType =
          behaviorTypeName !== undefined
            ? ({
                kind: "referenceType",
                name: behaviorTypeName,
              } satisfies IrReferenceType)
            : undefined;

        return {
          ...expr,
          behaviorMembers:
            loweredBehaviorMembers && loweredBehaviorMembers.length > 0
              ? loweredBehaviorMembers
              : undefined,
          inferredType: loweredBehaviorType
            ? loweredBehaviorType
            : expr.inferredType
              ? lowerType(expr.inferredType, ctx)
              : undefined,
          contextualType: loweredBehaviorType
            ? loweredBehaviorType
            : expr.contextualType
              ? lowerType(expr.contextualType, ctx)
              : undefined,
          properties: expr.properties.map((p) => {
            if (p.kind === "property") {
              return {
                ...p,
                key:
                  typeof p.key === "string"
                    ? p.key
                    : lowerExpression(p.key, ctx),
                value: lowerExpression(p.value, ctx),
              };
            } else {
              return {
                ...p,
                expression: lowerExpression(p.expression, ctx),
              };
            }
          }),
        };
      }

      case "functionExpression": {
        const loweredParams = expr.parameters.map((p) =>
          lowerParameter(p, ctx)
        );
        const loweredReturnType = expr.returnType
          ? lowerType(expr.returnType, ctx)
          : undefined;
        const bodyCtx: LoweringContext = {
          ...ctx,
          currentFunctionReturnType: loweredReturnType,
        };
        const loweredInferredType =
          expr.inferredType?.kind === "functionType"
            ? {
                ...expr.inferredType,
                parameters: loweredParams,
                returnType:
                  loweredReturnType ??
                  lowerType(expr.inferredType.returnType, ctx),
              }
            : expr.inferredType;
        return {
          ...expr,
          parameters: loweredParams,
          returnType: loweredReturnType,
          body: lowerBlockStatement(expr.body, bodyCtx),
          inferredType: loweredInferredType,
        };
      }

      case "arrowFunction": {
        const loweredParams = expr.parameters.map((p) =>
          lowerParameter(p, ctx)
        );
        const loweredReturnType = expr.returnType
          ? lowerType(expr.returnType, ctx)
          : undefined;
        const bodyCtx: LoweringContext = {
          ...ctx,
          currentFunctionReturnType: loweredReturnType,
        };
        const loweredInferredType =
          expr.inferredType?.kind === "functionType"
            ? {
                ...expr.inferredType,
                parameters: loweredParams,
                returnType:
                  loweredReturnType ??
                  lowerType(expr.inferredType.returnType, ctx),
              }
            : expr.inferredType;
        // For expression body arrow functions, we need to handle inferredType directly
        if (expr.body.kind === "blockStatement") {
          return {
            ...expr,
            parameters: loweredParams,
            returnType: loweredReturnType,
            body: lowerBlockStatement(expr.body, bodyCtx),
            inferredType: loweredInferredType,
          };
        } else {
          const loweredBody = lowerExpression(expr.body, ctx);
          // If arrow has expression body and return type, propagate to expression's inferredType
          const bodyWithType =
            loweredReturnType && loweredBody.inferredType?.kind === "objectType"
              ? { ...loweredBody, inferredType: loweredReturnType }
              : loweredBody;
          return {
            ...expr,
            parameters: loweredParams,
            returnType: loweredReturnType,
            body: bodyWithType,
            inferredType: loweredInferredType,
          };
        }
      }

      case "memberAccess":
        return {
          ...expr,
          object: lowerExpression(expr.object, ctx),
          property:
            typeof expr.property === "string"
              ? expr.property
              : lowerExpression(expr.property, ctx),
        };

      case "call":
        return {
          ...expr,
          callee: lowerExpression(expr.callee, ctx),
          arguments: expr.arguments.map((a) => lowerExpression(a, ctx)),
          dynamicImportNamespace: expr.dynamicImportNamespace
            ? (lowerExpression(expr.dynamicImportNamespace, ctx) as Extract<
                typeof expr.dynamicImportNamespace,
                { kind: "object" }
              >)
            : undefined,
          typeArguments: expr.typeArguments?.map((ta) => lowerType(ta, ctx)),
          // parameterTypes participate in expected-type threading during emission
          // (e.g., object literal contextual typing). They must be lowered so
          // IrObjectType never leaks into the emitter.
          parameterTypes: expr.parameterTypes?.map((pt) =>
            pt ? lowerType(pt, ctx) : undefined
          ),
          surfaceParameterTypes: expr.surfaceParameterTypes?.map((pt) =>
            pt ? lowerType(pt, ctx) : undefined
          ),
          surfaceRestParameter: expr.surfaceRestParameter
            ? {
                ...expr.surfaceRestParameter,
                arrayType: expr.surfaceRestParameter.arrayType
                  ? lowerType(expr.surfaceRestParameter.arrayType, ctx)
                  : undefined,
                elementType: expr.surfaceRestParameter.elementType
                  ? lowerType(expr.surfaceRestParameter.elementType, ctx)
                  : undefined,
              }
            : undefined,
          narrowing: expr.narrowing
            ? {
                ...expr.narrowing,
                targetType: lowerType(expr.narrowing.targetType, ctx),
              }
            : undefined,
        };

      case "new":
        return {
          ...expr,
          callee: lowerExpression(expr.callee, ctx),
          arguments: expr.arguments.map((a) => lowerExpression(a, ctx)),
          typeArguments: expr.typeArguments?.map((ta) => lowerType(ta, ctx)),
          parameterTypes: expr.parameterTypes?.map((pt) =>
            pt ? lowerType(pt, ctx) : undefined
          ),
          surfaceParameterTypes: expr.surfaceParameterTypes?.map((pt) =>
            pt ? lowerType(pt, ctx) : undefined
          ),
          surfaceRestParameter: expr.surfaceRestParameter
            ? {
                ...expr.surfaceRestParameter,
                arrayType: expr.surfaceRestParameter.arrayType
                  ? lowerType(expr.surfaceRestParameter.arrayType, ctx)
                  : undefined,
                elementType: expr.surfaceRestParameter.elementType
                  ? lowerType(expr.surfaceRestParameter.elementType, ctx)
                  : undefined,
              }
            : undefined,
        };

      case "update":
      case "unary":
      case "await":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
        };

      case "yield":
        return {
          ...expr,
          expression: expr.expression
            ? lowerExpression(expr.expression, ctx)
            : undefined,
        };

      case "binary":
      case "logical":
        return {
          ...expr,
          left: lowerExpression(expr.left, ctx),
          right: lowerExpression(expr.right, ctx),
        };

      case "conditional":
        return {
          ...expr,
          condition: lowerExpression(expr.condition, ctx),
          whenTrue: lowerExpression(expr.whenTrue, ctx),
          whenFalse: lowerExpression(expr.whenFalse, ctx),
        };

      case "assignment":
        return {
          ...expr,
          left:
            expr.left.kind === "identifierPattern" ||
            expr.left.kind === "arrayPattern" ||
            expr.left.kind === "objectPattern"
              ? lowerPattern(expr.left, ctx)
              : lowerExpression(expr.left, ctx),
          right: lowerExpression(expr.right, ctx),
        };

      case "templateLiteral":
        return {
          ...expr,
          expressions: expr.expressions.map((e) => lowerExpression(e, ctx)),
        };

      case "spread":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
        };

      case "numericNarrowing":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "typeAssertion":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "asinterface":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "trycast":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "stackalloc":
        return {
          ...expr,
          elementType: lowerType(expr.elementType, ctx),
          size: lowerExpression(expr.size, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "defaultof":
        return {
          ...expr,
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "nameof":
        return expr;

      case "sizeof":
        return {
          ...expr,
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };
    }
  })();

  // Lower inferred/contextual metadata for all expression kinds so objectType
  // cannot leak through metadata-only paths (e.g. call/member inferredType).
  // Identifier expressions are handled explicitly above to avoid rewriting
  // imported CLR/global placeholders.
  if (lowered.kind !== "identifier") {
    let nextExpr: IrExpression = lowered;
    const inferredType = nextExpr.inferredType;
    if (
      inferredType &&
      !(inferredType.kind === "objectType" && inferredType.members.length === 0)
    ) {
      const loweredInferred = lowerType(inferredType, ctx);
      if (loweredInferred !== inferredType) {
        nextExpr = { ...nextExpr, inferredType: loweredInferred };
      }
    }

    if ("contextualType" in nextExpr) {
      const contextualExpr = nextExpr as IrExpression & {
        contextualType?: IrType;
      };
      const contextualType = contextualExpr.contextualType;
      if (
        contextualType &&
        !(
          contextualType.kind === "objectType" &&
          contextualType.members.length === 0
        )
      ) {
        const loweredContextual = lowerType(contextualType, ctx);
        if (loweredContextual !== contextualType) {
          nextExpr = {
            ...contextualExpr,
            contextualType: loweredContextual,
          } as IrExpression;
        }
      }
    }
    return nextExpr;
  }

  return lowered;
};

/** Lower a block statement specifically (for places that need IrBlockStatement) */
export const lowerBlockStatement = (
  stmt: IrBlockStatement,
  ctx: LoweringContext
): IrBlockStatement => {
  return {
    ...stmt,
    statements: stmt.statements.map((s) => lowerStatement(s, ctx)),
  };
};

/** Lower a variable declaration specifically (for forStatement initializer) */
export const lowerVariableDeclaration = (
  stmt: IrVariableDeclaration,
  ctx: LoweringContext
): IrVariableDeclaration => {
  return {
    ...stmt,
    declarations: stmt.declarations.map((d) => ({
      ...d,
      name: lowerPattern(d.name, ctx),
      type: d.type ? lowerType(d.type, ctx) : undefined,
      initializer: d.initializer
        ? lowerExpression(d.initializer, ctx)
        : undefined,
    })),
  };
};

/** Lower a class member */
export const lowerClassMember = (
  member: IrClassMember,
  ctx: LoweringContext
): IrClassMember => {
  switch (member.kind) {
    case "methodDeclaration": {
      const loweredReturnType = member.returnType
        ? lowerType(member.returnType, ctx)
        : undefined;
      const bodyCtx: LoweringContext = {
        ...ctx,
        currentFunctionReturnType: loweredReturnType,
      };
      return {
        ...member,
        typeParameters: member.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        parameters: member.parameters.map((p) => lowerParameter(p, ctx)),
        returnType: loweredReturnType,
        body: member.body
          ? lowerBlockStatement(member.body, bodyCtx)
          : undefined,
      };
    }
    case "propertyDeclaration":
      return {
        ...member,
        type: member.type
          ? lowerType(member.type, ctx, member.name)
          : undefined,
        initializer: member.initializer
          ? lowerExpression(member.initializer, ctx)
          : undefined,
        getterBody: member.getterBody
          ? lowerBlockStatement(member.getterBody, ctx)
          : undefined,
        setterBody: member.setterBody
          ? lowerBlockStatement(member.setterBody, ctx)
          : undefined,
      };
    case "constructorDeclaration":
      return {
        ...member,
        parameters: member.parameters.map((p) => lowerParameter(p, ctx)),
        body: member.body ? lowerBlockStatement(member.body, ctx) : undefined,
      };
  }
};

/** Lower a statement */
export const lowerStatement = (
  stmt: IrStatement,
  ctx: LoweringContext
): IrStatement => {
  switch (stmt.kind) {
    case "variableDeclaration":
      return {
        ...stmt,
        declarations: stmt.declarations.map((d) => ({
          ...d,
          name: lowerPattern(d.name, ctx),
          type: d.type ? lowerType(d.type, ctx) : undefined,
          initializer: d.initializer
            ? lowerExpression(d.initializer, ctx)
            : undefined,
        })),
      };

    case "functionDeclaration": {
      // First lower the return type
      const loweredReturnType = stmt.returnType
        ? lowerType(stmt.returnType, ctx)
        : undefined;
      // Create context with the lowered return type for return statements
      const bodyCtx: LoweringContext = {
        ...ctx,
        currentFunctionReturnType: loweredReturnType,
      };
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        parameters: stmt.parameters.map((p) => lowerParameter(p, ctx)),
        returnType: loweredReturnType,
        body: lowerBlockStatement(stmt.body, bodyCtx),
      };
    }

    case "classDeclaration":
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        superClass: stmt.superClass
          ? lowerType(stmt.superClass, ctx)
          : undefined,
        implements: stmt.implements.map((i) => lowerType(i, ctx)),
        members: stmt.members.map((m) => lowerClassMember(m, ctx)),
      };

    case "interfaceDeclaration":
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        extends: stmt.extends.map((e) => lowerType(e, ctx)),
        members: stmt.members.map((m) => lowerInterfaceMember(m, ctx)),
      };

    case "enumDeclaration":
      return {
        ...stmt,
        members: stmt.members.map((m) => ({
          ...m,
          initializer: m.initializer
            ? lowerExpression(m.initializer, ctx)
            : undefined,
        })),
      };

    case "typeAliasDeclaration":
      // IMPORTANT: Do NOT lower the top-level objectType in a type alias declaration.
      // The emitter already generates a class with __Alias suffix for these.
      // We only lower nested objectTypes within the members.
      if (stmt.type.kind === "objectType") {
        // Lower nested types within the object type's members, but keep objectType as-is
        const loweredMembers: IrInterfaceMember[] = stmt.type.members.map(
          (m) => {
            if (m.kind === "propertySignature") {
              return {
                ...m,
                type: lowerType(m.type, ctx),
              };
            } else if (m.kind === "methodSignature") {
              return {
                ...m,
                parameters: m.parameters.map((p) => lowerParameter(p, ctx)),
                returnType: m.returnType
                  ? lowerType(m.returnType, ctx)
                  : undefined,
              };
            }
            return m;
          }
        );

        return {
          ...stmt,
          typeParameters: stmt.typeParameters?.map((tp) =>
            lowerTypeParameter(tp, ctx)
          ),
          type: {
            ...stmt.type,
            members: loweredMembers,
          },
        };
      }

      // For non-objectType type aliases, lower the type normally
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((tp) =>
          lowerTypeParameter(tp, ctx)
        ),
        type: lowerType(stmt.type, ctx),
      };

    case "expressionStatement":
      return {
        ...stmt,
        expression: lowerExpression(stmt.expression, ctx),
      };

    case "returnStatement": {
      if (!stmt.expression) {
        return stmt;
      }
      const loweredExpr = lowerExpression(stmt.expression, ctx);
      // If we have a function return type and the expression's inferredType is objectType,
      // replace it with the lowered type (stripping nullish from union if needed)
      if (
        ctx.currentFunctionReturnType &&
        loweredExpr.inferredType?.kind === "objectType"
      ) {
        // Extract non-nullish part of return type (e.g., { title: string } from { title: string } | undefined)
        const targetType = stripNullishFromType(ctx.currentFunctionReturnType);
        return {
          ...stmt,
          expression: { ...loweredExpr, inferredType: targetType },
        };
      }
      return {
        ...stmt,
        expression: loweredExpr,
      };
    }

    case "ifStatement":
      return {
        ...stmt,
        condition: lowerExpression(stmt.condition, ctx),
        thenStatement: lowerStatement(stmt.thenStatement, ctx),
        elseStatement: stmt.elseStatement
          ? lowerStatement(stmt.elseStatement, ctx)
          : undefined,
      };

    case "whileStatement":
      return {
        ...stmt,
        condition: lowerExpression(stmt.condition, ctx),
        body: lowerStatement(stmt.body, ctx),
      };

    case "forStatement":
      return {
        ...stmt,
        initializer: stmt.initializer
          ? stmt.initializer.kind === "variableDeclaration"
            ? lowerVariableDeclaration(stmt.initializer, ctx)
            : lowerExpression(stmt.initializer, ctx)
          : undefined,
        condition: stmt.condition
          ? lowerExpression(stmt.condition, ctx)
          : undefined,
        update: stmt.update ? lowerExpression(stmt.update, ctx) : undefined,
        body: lowerStatement(stmt.body, ctx),
      };

    case "forOfStatement":
      return {
        ...stmt,
        variable: lowerPattern(stmt.variable, ctx),
        expression: lowerExpression(stmt.expression, ctx),
        body: lowerStatement(stmt.body, ctx),
      };

    case "forInStatement":
      return {
        ...stmt,
        variable: lowerPattern(stmt.variable, ctx),
        expression: lowerExpression(stmt.expression, ctx),
        body: lowerStatement(stmt.body, ctx),
      };

    case "switchStatement":
      return {
        ...stmt,
        expression: lowerExpression(stmt.expression, ctx),
        cases: stmt.cases.map((c) => ({
          ...c,
          test: c.test ? lowerExpression(c.test, ctx) : undefined,
          statements: c.statements.map((s) => lowerStatement(s, ctx)),
        })),
      };

    case "throwStatement":
      return {
        ...stmt,
        expression: lowerExpression(stmt.expression, ctx),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: lowerBlockStatement(stmt.tryBlock, ctx),
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              parameter: stmt.catchClause.parameter
                ? lowerPattern(stmt.catchClause.parameter, ctx)
                : undefined,
              body: lowerBlockStatement(stmt.catchClause.body, ctx),
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? lowerBlockStatement(stmt.finallyBlock, ctx)
          : undefined,
      };

    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((s) => lowerStatement(s, ctx)),
      };

    case "yieldStatement":
      return {
        ...stmt,
        output: stmt.output ? lowerExpression(stmt.output, ctx) : undefined,
        receiveTarget: stmt.receiveTarget
          ? lowerPattern(stmt.receiveTarget, ctx)
          : undefined,
        receivedType: stmt.receivedType
          ? lowerType(stmt.receivedType, ctx)
          : undefined,
      };

    case "generatorReturnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? lowerExpression(stmt.expression, ctx)
          : undefined,
      };

    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      return stmt;
  }
};
