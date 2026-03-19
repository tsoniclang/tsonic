/**
 * Overload wrapper building and method overload group conversion
 */

import * as ts from "typescript";
import {
  IrBlockStatement,
  IrExpression,
  IrMethodDeclaration,
  IrParameter,
  IrSpreadExpression,
  IrStatement,
  IrType,
} from "../../../../types.js";
import { convertBlockStatement } from "../../control.js";
import {
  hasStaticModifier,
  getAccessibility,
  convertTypeParameters,
  convertParameters,
} from "../../helpers.js";
import { detectOverride } from "./override-detection.js";
import { getClassMemberName } from "./member-names.js";
import { convertMethod } from "./method-declaration.js";
import {
  typesEqualForIsType,
  specializeStatement,
} from "./overload-specialization.js";
import {
  assertNoIsTypeCalls,
  assertNoMissingParamRefs,
} from "./overload-validation.js";
import type { ProgramContext } from "../../../../program-context.js";

const OVERLOAD_IMPL_PREFIX = "__tsonic_overload_impl_";

const getOverloadImplementationName = (memberName: string): string =>
  `${OVERLOAD_IMPL_PREFIX}${memberName}`;

const buildPublicOverloadFamilyMember = (
  memberName: string,
  signatureIndex: number,
  publicSignatureCount: number,
  implementationName?: string
): NonNullable<IrMethodDeclaration["overloadFamily"]> => ({
  ownerKind: "method",
  publicName: memberName,
  role: "publicOverload",
  publicSignatureIndex: signatureIndex,
  publicSignatureCount,
  implementationName,
});

const buildImplementationOverloadFamilyMember = (
  memberName: string,
  publicSignatureCount: number,
  implementationName: string
): NonNullable<IrMethodDeclaration["overloadFamily"]> => ({
  ownerKind: "method",
  publicName: memberName,
  role: "implementation",
  publicSignatureCount,
  implementationName,
});

const getIdentifierPatternName = (parameter: IrParameter): string => {
  if (parameter.pattern.kind !== "identifierPattern") {
    throw new Error(
      `ICE: overload wrappers currently require identifier parameters (got '${parameter.pattern.kind}')`
    );
  }

  return parameter.pattern.name;
};

const isSuperMemberCall = (expression: IrExpression): boolean =>
  expression.kind === "call" &&
  expression.callee.kind === "memberAccess" &&
  expression.callee.object.kind === "identifier" &&
  expression.callee.object.name === "super";

const substitutePolymorphicReturn = (
  expression: IrExpression,
  implReturnType: IrType | undefined,
  wrapperReturnType: IrType | undefined
): IrExpression => {
  if (!wrapperReturnType) {
    return expression;
  }

  if (isSuperMemberCall(expression)) {
    return {
      kind: "typeAssertion",
      expression,
      targetType: wrapperReturnType,
      inferredType: wrapperReturnType,
      sourceSpan: expression.sourceSpan,
    };
  }

  if (
    implReturnType &&
    typesEqualForIsType(implReturnType, wrapperReturnType)
  ) {
    return {
      ...expression,
      inferredType: wrapperReturnType,
    };
  }

  return {
    kind: "typeAssertion",
    expression,
    targetType: wrapperReturnType,
    inferredType: wrapperReturnType,
    sourceSpan: expression.sourceSpan,
  };
};

const undefinedExpression = (): IrExpression => ({
  kind: "literal",
  value: undefined,
  inferredType: { kind: "primitiveType", name: "undefined" },
});

const numericIndexLiteral = (index: number): IrExpression => ({
  kind: "literal",
  value: index,
  inferredType: { kind: "primitiveType", name: "int" },
});

const buildWrapperRestIdentifier = (parameter: IrParameter): IrExpression => ({
  kind: "identifier",
  name: getIdentifierPatternName(parameter),
  inferredType: parameter.type,
});

const buildWrapperRestLengthExpression = (
  parameter: IrParameter
): IrExpression => ({
  kind: "memberAccess",
  object: buildWrapperRestIdentifier(parameter),
  property: "length",
  isComputed: false,
  isOptional: false,
  inferredType: { kind: "primitiveType", name: "int" },
});

const buildWrapperRestElementExpression = (
  parameter: IrParameter,
  elementIndex: number
): IrExpression => {
  const arrayLikeType = parameter.type;
  const elementType =
    arrayLikeType?.kind === "arrayType"
      ? arrayLikeType.elementType
      : arrayLikeType?.kind === "tupleType"
        ? (arrayLikeType.elementTypes[elementIndex] ??
          arrayLikeType.elementTypes[arrayLikeType.elementTypes.length - 1])
        : undefined;

  return {
    kind: "memberAccess",
    object: buildWrapperRestIdentifier(parameter),
    property: numericIndexLiteral(elementIndex),
    isComputed: true,
    isOptional: false,
    inferredType: elementType,
    accessKind: "clrIndexer",
  };
};

const buildWrapperRestElementOrUndefinedExpression = (
  parameter: IrParameter,
  elementIndex: number,
  targetType: IrType | undefined
): IrExpression => {
  const elementExpression = buildWrapperRestElementExpression(
    parameter,
    elementIndex
  );
  const fallbackExpression = undefinedExpression();
  const whenTrueExpression =
    targetType &&
    elementExpression.inferredType &&
    !typesEqualForIsType(elementExpression.inferredType, targetType)
      ? ({
          kind: "typeAssertion",
          expression: elementExpression,
          targetType,
          inferredType: targetType,
        } satisfies IrExpression)
      : elementExpression;
  const whenTrueType = whenTrueExpression.inferredType;
  const fallbackType = fallbackExpression.inferredType;
  const inferredType =
    targetType ??
    (whenTrueType && fallbackType
      ? ({
          kind: "unionType",
          types: [whenTrueType, fallbackType],
        } satisfies IrType)
      : (whenTrueType ?? fallbackType));

  const conditionalExpr: IrExpression = {
    kind: "conditional",
    condition: {
      kind: "binary",
      operator: ">",
      left: buildWrapperRestLengthExpression(parameter),
      right: numericIndexLiteral(elementIndex),
      inferredType: { kind: "primitiveType", name: "boolean" },
    },
    whenTrue: whenTrueExpression,
    whenFalse: fallbackExpression,
    inferredType,
  };

  if (
    targetType &&
    conditionalExpr.inferredType &&
    !typesEqualForIsType(conditionalExpr.inferredType, targetType)
  ) {
    return {
      kind: "typeAssertion",
      expression: conditionalExpr,
      targetType,
      inferredType: targetType,
    };
  }

  return conditionalExpr;
};

const buildWrapperRestSliceSpread = (
  parameter: IrParameter,
  startIndex: number
): IrSpreadExpression => ({
  kind: "spread",
  expression: {
    kind: "call",
    callee: {
      kind: "memberAccess",
      object: buildWrapperRestIdentifier(parameter),
      property: "slice",
      isComputed: false,
      isOptional: false,
    },
    arguments: [numericIndexLiteral(startIndex)],
    isOptional: false,
    inferredType: parameter.type,
  },
});

const coerceForwardedArgumentToTargetType = (
  expression: IrExpression,
  targetType: IrType | undefined
): IrExpression => {
  if (
    !targetType ||
    !expression.inferredType ||
    typesEqualForIsType(expression.inferredType, targetType)
  ) {
    return expression;
  }

  return {
    kind: "typeAssertion",
    expression,
    targetType,
    inferredType: targetType,
  };
};

const buildForwardedCallArguments = (
  wrapperParameters: readonly IrParameter[],
  helperParameters: readonly IrParameter[]
): readonly (IrExpression | IrSpreadExpression)[] => {
  const wrapperRestIndex = wrapperParameters.findIndex(
    (parameter) => parameter.isRest
  );
  const wrapperRestParameter =
    wrapperRestIndex >= 0 ? wrapperParameters[wrapperRestIndex] : undefined;
  const forwardedArgs: (IrExpression | IrSpreadExpression)[] = [];

  for (
    let helperIndex = 0;
    helperIndex < helperParameters.length;
    helperIndex += 1
  ) {
    const helperParameter = helperParameters[helperIndex];
    if (!helperParameter) continue;

    if (helperParameter.isRest) {
      if (wrapperRestParameter) {
        const restStartIndex =
          helperIndex >= wrapperRestIndex ? helperIndex - wrapperRestIndex : 0;
        forwardedArgs.push(
          buildWrapperRestSliceSpread(wrapperRestParameter, restStartIndex)
        );
      } else if (helperIndex < wrapperParameters.length) {
        const wrapperParameter = wrapperParameters[helperIndex];
        if (!wrapperParameter) continue;
        const directArgument: IrExpression = {
          kind: "identifier",
          name: getIdentifierPatternName(wrapperParameter),
          inferredType: wrapperParameter.type,
        };
        forwardedArgs.push(
          coerceForwardedArgumentToTargetType(
            directArgument,
            helperParameter.type
          )
        );
      }
      break;
    }

    if (helperIndex < wrapperParameters.length) {
      const wrapperParameter = wrapperParameters[helperIndex];
      if (wrapperParameter && !wrapperParameter.isRest) {
        const directArgument: IrExpression = {
          kind: "identifier",
          name: getIdentifierPatternName(wrapperParameter),
          inferredType: wrapperParameter.type,
        };
        forwardedArgs.push(
          coerceForwardedArgumentToTargetType(
            directArgument,
            helperParameter.type
          )
        );
        continue;
      }
    }

    if (wrapperRestParameter && helperIndex >= wrapperRestIndex) {
      forwardedArgs.push(
        buildWrapperRestElementOrUndefinedExpression(
          wrapperRestParameter,
          helperIndex - wrapperRestIndex,
          helperParameter.type
        )
      );
      continue;
    }

    forwardedArgs.push(undefinedExpression());
  }

  return forwardedArgs;
};
const adaptReturnStatements = (
  stmt: IrStatement,
  targetReturnType: IrType | undefined
): IrStatement => {
  if (!targetReturnType || targetReturnType.kind === "voidType") {
    return stmt;
  }

  switch (stmt.kind) {
    case "blockStatement":
      return {
        ...stmt,
        statements: stmt.statements.map((inner) =>
          adaptReturnStatements(inner, targetReturnType)
        ),
      };
    case "ifStatement":
      return {
        ...stmt,
        thenStatement: adaptReturnStatements(
          stmt.thenStatement,
          targetReturnType
        ),
        elseStatement: stmt.elseStatement
          ? adaptReturnStatements(stmt.elseStatement, targetReturnType)
          : undefined,
      };
    case "whileStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType),
      };
    case "forStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType),
      };
    case "forOfStatement":
    case "forInStatement":
      return {
        ...stmt,
        body: adaptReturnStatements(stmt.body, targetReturnType),
      };
    case "switchStatement":
      return {
        ...stmt,
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          statements: switchCase.statements.map((inner) =>
            adaptReturnStatements(inner, targetReturnType)
          ),
        })),
      };
    case "tryStatement":
      return {
        ...stmt,
        tryBlock: adaptReturnStatements(
          stmt.tryBlock,
          targetReturnType
        ) as IrBlockStatement,
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: adaptReturnStatements(
                stmt.catchClause.body,
                targetReturnType
              ) as IrBlockStatement,
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? (adaptReturnStatements(
              stmt.finallyBlock,
              targetReturnType
            ) as IrBlockStatement)
          : undefined,
      };
    case "returnStatement":
      return stmt.expression
        ? {
            ...stmt,
            expression: substitutePolymorphicReturn(
              stmt.expression,
              stmt.expression.inferredType,
              targetReturnType
            ),
          }
        : stmt;
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
const createWrapperBody = (
  helperName: string,
  parameters: readonly IrParameter[],
  helperParameters: readonly IrParameter[],
  isStatic: boolean,
  implReturnType: IrType | undefined,
  wrapperReturnType: IrType | undefined,
  typeParameterNames: readonly string[]
): IrBlockStatement => {
  const forwardedArgs = buildForwardedCallArguments(
    parameters,
    helperParameters
  );

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
    inferredType: implReturnType ?? wrapperReturnType,
    ...(typeParameterNames.length > 0
      ? {
          typeArguments: typeParameterNames.map(
            (name) =>
              ({
                kind: "typeParameterType",
                name,
              }) satisfies IrType
          ),
        }
      : {}),
    parameterTypes: helperParameters.map((parameter) => parameter.type),
    argumentPassing: helperParameters.map((parameter) => parameter.passing),
  };

  const hasReturnValue =
    wrapperReturnType !== undefined && wrapperReturnType.kind !== "voidType";

  return {
    kind: "blockStatement",
    statements: hasReturnValue
      ? [
          {
            kind: "returnStatement",
            expression: substitutePolymorphicReturn(
              callExpr,
              implReturnType,
              wrapperReturnType
            ),
          },
        ]
      : [
          {
            kind: "expressionStatement",
            expression: callExpr,
          },
        ],
  };
};

/** Convert a TypeScript overload group (`sig; sig; impl {}`) into one C# method per signature. */
export const convertMethodOverloadGroup = (
  nodes: readonly ts.MethodDeclaration[],
  ctx: ProgramContext,
  superClass: ts.ExpressionWithTypeArguments | undefined
): readonly IrMethodDeclaration[] => {
  const impls = nodes.filter((n) => !!n.body);
  if (impls.length !== 1) {
    throw new Error(
      `ICE: method overload group must contain exactly one implementation body (found ${impls.length})`
    );
  }

  const impl = impls[0] as ts.MethodDeclaration;
  const memberName = getClassMemberName(impl.name);

  const sigs = nodes.filter((n) => !n.body);
  if (sigs.length === 0) {
    return [convertMethod(impl, ctx, superClass) as IrMethodDeclaration];
  }

  const implBody = impl.body
    ? convertBlockStatement(impl.body, ctx, undefined)
    : undefined;
  if (!implBody) {
    throw new Error("ICE: overload implementation must have a body");
  }

  const implParams = convertParameters(impl.parameters, ctx);

  // Map implementation param DeclId.id -> index.
  const implParamDeclIds: number[] = [];
  for (const p of impl.parameters) {
    if (!ts.isIdentifier(p.name)) {
      throw new Error(
        `ICE: overload implementations currently require identifier parameters (got non-identifier in '${memberName}')`
      );
    }
    const id = ctx.binding.resolveIdentifier(p.name);
    if (!id) {
      throw new Error(`ICE: could not resolve parameter '${p.name.text}'`);
    }
    implParamDeclIds.push(id.id);
  }

  const declaredAccessibility = getAccessibility(impl);
  const isStatic = hasStaticModifier(impl);
  const isAsync = !!impl.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.AsyncKeyword
  );
  const isGenerator = !!impl.asteriskToken;

  const implMethod = convertMethod(
    impl,
    ctx,
    superClass
  ) as IrMethodDeclaration;

  const requiresWrapperLowering = sigs.some((sig) => {
    const sigParams = convertParameters(sig.parameters, ctx);
    if (sigParams.length > implParams.length) {
      throw new Error(
        `ICE: overload signature parameter count exceeds implementation for '${memberName}' (sig=${sigParams.length}, impl=${implParams.length})`
      );
    }

    const paramTypesByDeclId = new Map<number, IrType>();
    for (let i = 0; i < implParamDeclIds.length; i++) {
      const declId = implParamDeclIds[i] as number;
      const t =
        i < sigParams.length
          ? sigParams[i]?.type
          : ({ kind: "primitiveType", name: "undefined" } as IrType);
      if (t) paramTypesByDeclId.set(declId, t);
    }

    const specialized = specializeStatement(implBody, paramTypesByDeclId);
    if (!assertNoIsTypeCalls(specialized)) {
      return false;
    }

    if (sigParams.length >= implParams.length) {
      return false;
    }

    const missing = new Set<number>();
    for (let i = sigParams.length; i < implParamDeclIds.length; i++) {
      missing.add(implParamDeclIds[i] as number);
    }
    return missing.size > 0 && !assertNoMissingParamRefs(specialized, missing);
  });

  if (requiresWrapperLowering) {
    if (!assertNoIsTypeCalls(implBody)) {
      throw new Error(
        `ICE: overload '${memberName}' requires wrapper lowering but still depends on compile-time-only istype<T>(...).`
      );
    }

    const helperName = getOverloadImplementationName(memberName);
    const helperMethod: IrMethodDeclaration = {
      ...implMethod,
      name: helperName,
      overloadFamily: buildImplementationOverloadFamilyMember(
        memberName,
        sigs.length,
        helperName
      ),
      body: implMethod.body
        ? (adaptReturnStatements(
            implMethod.body,
            implMethod.returnType
          ) as IrBlockStatement)
        : undefined,
      accessibility: "private",
      isOverride: undefined,
      isShadow: undefined,
      isVirtual: undefined,
    };

    const wrappers: IrMethodDeclaration[] = [];
    for (const [signatureIndex, sig] of sigs.entries()) {
      const sigParams = convertParameters(sig.parameters, ctx);
      const returnType = sig.type
        ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(sig.type))
        : undefined;

      const parameters: IrParameter[] = sigParams.map((p, i) => ({
        ...p,
        pattern: (implParams[i] as IrParameter).pattern,
      }));

      const overrideInfo = detectOverride(
        memberName,
        "method",
        superClass,
        ctx,
        parameters
      );

      if (overrideInfo.isShadow) {
        continue;
      }

      const accessibility =
        overrideInfo.isOverride && overrideInfo.requiredAccessibility
          ? overrideInfo.requiredAccessibility
          : declaredAccessibility;

      wrappers.push({
        kind: "methodDeclaration",
        name: memberName,
        typeParameters: convertTypeParameters(sig.typeParameters, ctx),
        parameters,
        returnType,
        body: createWrapperBody(
          helperName,
          parameters,
          implMethod.parameters,
          isStatic,
          implMethod.returnType,
          returnType,
          (sig.typeParameters ?? []).map((tp) => tp.name.text)
        ),
        overloadFamily: buildPublicOverloadFamilyMember(
          memberName,
          signatureIndex,
          sigs.length,
          helperName
        ),
        isStatic,
        isAsync: false,
        isGenerator: false,
        accessibility,
        isOverride: overrideInfo.isOverride ? true : undefined,
        isShadow: overrideInfo.isShadow ? true : undefined,
      });
    }

    return [helperMethod, ...wrappers];
  }

  // Convert each signature into a concrete method emission.
  const out: IrMethodDeclaration[] = [];
  for (const [signatureIndex, sig] of sigs.entries()) {
    const sigParams = convertParameters(sig.parameters, ctx);
    const returnType = sig.type
      ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(sig.type))
      : undefined;

    if (sigParams.length > implParams.length) {
      throw new Error(
        `ICE: overload signature parameter count exceeds implementation for '${memberName}' (sig=${sigParams.length}, impl=${implParams.length})`
      );
    }

    const parameters: IrParameter[] = sigParams.map((p, i) => ({
      ...p,
      pattern: (implParams[i] as IrParameter).pattern,
    }));

    const overrideInfo = detectOverride(
      memberName,
      "method",
      superClass,
      ctx,
      parameters
    );

    // If this signature matches a non-virtual CLR base method, do not emit a new method
    // (avoid accidental `new` shadowing). Users still inherit the base implementation.
    if (overrideInfo.isShadow) {
      continue;
    }

    const accessibility =
      overrideInfo.isOverride && overrideInfo.requiredAccessibility
        ? overrideInfo.requiredAccessibility
        : declaredAccessibility;

    const paramTypesByDeclId = new Map<number, IrType>();
    for (let i = 0; i < implParamDeclIds.length; i++) {
      const declId = implParamDeclIds[i] as number;
      const t =
        i < parameters.length
          ? parameters[i]?.type
          : ({ kind: "primitiveType", name: "undefined" } as IrType);
      if (t) paramTypesByDeclId.set(declId, t);
    }

    const specialized = specializeStatement(implBody, paramTypesByDeclId);
    if (!assertNoIsTypeCalls(specialized)) {
      throw new Error(
        `ICE: istype<T>(...) must be erased during overload specialization for '${memberName}'.`
      );
    }
    if (sigParams.length < implParams.length) {
      const missing = new Set<number>();
      for (let i = sigParams.length; i < implParamDeclIds.length; i++) {
        missing.add(implParamDeclIds[i] as number);
      }
      if (missing.size > 0 && !assertNoMissingParamRefs(specialized, missing)) {
        throw new Error(
          `ICE: overload '${memberName}' implementation references parameters not present in the current signature (sigParams=${sigParams.length}, implParams=${implParams.length}).`
        );
      }
    }

    const adapted = adaptReturnStatements(
      specialized as IrBlockStatement,
      returnType
    ) as IrBlockStatement;

    out.push({
      kind: "methodDeclaration",
      name: memberName,
      typeParameters: convertTypeParameters(sig.typeParameters, ctx),
      parameters,
      returnType,
      body: adapted,
      overloadFamily: buildPublicOverloadFamilyMember(
        memberName,
        signatureIndex,
        sigs.length
      ),
      isStatic,
      isAsync,
      isGenerator,
      accessibility,
      isOverride: overrideInfo.isOverride ? true : undefined,
      isShadow: overrideInfo.isShadow ? true : undefined,
    });
  }

  return out;
};
