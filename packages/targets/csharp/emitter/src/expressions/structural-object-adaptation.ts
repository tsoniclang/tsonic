import { IrType } from "@tsonic/frontend";
import { emitTypeAst } from "../type-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
} from "../core/format/backend-ast/types.js";
import {
  nullLiteral,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import { allocateLocalName } from "../core/format/local-names.js";
import { getAcceptedSurfaceType } from "../core/semantic/defaults.js";
import { emitCSharpName } from "../naming-policy.js";
import {
  resolveTypeAlias,
  stripNullish,
  getPropertyType,
  resolveLocalTypeInfo,
} from "../core/semantic/type-resolution.js";
import {
  isCompilerGeneratedStructuralReferenceType,
  resolveStructuralReferenceType,
} from "../core/semantic/structural-resolution.js";
import {
  sameTypeAstSurface,
  getIdentifierTypeLeafName,
} from "../core/format/backend-ast/utils.js";
import type { EmitterContext } from "../types.js";
import { hasNullishBranch } from "./exact-comparison.js";
import { StructuralAdaptFn, UpcastFn } from "./structural-adaptation-types.js";
import { buildInvokedLambdaExpressionAst } from "./invoked-lambda.js";
import { collectStructuralProperties } from "./structural-property-model.js";
import { resolveAnonymousStructuralReferenceType } from "./structural-anonymous-targets.js";
import {
  canPreferAnonymousStructuralTarget,
  isSameNominalType,
} from "./structural-type-shapes.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";

const buildStructuralSourceAccess = (
  sourceExpression: CSharpExpressionAst,
  sourceType: IrType,
  propertyName: string,
  context: EmitterContext
): CSharpExpressionAst => {
  const resolvedSource = resolveTypeAlias(stripNullish(sourceType), context);
  if (resolvedSource.kind === "dictionaryType") {
    return {
      kind: "elementAccessExpression",
      expression: sourceExpression,
      arguments: [stringLiteral(propertyName)],
    };
  }

  return {
    kind: "memberAccessExpression",
    expression: sourceExpression,
    memberName: emitCSharpName(propertyName, "properties", context),
  };
};

const resolveSourceLocalName = (
  emittedIdentifier: string,
  context: EmitterContext
): string => {
  for (const [sourceName, localName] of context.localNameMap ?? []) {
    if (localName === emittedIdentifier) {
      return sourceName;
    }
  }

  return emittedIdentifier;
};

const localIdentifierAlreadyHasExpectedSurface = (
  emittedAst: CSharpExpressionAst,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  if (emittedAst.kind !== "identifierExpression") {
    return false;
  }

  const sourceName = resolveSourceLocalName(emittedAst.identifier, context);
  const localType =
    context.localValueTypes?.get(sourceName) ??
    context.localSemanticTypes?.get(sourceName);
  if (!localType) {
    return false;
  }

  if (isSameNominalType(localType, expectedType, context)) {
    return true;
  }

  try {
    const [localTypeAst, localTypeContext] = emitTypeAst(
      stripNullish(localType),
      context
    );
    const [expectedTypeAst] = emitTypeAst(
      stripNullish(expectedType),
      localTypeContext
    );
    return sameTypeAstSurface(localTypeAst, expectedTypeAst);
  } catch {
    return false;
  }
};

const isStructuralObjectTargetType = (
  type: IrType,
  resolvedType: IrType,
  context: EmitterContext
): boolean => {
  if (resolvedType.kind === "objectType") {
    return true;
  }

  if (type.kind !== "referenceType") {
    return false;
  }

  const localInfo = resolveLocalTypeInfo(type, context)?.info;
  if (localInfo?.kind === "class" || localInfo?.kind === "enum") {
    return false;
  }

  if (isCompilerGeneratedStructuralReferenceType(type)) {
    return true;
  }

  return !!type.structuralMembers?.some(
    (member) => member.kind === "propertySignature"
  );
};

export const tryAdaptStructuralObjectExpressionAst = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  adaptStructuralExpressionAst: StructuralAdaptFn,
  upcastFn?: UpcastFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!expectedType || !sourceType) return undefined;
  if (isSameNominalType(sourceType, expectedType, context)) {
    return undefined;
  }
  if (
    localIdentifierAlreadyHasExpectedSurface(emittedAst, expectedType, context)
  ) {
    return [emittedAst, context];
  }

  const strippedExpectedType = stripNullish(expectedType);
  const resolvedExpectedType = resolveTypeAlias(strippedExpectedType, context);
  if (
    resolvedExpectedType.kind === "referenceType" &&
    resolvedExpectedType.name === "object"
  ) {
    if (willCarryAsRuntimeUnion(sourceType, context)) {
      return undefined;
    }
    return [emittedAst, context];
  }

  const prefersAnonymousStructuralTarget =
    canPreferAnonymousStructuralTarget(expectedType);
  const canUseCanonicalStructuralTarget = isStructuralObjectTargetType(
    strippedExpectedType,
    resolvedExpectedType,
    context
  );
  const canonicalStructuralTarget = canUseCanonicalStructuralTarget
    ? resolveStructuralReferenceType(expectedType, context)
    : undefined;
  const anonymousStructuralTarget =
    prefersAnonymousStructuralTarget &&
    !(
      canonicalStructuralTarget &&
      isSameNominalType(sourceType, canonicalStructuralTarget, context)
    )
      ? resolveAnonymousStructuralReferenceType(expectedType, context)
      : undefined;
  if (!canUseCanonicalStructuralTarget && !anonymousStructuralTarget) {
    return undefined;
  }
  const targetStructuralType =
    canonicalStructuralTarget ??
    anonymousStructuralTarget ??
    resolvedExpectedType;
  const targetEmissionType =
    canonicalStructuralTarget ??
    anonymousStructuralTarget ??
    (strippedExpectedType.kind === "referenceType"
      ? strippedExpectedType
      : undefined);
  if (
    targetEmissionType &&
    isSameNominalType(sourceType, targetEmissionType, context)
  ) {
    return [emittedAst, context];
  }
  const targetProps = collectStructuralProperties(
    targetStructuralType,
    context
  );
  if (!targetProps || targetProps.length === 0) {
    return undefined;
  }

  if (!targetEmissionType && targetStructuralType.kind === "objectType") {
    return undefined;
  }

  const sourceProps = collectStructuralProperties(sourceType, context);
  if (!sourceProps || sourceProps.length === 0) return undefined;

  const sourcePropNames = new Set(sourceProps.map((prop) => prop.name));
  const materializedProps = targetProps.filter(
    (prop) => prop.isOptional || sourcePropNames.has(prop.name)
  );
  if (materializedProps.length === 0) return undefined;

  for (const prop of targetProps) {
    if (!prop.isOptional && !sourcePropNames.has(prop.name)) {
      return undefined;
    }
    if (!sourcePropNames.has(prop.name)) continue;
    if (!getPropertyType(sourceType, prop.name, context)) {
      return undefined;
    }
  }

  let currentContext = context;
  const [targetTypeAst, withType] = emitTypeAst(
    targetEmissionType ?? targetStructuralType,
    currentContext
  );
  currentContext = withType;
  const safeTargetTypeAst =
    targetTypeAst.kind === "nullableType"
      ? targetTypeAst.underlyingType
      : targetTypeAst;

  if (
    emittedAst.kind === "objectCreationExpression" &&
    (sameTypeAstSurface(emittedAst.type, safeTargetTypeAst) ||
      getIdentifierTypeLeafName(emittedAst.type) ===
        getIdentifierTypeLeafName(safeTargetTypeAst))
  ) {
    return [emittedAst, currentContext];
  }

  const sourcePropMap = new Map(sourceProps.map((prop) => [prop.name, prop]));

  const buildInitializer = (
    sourceExpression: CSharpExpressionAst,
    initContext: EmitterContext
  ): [CSharpExpressionAst, EmitterContext] => {
    let currentInitContext = initContext;
    const assignments = materializedProps
      .filter((prop) => sourcePropNames.has(prop.name))
      .map((prop) => {
        const sourceProp = sourcePropMap.get(prop.name);
        const sourceAccess = buildStructuralSourceAccess(
          sourceExpression,
          sourceType,
          prop.name,
          currentInitContext
        );
        const acceptedTargetType = getAcceptedSurfaceType(
          prop.type,
          prop.isOptional
        );
        const [adaptedValueAst, adaptedValueContext] =
          adaptStructuralExpressionAst(
            sourceAccess,
            sourceProp?.type,
            currentInitContext,
            acceptedTargetType,
            upcastFn
          ) ?? [sourceAccess, currentInitContext];
        currentInitContext = adaptedValueContext;

        return {
          kind: "assignmentExpression" as const,
          operatorToken: "=" as const,
          left: {
            kind: "identifierExpression" as const,
            identifier: emitCSharpName(
              prop.name,
              "properties",
              currentInitContext
            ),
          },
          right: adaptedValueAst,
        };
      });

    return [
      {
        kind: "objectCreationExpression",
        type: safeTargetTypeAst,
        arguments: [],
        initializer: assignments,
      },
      currentInitContext,
    ];
  };

  const sourceMayBeNullish = hasNullishBranch(sourceType);
  if (emittedAst.kind === "identifierExpression") {
    const [initializer, initializerContext] = buildInitializer(
      emittedAst,
      currentContext
    );
    if (!sourceMayBeNullish) {
      return [initializer, initializerContext];
    }
    return [
      {
        kind: "conditionalExpression",
        condition: {
          kind: "binaryExpression",
          operatorToken: "==",
          left: emittedAst,
          right: nullLiteral(),
        },
        whenTrue: {
          kind: "defaultExpression",
          type: safeTargetTypeAst,
        },
        whenFalse: initializer,
      },
      initializerContext,
    ];
  }

  const temp = allocateLocalName("__struct", currentContext);
  currentContext = temp.context;
  const tempIdentifier: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: temp.emittedName,
  };

  const statements: CSharpStatementAst[] = [
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [{ name: temp.emittedName, initializer: emittedAst }],
    },
  ];

  if (sourceMayBeNullish) {
    statements.push({
      kind: "ifStatement",
      condition: {
        kind: "binaryExpression",
        operatorToken: "==",
        left: tempIdentifier,
        right: nullLiteral(),
      },
      thenStatement: {
        kind: "blockStatement",
        statements: [
          {
            kind: "returnStatement",
            expression: {
              kind: "defaultExpression",
              type: safeTargetTypeAst,
            },
          },
        ],
      },
    });
  }

  const [initializer, initializerContext] = buildInitializer(
    tempIdentifier,
    currentContext
  );
  currentContext = initializerContext;

  statements.push({
    kind: "returnStatement",
    expression: initializer,
  });

  return [
    buildInvokedLambdaExpressionAst({
      parameters: [],
      parameterTypes: [],
      body: {
        kind: "blockStatement",
        statements,
      },
      arguments: [],
      returnType: safeTargetTypeAst,
      context: currentContext,
    }),
    currentContext,
  ];
};
