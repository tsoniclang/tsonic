import {
  IrBlockStatement,
  IrExpression,
  IrParameter,
  IrStatement,
  IrType,
  normalizedUnionType,
  stableIrTypeKey,
  substituteIrType,
} from "../../../../types.js";
import { getAwaitedIrType } from "../../../../types.js";
import { buildForwardedCallArguments } from "./overload-wrapper-forwarding.js";
import { substitutePolymorphicReturn } from "./overload-wrapper-family.js";
import { typesEqualForIsType } from "./overload-specialization.js";

const resolveEffectiveReturnType = (
  targetReturnType: IrType | undefined,
  isAsync: boolean
): IrType | undefined => {
  if (!targetReturnType) {
    return undefined;
  }

  if (!isAsync) {
    return targetReturnType;
  }

  return getAwaitedIrType(targetReturnType) ?? targetReturnType;
};

const normalizeWrapperType = (type: IrType): IrType => {
  switch (type.kind) {
    case "unionType":
      return normalizedUnionType(
        type.types.map((member) => normalizeWrapperType(member))
      );
    case "intersectionType":
      return {
        ...type,
        types: type.types.map((member) => normalizeWrapperType(member)),
      };
    case "arrayType":
      return {
        ...type,
        elementType: normalizeWrapperType(type.elementType),
        ...(type.tuplePrefixElementTypes
          ? {
              tuplePrefixElementTypes: type.tuplePrefixElementTypes.map(
                (member) => normalizeWrapperType(member)
              ),
            }
          : {}),
        ...(type.tupleRestElementType
          ? {
              tupleRestElementType: normalizeWrapperType(
                type.tupleRestElementType
              ),
            }
          : {}),
      };
    case "tupleType":
      return {
        ...type,
        elementTypes: type.elementTypes.map((member) =>
          normalizeWrapperType(member)
        ),
      };
    case "dictionaryType":
      return {
        ...type,
        keyType: normalizeWrapperType(type.keyType),
        valueType: normalizeWrapperType(type.valueType),
      };
    case "functionType":
      return {
        ...type,
        parameters: type.parameters.map((parameter) =>
          parameter.type
            ? {
                ...parameter,
                type: normalizeWrapperType(parameter.type),
              }
            : parameter
        ),
        returnType: normalizeWrapperType(type.returnType),
      };
    case "referenceType":
      return type.typeArguments?.length
        ? {
            ...type,
            typeArguments: type.typeArguments.map((member) =>
              normalizeWrapperType(member)
            ),
          }
        : type;
    case "objectType":
      return {
        ...type,
        members: type.members.map((member) => {
          if (member.kind === "propertySignature") {
            return {
              ...member,
              type: normalizeWrapperType(member.type),
            };
          }

          return {
            ...member,
            parameters: member.parameters.map((parameter) =>
              parameter.type
                ? {
                    ...parameter,
                    type: normalizeWrapperType(parameter.type),
                  }
                : parameter
            ),
            ...(member.returnType
              ? { returnType: normalizeWrapperType(member.returnType) }
              : {}),
          };
        }),
      };
    default:
      return type;
  }
};

const areWrapperTypesEquivalent = (left: IrType, right: IrType): boolean =>
  stableIrTypeKey(normalizeWrapperType(left)) ===
  stableIrTypeKey(normalizeWrapperType(right));

const bindWrapperTypeParameter = (
  name: string,
  actual: IrType,
  substitutions: Map<string, IrType>,
  bindableNames: ReadonlySet<string>
): boolean => {
  const normalizedActual = normalizeWrapperType(actual);
  const existing = substitutions.get(name);
  if (!existing) {
    if (!bindableNames.has(name)) {
      return areWrapperTypesEquivalent(
        {
          kind: "typeParameterType",
          name,
        },
        normalizedActual
      );
    }
    substitutions.set(name, normalizedActual);
    return true;
  }

  return areWrapperTypesEquivalent(existing, normalizedActual);
};

const bindWrapperReturnSubstitutions = (
  formal: IrType,
  actual: IrType,
  substitutions: Map<string, IrType>,
  bindableNames: ReadonlySet<string>
): boolean => {
  const normalizedFormal = normalizeWrapperType(
    substituteIrType(formal, substitutions)
  );
  const normalizedActual = normalizeWrapperType(
    substituteIrType(actual, substitutions)
  );

  if (areWrapperTypesEquivalent(normalizedFormal, normalizedActual)) {
    return true;
  }

  if (normalizedFormal.kind === "typeParameterType") {
    return bindWrapperTypeParameter(
      normalizedFormal.name,
      normalizedActual,
      substitutions,
      bindableNames
    );
  }

  if (normalizedFormal.kind === "unionType") {
    const actualKey = stableIrTypeKey(normalizedActual);
    const normalizedMembers = normalizedFormal.types.map((member) =>
      normalizeWrapperType(substituteIrType(member, substitutions))
    );
    if (
      !normalizedMembers.some(
        (member) => stableIrTypeKey(member) === actualKey
      )
    ) {
      return false;
    }

    for (const member of normalizedMembers) {
      if (member.kind === "typeParameterType") {
        if (
          !bindWrapperTypeParameter(
            member.name,
            normalizedActual,
            substitutions,
            bindableNames
          )
        ) {
          return false;
        }
      }
    }
    return true;
  }

  if (normalizedFormal.kind !== normalizedActual.kind) {
    return false;
  }

  switch (normalizedFormal.kind) {
    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return areWrapperTypesEquivalent(normalizedFormal, normalizedActual);
    case "referenceType": {
      if (normalizedActual.kind !== "referenceType") {
        return false;
      }
      if (normalizedFormal.name !== normalizedActual.name) {
        return false;
      }
      const formalArgs = normalizedFormal.typeArguments ?? [];
      const actualArgs = normalizedActual.typeArguments ?? [];
      if (formalArgs.length !== actualArgs.length) {
        return false;
      }
      for (let index = 0; index < formalArgs.length; index += 1) {
        const formalArg = formalArgs[index];
        const actualArg = actualArgs[index];
        if (!formalArg || !actualArg) {
          return false;
        }
        if (
          !bindWrapperReturnSubstitutions(
            formalArg,
            actualArg,
            substitutions,
            bindableNames
          )
        ) {
          return false;
        }
      }
      return true;
    }
    case "arrayType":
      if (normalizedActual.kind !== "arrayType") {
        return false;
      }
      return bindWrapperReturnSubstitutions(
        normalizedFormal.elementType,
        normalizedActual.elementType,
        substitutions,
        bindableNames
      );
    case "tupleType":
      if (
        normalizedActual.kind !== "tupleType" ||
        normalizedFormal.elementTypes.length !== normalizedActual.elementTypes.length
      ) {
        return false;
      }
      for (let index = 0; index < normalizedFormal.elementTypes.length; index += 1) {
        const formalElement = normalizedFormal.elementTypes[index];
        const actualElement = normalizedActual.elementTypes[index];
        if (!formalElement || !actualElement) {
          return false;
        }
        if (
          !bindWrapperReturnSubstitutions(
            formalElement,
            actualElement,
            substitutions,
            bindableNames
          )
        ) {
          return false;
        }
      }
      return true;
    case "dictionaryType":
      if (normalizedActual.kind !== "dictionaryType") {
        return false;
      }
      return (
        bindWrapperReturnSubstitutions(
          normalizedFormal.keyType,
          normalizedActual.keyType,
          substitutions,
          bindableNames
        ) &&
        bindWrapperReturnSubstitutions(
          normalizedFormal.valueType,
          normalizedActual.valueType,
          substitutions,
          bindableNames
        )
      );
    case "functionType":
      if (
        normalizedActual.kind !== "functionType" ||
        normalizedFormal.parameters.length !== normalizedActual.parameters.length
      ) {
        return false;
      }
      for (let index = 0; index < normalizedFormal.parameters.length; index += 1) {
        const formalParameter = normalizedFormal.parameters[index];
        const actualParameter = normalizedActual.parameters[index];
        if (!formalParameter || !actualParameter) {
          return false;
        }
        if (!!formalParameter.type !== !!actualParameter.type) {
          return false;
        }
        if (
          formalParameter.type &&
          actualParameter.type &&
          !bindWrapperReturnSubstitutions(
            formalParameter.type,
            actualParameter.type,
            substitutions,
            bindableNames
          )
        ) {
          return false;
        }
      }
      return bindWrapperReturnSubstitutions(
        normalizedFormal.returnType,
        normalizedActual.returnType,
        substitutions,
        bindableNames
      );
    case "objectType":
      return false;
    case "intersectionType":
      return false;
  }
};

const specializeHelperCallShapeRequired = (
  type: IrType,
  substitutions: ReadonlyMap<string, IrType>
): IrType => {
  switch (type.kind) {
    case "typeParameterType":
      return substitutions.get(type.name) ?? type;

    case "referenceType":
      return {
        ...type,
        ...(type.typeArguments
          ? {
              typeArguments: type.typeArguments.map((member) =>
                specializeHelperCallShapeRequired(member, substitutions)
              ),
            }
          : {}),
        ...(type.structuralMembers
          ? {
              structuralMembers: type.structuralMembers.map((member) => {
                if (member.kind === "propertySignature") {
                  return {
                    ...member,
                    type: specializeHelperCallShapeRequired(
                      member.type,
                      substitutions
                    ),
                  };
                }

                return {
                  ...member,
                  parameters: member.parameters.map((parameter) =>
                    parameter.type
                      ? {
                          ...parameter,
                          type: specializeHelperCallShapeRequired(
                            parameter.type,
                            substitutions
                          ),
                        }
                      : parameter
                  ),
                  ...(member.returnType
                    ? {
                        returnType: specializeHelperCallShapeRequired(
                          member.returnType,
                          substitutions
                        ),
                      }
                    : {}),
                };
              }),
            }
          : {}),
      };

    case "arrayType":
      return {
        ...type,
        elementType: specializeHelperCallShapeRequired(
          type.elementType,
          substitutions
        ),
        ...(type.tuplePrefixElementTypes
          ? {
              tuplePrefixElementTypes: type.tuplePrefixElementTypes.map(
                (member) =>
                  specializeHelperCallShapeRequired(member, substitutions)
              ),
            }
          : {}),
        ...(type.tupleRestElementType
          ? {
              tupleRestElementType: specializeHelperCallShapeRequired(
                type.tupleRestElementType,
                substitutions
              ),
            }
          : {}),
      };

    case "tupleType":
      return {
        ...type,
        elementTypes: type.elementTypes.map(
          (member) => specializeHelperCallShapeRequired(member, substitutions)
        ),
      };

    case "unionType":
      return {
        ...type,
        types: type.types.map(
          (member) => specializeHelperCallShapeRequired(member, substitutions)
        ),
      };

    case "intersectionType":
      return {
        ...type,
        types: type.types.map(
          (member) => specializeHelperCallShapeRequired(member, substitutions)
        ),
      };

    case "dictionaryType":
      return {
        ...type,
        keyType: specializeHelperCallShapeRequired(
          type.keyType,
          substitutions
        ),
        valueType: specializeHelperCallShapeRequired(
          type.valueType,
          substitutions
        ),
      };

    case "functionType":
      return {
        ...type,
        parameters: type.parameters.map((parameter) =>
          parameter.type
            ? {
                ...parameter,
                type: specializeHelperCallShapeRequired(
                  parameter.type,
                  substitutions
                ),
              }
            : parameter
        ),
        returnType: specializeHelperCallShapeRequired(
          type.returnType,
          substitutions
        ),
      };

    case "objectType":
      return {
        ...type,
        members: type.members.map((member) => {
          if (member.kind === "propertySignature") {
            return {
              ...member,
              type: specializeHelperCallShapeRequired(
                member.type,
                substitutions
              ),
            };
          }

          return {
            ...member,
            parameters: member.parameters.map((parameter) =>
              parameter.type
                ? {
                    ...parameter,
                    type: specializeHelperCallShapeRequired(
                      parameter.type,
                      substitutions
                    ),
                  }
                : parameter
            ),
            ...(member.returnType
              ? {
                  returnType: specializeHelperCallShapeRequired(
                    member.returnType,
                    substitutions
                  ),
                }
              : {}),
          };
        }),
      };

    default:
      return type;
  }
};

const specializeHelperCallShapeType = (
  type: IrType | undefined,
  substitutions: ReadonlyMap<string, IrType>
): IrType | undefined =>
  type ? specializeHelperCallShapeRequired(type, substitutions) : undefined;

const trimTrailingOptionalHelperParameters = (
  wrapperParameters: readonly IrParameter[],
  helperParameters: readonly IrParameter[]
): readonly IrParameter[] => {
  if (wrapperParameters.some((parameter) => parameter.isRest)) {
    return helperParameters;
  }

  let end = helperParameters.length;
  while (end > wrapperParameters.length) {
    const helperParameter = helperParameters[end - 1];
    if (
      helperParameter?.isOptional ||
      helperParameter?.initializer !== undefined
    ) {
      end -= 1;
      continue;
    }
    break;
  }

  return helperParameters.slice(0, end);
};

export const needsAsyncWrapperReturnAdaptation = (
  implReturnType: IrType | undefined,
  wrapperReturnType: IrType | undefined
): boolean => {
  if (!implReturnType || !wrapperReturnType) {
    return false;
  }

  const awaitedImpl = getAwaitedIrType(implReturnType);
  const awaitedWrapper = getAwaitedIrType(wrapperReturnType);
  if (!awaitedImpl || !awaitedWrapper) {
    return false;
  }

  return !typesEqualForIsType(awaitedImpl, awaitedWrapper);
};

const returnExpressionNeedsAsyncAwait = (
  expression: IrExpression,
  targetReturnType: IrType | undefined
): boolean => {
  const awaitedTarget = targetReturnType
    ? getAwaitedIrType(targetReturnType)
    : undefined;
  const awaitedActual = expression.inferredType
    ? getAwaitedIrType(expression.inferredType)
    : undefined;

  if (!awaitedTarget || !awaitedActual) {
    return false;
  }

  return !typesEqualForIsType(awaitedActual, awaitedTarget);
};

export const needsAsyncReturnStatementAdaptation = (
  stmt: IrStatement,
  targetReturnType: IrType | undefined
): boolean => {
  switch (stmt.kind) {
    case "blockStatement":
      return stmt.statements.some((inner) =>
        needsAsyncReturnStatementAdaptation(inner, targetReturnType)
      );
    case "ifStatement":
      return (
        needsAsyncReturnStatementAdaptation(
          stmt.thenStatement,
          targetReturnType
        ) ||
        (!!stmt.elseStatement &&
          needsAsyncReturnStatementAdaptation(
            stmt.elseStatement,
            targetReturnType
          ))
      );
    case "whileStatement":
    case "forStatement":
    case "forOfStatement":
    case "forInStatement":
      return needsAsyncReturnStatementAdaptation(stmt.body, targetReturnType);
    case "switchStatement":
      return stmt.cases.some((switchCase) =>
        switchCase.statements.some((inner) =>
          needsAsyncReturnStatementAdaptation(inner, targetReturnType)
        )
      );
    case "tryStatement":
      return (
        needsAsyncReturnStatementAdaptation(stmt.tryBlock, targetReturnType) ||
        (!!stmt.catchClause &&
          needsAsyncReturnStatementAdaptation(
            stmt.catchClause.body,
            targetReturnType
          )) ||
        (!!stmt.finallyBlock &&
          needsAsyncReturnStatementAdaptation(
            stmt.finallyBlock,
            targetReturnType
          ))
      );
    case "returnStatement":
      return (
        !!stmt.expression &&
        stmt.expression.kind !== "await" &&
        returnExpressionNeedsAsyncAwait(stmt.expression, targetReturnType)
      );
    default:
      return false;
  }
};

export const adaptReturnStatements = (
  stmt: IrStatement,
  targetReturnType: IrType | undefined,
  isAsync = false
): IrStatement => {
  const effectiveReturnType = resolveEffectiveReturnType(
    targetReturnType,
    isAsync
  );

  if (!effectiveReturnType || effectiveReturnType.kind === "voidType") {
    return stmt;
  }

  switch (stmt.kind) {
    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((inner) =>
          adaptReturnStatements(inner, targetReturnType, isAsync)
        ),
      };
    case "ifStatement":
      return {
        ...stmt,
        thenStatement: adaptReturnStatements(
          stmt.thenStatement,
          targetReturnType,
          isAsync
        ),
        elseStatement: stmt.elseStatement
          ? adaptReturnStatements(stmt.elseStatement, targetReturnType, isAsync)
          : undefined,
      };
    case "whileStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType, isAsync),
      };
    case "forStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType, isAsync),
      };
    case "forOfStatement":
    case "forInStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType, isAsync),
      };
    case "switchStatement":
      return {
        ...stmt,
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          statements: switchCase.statements.map((inner) =>
            adaptReturnStatements(inner, targetReturnType, isAsync)
          ),
        })),
      };
    case "tryStatement":
      return {
        ...stmt,
        tryBlock: adaptReturnStatements(
          stmt.tryBlock,
          targetReturnType,
          isAsync
        ) as IrBlockStatement,
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: adaptReturnStatements(
                stmt.catchClause.body,
                targetReturnType,
                isAsync
              ) as IrBlockStatement,
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? (adaptReturnStatements(
              stmt.finallyBlock,
              targetReturnType,
              isAsync
            ) as IrBlockStatement)
          : undefined,
      };
    case "returnStatement":
      if (!stmt.expression) {
        return stmt;
      }

      const sourceExpression =
        isAsync &&
        returnExpressionNeedsAsyncAwait(stmt.expression, targetReturnType)
          ? ({
              kind: "await",
              expression: stmt.expression,
              inferredType: getAwaitedIrType(stmt.expression.inferredType!),
            } satisfies IrExpression)
          : stmt.expression;

      return {
        ...stmt,
        expression: substitutePolymorphicReturn(
          sourceExpression,
          sourceExpression.inferredType,
          effectiveReturnType
        ),
      };
    case "functionDeclaration":
    case "classDeclaration":
    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
      return stmt;
    default:
      return stmt;
  }
};

export const createWrapperBody = (
  helperName: string,
  parameters: readonly IrParameter[],
  helperParameters: readonly IrParameter[],
  helperTypeParameterNames: readonly string[],
  isStatic: boolean,
  implReturnType: IrType | undefined,
  wrapperReturnType: IrType | undefined,
  wrapperTypeParameterNames: readonly string[],
  wrapperIsAsync = false
): IrBlockStatement => {
  const substitutions = new Map<string, IrType>();
  const bindableNames = new Set<string>([
    ...helperTypeParameterNames,
    ...wrapperTypeParameterNames,
  ]);
  for (const typeParameterName of wrapperTypeParameterNames) {
    substitutions.set(typeParameterName, {
      kind: "typeParameterType",
      name: typeParameterName,
    });
  }
  if (implReturnType && wrapperReturnType) {
    bindWrapperReturnSubstitutions(
      implReturnType,
      wrapperReturnType,
      substitutions,
      bindableNames
    );
  }

  const specializedHelperParameters = helperParameters.map((parameter) => ({
    ...parameter,
    type: specializeHelperCallShapeType(parameter.type, substitutions),
  }));
  const effectiveHelperParameters = trimTrailingOptionalHelperParameters(
    parameters,
    specializedHelperParameters
  );
  const forwardedArgs = buildForwardedCallArguments(
    parameters,
    effectiveHelperParameters
  );
  const specializedImplReturnType = specializeHelperCallShapeType(
    implReturnType,
    substitutions
  );
  const helperTypeArguments =
    helperTypeParameterNames.length > 0 &&
    helperTypeParameterNames.every((name) => substitutions.has(name))
      ? helperTypeParameterNames.map(
          (name) => substitutions.get(name) as IrType
        )
      : undefined;

  const callee: IrExpression = isStatic
    ? {
        kind: "identifier",
        name: helperName,
      }
    : {
        kind: "memberAccess",
        object: {
          kind: "this",
        },
        property: helperName,
        isComputed: false,
        isOptional: false,
      };

  const callExpr: IrExpression = {
    kind: "call",
    callee,
    arguments: forwardedArgs,
    isOptional: false,
    inferredType: specializedImplReturnType ?? wrapperReturnType,
    allowUnknownInferredType: true,
    ...(helperTypeArguments && helperTypeArguments.length > 0
      ? {
          typeArguments: helperTypeArguments,
        }
      : {}),
    parameterTypes: effectiveHelperParameters.map((parameter) => parameter.type),
    argumentPassing: effectiveHelperParameters.map(
      (parameter) => parameter.passing
    ),
  };

  const awaitableReturnAdaptation =
    wrapperIsAsync && wrapperReturnType
      ? getAwaitedIrType(wrapperReturnType)
      : undefined;
  const implAwaitedReturnType =
    wrapperIsAsync && specializedImplReturnType
      ? getAwaitedIrType(specializedImplReturnType)
      : undefined;
  const awaitedReturnExpression =
    wrapperIsAsync && awaitableReturnAdaptation
      ? ({
          kind: "await",
          expression: callExpr,
          inferredType: implAwaitedReturnType ?? awaitableReturnAdaptation,
        } satisfies IrExpression)
      : undefined;
  const wrappedReturnExpression =
    wrapperIsAsync && awaitableReturnAdaptation
      ? substitutePolymorphicReturn(
          awaitedReturnExpression!,
          implAwaitedReturnType,
          awaitableReturnAdaptation
        )
      : substitutePolymorphicReturn(
          callExpr,
          specializedImplReturnType,
          wrapperReturnType
        );
  const hasReturnValue =
    wrapperIsAsync && awaitableReturnAdaptation
      ? awaitableReturnAdaptation.kind !== "voidType"
      : wrapperReturnType !== undefined &&
        wrapperReturnType.kind !== "voidType";

  return {
    kind: "blockStatement",
    statements: hasReturnValue
      ? [
          {
            kind: "returnStatement",
            expression: wrappedReturnExpression,
          },
        ]
      : [
          {
            kind: "expressionStatement",
            expression: awaitedReturnExpression ?? callExpr,
          },
        ],
  };
};
