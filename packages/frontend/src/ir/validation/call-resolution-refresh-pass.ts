import type { ProgramContext } from "../program-context.js";
import {
  IrExpression,
  IrModule,
  IrStatement,
} from "../types.js";
import {
  collectResolutionArguments,
  resolveCallableCandidate,
} from "../converters/expressions/calls/call-resolution.js";
import { getBoundGlobalCallParameterTypes } from "../converters/expressions/calls/bound-global-call-parameters.js";
import {
  finalizeInvocationMetadata,
  getAuthoritativeDirectCalleeParameterTypes,
  getDirectStructuralMemberType,
} from "../converters/expressions/calls/invocation-finalization.js";

export type CallResolutionRefreshResult = {
  readonly ok: true;
  readonly modules: readonly IrModule[];
};

const preserveResolvedReturnType = (
  current: IrExpression["inferredType"],
  next: IrExpression["inferredType"],
  hasDeclaredReturnType: boolean | undefined
): IrExpression["inferredType"] => {
  const nextIsBroadOrVoid =
    next?.kind === "voidType" ||
    next?.kind === "unknownType" ||
    next?.kind === "anyType";
  const currentIsConcrete =
    current &&
    current.kind !== "voidType" &&
    current.kind !== "unknownType" &&
    current.kind !== "anyType";

  if (currentIsConcrete && nextIsBroadOrVoid) {
    return current;
  }

  if (
    hasDeclaredReturnType === false &&
    current &&
    next &&
    nextIsBroadOrVoid
  ) {
    return current;
  }

  return next ?? current;
};

const refreshSpreadArgument = (
  argument: Extract<IrExpression, { kind: "array" }>["elements"][number],
  ctx: ProgramContext
) =>
  argument?.kind === "spread"
    ? (() => {
        const expression = refreshExpression(argument.expression, ctx);
        return {
          ...argument,
          expression,
          inferredType: expression.inferredType,
        };
      })()
    : argument
      ? refreshExpression(argument, ctx)
      : argument;

const refreshExpression = (
  expr: IrExpression,
  ctx: ProgramContext
): IrExpression => {
  switch (expr.kind) {
    case "call": {
      const callee = refreshExpression(expr.callee, ctx);
      const arguments_ = expr.arguments.map((argument) =>
        argument.kind === "spread"
          ? (() => {
              const expression = refreshExpression(argument.expression, ctx);
              return {
                ...argument,
                expression,
                inferredType: expression.inferredType,
              };
            })()
          : refreshExpression(argument, ctx)
      );

      const dynamicImportNamespace = expr.dynamicImportNamespace
        ? (refreshExpression(
            expr.dynamicImportNamespace,
            ctx
          ) as typeof expr.dynamicImportNamespace)
        : undefined;

      if (callee.kind === "identifier" && callee.name === "super") {
        return {
          ...expr,
          callee,
          arguments: arguments_,
          dynamicImportNamespace,
        };
      }

      if (!expr.signatureId) {
        return {
          ...expr,
          callee,
          arguments: arguments_,
          dynamicImportNamespace,
        };
      }

      const resolutionArgs = collectResolutionArguments(arguments_);
      const argumentCount =
        resolutionArgs.argumentCount > 0
          ? resolutionArgs.argumentCount
          : arguments_.length;
      const argTypes =
        resolutionArgs.argumentCount > 0
          ? resolutionArgs.argTypes
          : arguments_.map((argument) =>
              argument.kind === "spread" ? undefined : argument.inferredType
            );
      const selection = ctx.typeSystem.selectBestCallCandidate(
        expr.signatureId,
        expr.candidateSignatureIds,
        {
          argumentCount,
          receiverType:
            callee.kind === "memberAccess" ? callee.object.inferredType : undefined,
          explicitTypeArgs: expr.typeArguments,
          argTypes,
          expectedReturnType: expr.resolutionExpectedReturnType,
        }
      );
      const resolved = selection.resolved;
      const usesAuthoritativeSurfaceBindings = ctx.surface !== "clr";
      const boundGlobalCallParameterTypes = getBoundGlobalCallParameterTypes(
        callee,
        argumentCount,
        ctx
      );
      const authoritativeBoundGlobalSurfaceParameterTypes =
        usesAuthoritativeSurfaceBindings
        ? boundGlobalCallParameterTypes?.parameterTypes
        : undefined;
      const authoritativeBoundGlobalReturnType =
        usesAuthoritativeSurfaceBindings
          ? boundGlobalCallParameterTypes?.returnType
          : undefined;
      const preservedAmbientBoundGlobalSurfaceParameterTypes =
        !usesAuthoritativeSurfaceBindings && boundGlobalCallParameterTypes
          ? expr.surfaceParameterTypes
          : undefined;
      const directStructuralResolution =
        callee.kind === "memberAccess" && typeof callee.property === "string"
          ? (() => {
              const directStructuralMemberType = getDirectStructuralMemberType(
                callee.object.inferredType,
                callee.property
              );
              return directStructuralMemberType
                ? resolveCallableCandidate(
                    directStructuralMemberType,
                    argumentCount,
                    ctx,
                    argTypes,
                    expr.typeArguments,
                    expr.resolutionExpectedReturnType
                  )
                : undefined;
            })()
          : undefined;
      const directCalleeResolution =
        callee.inferredType && callee.inferredType.kind !== "unknownType"
          ? resolveCallableCandidate(
              callee.inferredType,
              argumentCount,
              ctx,
              argTypes,
              expr.typeArguments,
              expr.resolutionExpectedReturnType
            )
          : undefined;
      const authoritativeDirectCalleeParameterTypes =
        getAuthoritativeDirectCalleeParameterTypes(callee, argumentCount, ctx);
      const preserveAuthoritativeDirectCalleeSurfaceIdentity =
        !!authoritativeDirectCalleeParameterTypes &&
        !authoritativeBoundGlobalSurfaceParameterTypes &&
        !expr.sourceBackedSurfaceParameterTypes &&
        !preservedAmbientBoundGlobalSurfaceParameterTypes;
      const finalizedInvocationMetadata = finalizeInvocationMetadata({
        ctx,
        callee,
        receiverType:
          callee.kind === "memberAccess" ? callee.object.inferredType : undefined,
        callableType:
          directStructuralResolution?.callableType ??
          directCalleeResolution?.callableType ??
          (callee.inferredType?.kind === "functionType"
            ? callee.inferredType
            : undefined),
        argumentCount,
        argTypes,
        explicitTypeArgs: expr.typeArguments,
        expectedType: expr.resolutionExpectedReturnType,
        boundGlobalParameterTypes: boundGlobalCallParameterTypes?.parameterTypes,
        authoritativeBoundGlobalSurfaceParameterTypes,
        authoritativeBoundGlobalReturnType,
        sourceBackedParameterTypes: expr.sourceBackedParameterTypes,
        sourceBackedSurfaceParameterTypes: expr.sourceBackedSurfaceParameterTypes,
        sourceBackedReturnType: expr.sourceBackedReturnType,
        ambientBoundGlobalSurfaceParameterTypes:
          preservedAmbientBoundGlobalSurfaceParameterTypes,
        authoritativeDirectParameterTypes: authoritativeDirectCalleeParameterTypes,
        resolvedParameterTypes: resolved?.parameterTypes,
        resolvedSurfaceParameterTypes: resolved?.surfaceParameterTypes,
        resolvedReturnType: resolved?.returnType,
        fallbackParameterTypes: expr.parameterTypes,
        fallbackSurfaceParameterTypes: expr.surfaceParameterTypes,
        exactParameterCandidates: [
          directStructuralResolution?.resolved?.parameterTypes,
          directCalleeResolution?.resolved?.parameterTypes,
        ],
        exactSurfaceParameterCandidates: [
          directStructuralResolution?.resolved?.surfaceParameterTypes ??
            directStructuralResolution?.resolved?.parameterTypes,
          directCalleeResolution?.resolved?.surfaceParameterTypes ??
            directCalleeResolution?.resolved?.parameterTypes,
        ],
        exactReturnCandidates: [
          directStructuralResolution?.resolved?.returnType,
          directCalleeResolution?.resolved?.returnType,
        ],
        preserveDirectSurfaceIdentity:
          preserveAuthoritativeDirectCalleeSurfaceIdentity,
      });
      const refreshedRestParameter = boundGlobalCallParameterTypes
        ? boundGlobalCallParameterTypes.restParameter
        : expr.sourceBackedRestParameter ??
          resolved?.restParameter ??
          expr.restParameter;
      const refreshedSurfaceRestParameter = boundGlobalCallParameterTypes
        ? boundGlobalCallParameterTypes.restParameter
        : expr.sourceBackedRestParameter ??
          resolved?.surfaceRestParameter ??
          expr.surfaceRestParameter;

      return {
        ...expr,
        callee,
        arguments: arguments_,
        dynamicImportNamespace,
        inferredType: preserveResolvedReturnType(
          expr.inferredType,
          finalizedInvocationMetadata.sourceBackedReturnType ?? resolved?.returnType,
          resolved?.hasDeclaredReturnType
        ),
        parameterTypes: finalizedInvocationMetadata.parameterTypes,
        surfaceParameterTypes: finalizedInvocationMetadata.surfaceParameterTypes,
        restParameter:
          refreshedRestParameter,
        surfaceRestParameter:
          refreshedSurfaceRestParameter,
        sourceBackedParameterTypes:
          finalizedInvocationMetadata.sourceBackedParameterTypes,
        sourceBackedSurfaceParameterTypes:
          finalizedInvocationMetadata.sourceBackedSurfaceParameterTypes,
        sourceBackedReturnType:
          finalizedInvocationMetadata.sourceBackedReturnType,
      };
    }

    case "new": {
      const callee = refreshExpression(expr.callee, ctx);
      const arguments_ = expr.arguments.map((argument) =>
        argument.kind === "spread"
          ? (() => {
              const expression = refreshExpression(argument.expression, ctx);
              return {
                ...argument,
                expression,
                inferredType: expression.inferredType,
              };
            })()
          : refreshExpression(argument, ctx)
      );

      if (!expr.signatureId) {
        return {
          ...expr,
          callee,
          arguments: arguments_,
        };
      }

      const argTypes = arguments_.map((argument) =>
        argument.kind === "spread" ? undefined : argument.inferredType
      );
      const resolved = ctx.typeSystem.resolveCall({
        sigId: expr.signatureId,
        argumentCount: arguments_.length,
        explicitTypeArgs: expr.typeArguments,
        argTypes,
        expectedReturnType: expr.resolutionExpectedReturnType,
      });
      const finalizedInvocationMetadata = finalizeInvocationMetadata({
        ctx,
        callee,
        receiverType:
          callee.kind === "memberAccess" ? callee.object.inferredType : undefined,
        callableType:
          callee.inferredType?.kind === "functionType"
            ? callee.inferredType
            : undefined,
        argumentCount: arguments_.length,
        argTypes,
        explicitTypeArgs: expr.typeArguments,
        expectedType: expr.resolutionExpectedReturnType,
        boundGlobalParameterTypes: undefined,
        authoritativeBoundGlobalSurfaceParameterTypes: undefined,
        authoritativeBoundGlobalReturnType: undefined,
        sourceBackedParameterTypes: undefined,
        sourceBackedSurfaceParameterTypes: undefined,
        sourceBackedReturnType: undefined,
        ambientBoundGlobalSurfaceParameterTypes: undefined,
        authoritativeDirectParameterTypes: undefined,
        resolvedParameterTypes: resolved.parameterTypes,
        resolvedSurfaceParameterTypes: resolved.surfaceParameterTypes,
        resolvedReturnType: resolved.returnType,
        fallbackParameterTypes: expr.parameterTypes,
        fallbackSurfaceParameterTypes: expr.surfaceParameterTypes,
        exactParameterCandidates: [],
        exactSurfaceParameterCandidates: [],
        exactReturnCandidates: [],
        preserveDirectSurfaceIdentity: false,
      });

      return {
        ...expr,
        callee,
        arguments: arguments_,
        inferredType:
          finalizedInvocationMetadata.sourceBackedReturnType ??
          resolved.returnType ??
          expr.inferredType,
        parameterTypes:
          finalizedInvocationMetadata.parameterTypes ?? expr.parameterTypes,
        surfaceParameterTypes:
          finalizedInvocationMetadata.surfaceParameterTypes ??
          expr.surfaceParameterTypes,
        surfaceRestParameter:
          resolved.surfaceRestParameter ?? expr.surfaceRestParameter,
      };
    }

    case "memberAccess":
      return {
        ...expr,
        object: refreshExpression(expr.object, ctx),
        property:
          typeof expr.property === "string"
            ? expr.property
            : refreshExpression(expr.property, ctx),
      };

    case "binary":
    case "logical":
      return {
        ...expr,
        left: refreshExpression(expr.left, ctx),
        right: refreshExpression(expr.right, ctx),
      };

    case "conditional":
      return {
        ...expr,
        condition: refreshExpression(expr.condition, ctx),
        whenTrue: refreshExpression(expr.whenTrue, ctx),
        whenFalse: refreshExpression(expr.whenFalse, ctx),
      };

    case "assignment":
      return {
        ...expr,
        left:
          expr.left.kind === "identifierPattern" ||
          expr.left.kind === "arrayPattern" ||
          expr.left.kind === "objectPattern"
            ? expr.left
            : refreshExpression(expr.left, ctx),
        right: refreshExpression(expr.right, ctx),
      };

    case "await":
    case "unary":
    case "update":
    case "typeAssertion":
    case "numericNarrowing":
    case "asinterface":
    case "trycast":
      return {
        ...expr,
        expression: refreshExpression(expr.expression, ctx),
      };

    case "yield":
      return {
        ...expr,
        expression: expr.expression
          ? refreshExpression(expr.expression, ctx)
          : undefined,
      };

    case "templateLiteral":
      return {
        ...expr,
        expressions: expr.expressions.map((expression) =>
          refreshExpression(expression, ctx)
        ),
      };

    case "array":
      return {
        ...expr,
        elements: expr.elements.map((element) =>
          refreshSpreadArgument(element, ctx)
        ),
      };

    case "object":
      return {
        ...expr,
        properties: expr.properties.map((property) =>
          property.kind === "spread"
            ? {
                ...property,
                expression: refreshExpression(property.expression, ctx),
              }
            : property.kind === "property"
              ? {
                  ...property,
                  value: refreshExpression(property.value, ctx),
                }
              : property
        ),
      };

    case "arrowFunction":
      return {
        ...expr,
        body:
          expr.body.kind === "blockStatement"
            ? refreshStatement(expr.body, ctx)
            : refreshExpression(expr.body, ctx),
      };

    case "functionExpression":
      return {
        ...expr,
        body: refreshStatement(expr.body, ctx),
      };

    default:
      return expr;
  }
};

const refreshStatement = <T extends IrStatement>(
  stmt: T,
  ctx: ProgramContext
): T => {
  switch (stmt.kind) {
    case "expressionStatement":
      return {
        ...stmt,
        expression: refreshExpression(stmt.expression, ctx),
      } as T;

    case "returnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? refreshExpression(stmt.expression, ctx)
          : undefined,
      } as T;

    case "variableDeclaration":
      return {
        ...stmt,
        declarations: stmt.declarations.map((declaration) => ({
          ...declaration,
          initializer: declaration.initializer
            ? refreshExpression(declaration.initializer, ctx)
            : undefined,
        })),
      } as T;

    case "ifStatement":
      return {
        ...stmt,
        condition: refreshExpression(stmt.condition, ctx),
        thenStatement: refreshStatement(stmt.thenStatement, ctx),
        elseStatement: stmt.elseStatement
          ? refreshStatement(stmt.elseStatement, ctx)
          : undefined,
      } as T;

    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((statement) =>
          refreshStatement(statement, ctx)
        ),
      } as T;

    case "forStatement":
      return {
        ...stmt,
        initializer:
          stmt.initializer && stmt.initializer.kind !== "variableDeclaration"
            ? refreshExpression(stmt.initializer, ctx)
            : stmt.initializer
              ? refreshStatement(stmt.initializer, ctx)
              : undefined,
        condition: stmt.condition
          ? refreshExpression(stmt.condition, ctx)
          : undefined,
        update: stmt.update
          ? refreshExpression(stmt.update, ctx)
          : undefined,
        body: refreshStatement(stmt.body, ctx),
      } as T;

    case "forOfStatement":
    case "forInStatement":
      return {
        ...stmt,
        expression: refreshExpression(stmt.expression, ctx),
        body: refreshStatement(stmt.body, ctx),
      } as T;

    case "whileStatement":
      return {
        ...stmt,
        condition: refreshExpression(stmt.condition, ctx),
        body: refreshStatement(stmt.body, ctx),
      } as T;

    case "switchStatement":
      return {
        ...stmt,
        expression: refreshExpression(stmt.expression, ctx),
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          test: switchCase.test
            ? refreshExpression(switchCase.test, ctx)
            : undefined,
          statements: switchCase.statements.map((statement) =>
            refreshStatement(statement, ctx)
          ),
        })),
      } as T;

    case "throwStatement":
      return {
        ...stmt,
        expression: refreshExpression(stmt.expression, ctx),
      } as T;

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: refreshStatement(stmt.tryBlock, ctx),
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: refreshStatement(stmt.catchClause.body, ctx),
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? refreshStatement(stmt.finallyBlock, ctx)
          : undefined,
      } as T;

    case "functionDeclaration":
      return {
        ...stmt,
        body: refreshStatement(stmt.body, ctx),
      } as T;

    case "classDeclaration":
      return {
        ...stmt,
        members: stmt.members.map((member) => {
          if (member.kind === "methodDeclaration" && member.body) {
            return {
              ...member,
              body: refreshStatement(member.body, ctx),
            };
          }
          if (member.kind === "constructorDeclaration" && member.body) {
            return {
              ...member,
              body: refreshStatement(member.body, ctx),
            };
          }
          if (member.kind === "propertyDeclaration") {
            return {
              ...member,
              initializer: member.initializer
                ? refreshExpression(member.initializer, ctx)
                : undefined,
              getterBody: member.getterBody
                ? refreshStatement(member.getterBody, ctx)
                : undefined,
              setterBody: member.setterBody
                ? refreshStatement(member.setterBody, ctx)
                : undefined,
            };
          }
          return member;
        }),
      } as T;

    default:
      return stmt;
  }
};

export const runCallResolutionRefreshPass = (
  modules: readonly IrModule[],
  ctx: ProgramContext
): CallResolutionRefreshResult => ({
  ok: true,
  modules: modules.map((module) => ({
    ...module,
    body: module.body.map((statement) => refreshStatement(statement, ctx)),
    exports: module.exports.map((entry) =>
      entry.kind === "declaration"
        ? {
            ...entry,
            declaration: refreshStatement(entry.declaration, ctx),
          }
        : entry
    ),
  })),
});
