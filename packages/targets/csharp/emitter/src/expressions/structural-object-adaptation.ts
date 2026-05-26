import type { IrInterfaceMember, IrType } from "@tsonic/frontend";
import { emitTypeAst } from "../type-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
} from "../core/format/backend-ast/types.js";
import {
  identifierType,
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
import { referenceTypeEmitsAsNativeInterface } from "../core/semantic/native-interfaces.js";
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
import { localInfoHasStructuralMember } from "../core/semantic/structural-member-matching.js";
import { isAssignableToType } from "../core/semantic/type-compatibility.js";

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

const isCollectionStructuralType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return resolved.kind === "arrayType" || resolved.kind === "dictionaryType";
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

const getExpectedInterfaceMembers = (
  expectedType: IrType,
  context: EmitterContext
): readonly IrInterfaceMember[] | undefined => {
  const stripped = stripNullish(expectedType);
  if (stripped.kind === "objectType") {
    return stripped.members;
  }
  if (stripped.kind !== "referenceType") {
    return undefined;
  }
  if (stripped.structuralMembers?.length) {
    return stripped.structuralMembers;
  }
  const localInfo = resolveLocalTypeInfo(stripped, context)?.info;
  return localInfo?.kind === "interface" ? localInfo.members : undefined;
};

const localIdentifierStructurallySatisfiesExpectedInterface = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  if (emittedAst.kind !== "identifierExpression") {
    return false;
  }

  const sourceName = resolveSourceLocalName(emittedAst.identifier, context);
  const declaredSourceType =
    context.localSemanticTypes?.get(sourceName) ??
    context.localValueTypes?.get(sourceName) ??
    sourceType;
  const strippedSource = stripNullish(declaredSourceType);
  if (strippedSource.kind !== "referenceType") {
    return false;
  }

  const sourceInfo = context.localTypes?.get(strippedSource.name);
  if (sourceInfo?.kind !== "class" && sourceInfo?.kind !== "interface") {
    return false;
  }

  const targetMembers = getExpectedInterfaceMembers(expectedType, context);
  return (
    targetMembers !== undefined &&
    targetMembers.length > 0 &&
    targetMembers.every((targetMember) =>
      localInfoHasStructuralMember(sourceInfo, targetMember, context)
    )
  );
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

  if (isCompilerGeneratedStructuralReferenceType(type)) {
    return true;
  }

  const localInfo = resolveLocalTypeInfo(type, context)?.info;
  if (localInfo?.kind === "class" || localInfo?.kind === "enum") {
    return false;
  }
  if (localInfo?.kind === "interface") {
    return localInfo.members.some(
      (member) => member.kind === "propertySignature"
    );
  }
  if (localInfo?.kind === "typeAlias") {
    const props = collectStructuralProperties(type, context);
    return !!props && props.length > 0;
  }

  return !!type.structuralMembers?.some(
    (member) => member.kind === "propertySignature"
  );
};

const referenceLeafName = (type: IrType): string | undefined => {
  if (type.kind !== "referenceType") {
    return undefined;
  }
  const lastDot = type.name.lastIndexOf(".");
  return lastDot >= 0 ? type.name.slice(lastDot + 1) : type.name;
};

const tryAdaptReadonlyMapValueView = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType,
  expectedType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const strippedSource = stripNullish(resolveTypeAlias(sourceType, context));
  const strippedExpected = stripNullish(
    resolveTypeAlias(expectedType, context)
  );
  if (
    strippedSource.kind !== "referenceType" ||
    strippedExpected.kind !== "referenceType"
  ) {
    return undefined;
  }

  const sourceName = referenceLeafName(strippedSource);
  const expectedName = referenceLeafName(strippedExpected);
  if (
    expectedName !== "ReadonlyMap" ||
    (sourceName !== "Map" && sourceName !== "ReadonlyMap")
  ) {
    return undefined;
  }

  const sourceKeyType = strippedSource.typeArguments?.[0];
  const sourceValueType = strippedSource.typeArguments?.[1];
  const expectedKeyType = strippedExpected.typeArguments?.[0];
  const expectedValueType = strippedExpected.typeArguments?.[1];
  if (
    !sourceKeyType ||
    !sourceValueType ||
    !expectedKeyType ||
    !expectedValueType
  ) {
    return undefined;
  }

  let currentContext = context;
  const [sourceKeyAst, sourceKeyContext] = emitTypeAst(
    sourceKeyType,
    currentContext
  );
  currentContext = sourceKeyContext;
  const [expectedKeyAst, expectedKeyContext] = emitTypeAst(
    expectedKeyType,
    currentContext
  );
  currentContext = expectedKeyContext;
  if (!sameTypeAstSurface(sourceKeyAst, expectedKeyAst)) {
    return undefined;
  }

  const [sourceValueAst, sourceValueContext] = emitTypeAst(
    sourceValueType,
    currentContext
  );
  currentContext = sourceValueContext;
  const [expectedValueAst, expectedValueContext] = emitTypeAst(
    expectedValueType,
    currentContext
  );
  currentContext = expectedValueContext;
  if (sameTypeAstSurface(sourceValueAst, expectedValueAst)) {
    return [emittedAst, currentContext];
  }

  return [
    {
      kind: "objectCreationExpression",
      type: identifierType("global::js.ReadonlyMapView", [
        sourceKeyAst,
        sourceValueAst,
        expectedValueAst,
      ]),
      arguments: [emittedAst],
    },
    currentContext,
  ];
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
  const expectedInterfaceMembers = getExpectedInterfaceMembers(
    expectedType,
    context
  );
  const strippedSourceType = stripNullish(sourceType);
  const sourceRequiresStructuralMaterialization =
    !isSameNominalType(sourceType, expectedType, context) &&
    (strippedSourceType.kind === "objectType" ||
      (strippedSourceType.kind === "referenceType" &&
        isCompilerGeneratedStructuralReferenceType(strippedSourceType)));
  if (
    !sourceRequiresStructuralMaterialization &&
    (expectedInterfaceMembers?.length ?? 0) === 0 &&
    !isCollectionStructuralType(sourceType, context) &&
    !isCollectionStructuralType(expectedType, context) &&
    willCarryAsRuntimeUnion(sourceType, context) ===
      willCarryAsRuntimeUnion(expectedType, context) &&
    isAssignableToType(sourceType, expectedType, context)
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

  const readonlyMapValueView = tryAdaptReadonlyMapValueView(
    emittedAst,
    sourceType,
    strippedExpectedType,
    context
  );
  if (readonlyMapValueView) {
    return readonlyMapValueView;
  }

  if (referenceTypeEmitsAsNativeInterface(strippedExpectedType, context)) {
    if (
      localIdentifierStructurallySatisfiesExpectedInterface(
        emittedAst,
        sourceType,
        strippedExpectedType,
        context
      )
    ) {
      return [emittedAst, context];
    }

    const [targetTypeAst, nextContext] = emitTypeAst(
      strippedExpectedType,
      context
    );
    const safeTargetTypeAst =
      targetTypeAst.kind === "nullableType"
        ? targetTypeAst.underlyingType
        : targetTypeAst;
    if (
      emittedAst.kind === "castExpression" &&
      sameTypeAstSurface(emittedAst.type, safeTargetTypeAst)
    ) {
      return [emittedAst, nextContext];
    }

    return [
      {
        kind: "castExpression",
        type: safeTargetTypeAst,
        expression: emittedAst,
      },
      nextContext,
    ];
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
