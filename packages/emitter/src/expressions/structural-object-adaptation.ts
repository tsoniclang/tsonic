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
} from "../core/semantic/type-resolution.js";
import { resolveStructuralReferenceType } from "../core/semantic/structural-resolution.js";
import {
  sameTypeAstSurface,
  getIdentifierTypeLeafName,
} from "../core/format/backend-ast/utils.js";
import type { EmitterContext } from "../types.js";
import { hasNullishBranch } from "./exact-comparison.js";
import {
  StructuralAdaptFn,
  UpcastFn,
  buildDelegateType,
} from "./structural-adaptation-types.js";
import { collectStructuralProperties } from "./structural-property-model.js";
import { resolveAnonymousStructuralReferenceType } from "./structural-anonymous-targets.js";
import {
  canPreferAnonymousStructuralTarget,
  isSameNominalType,
} from "./structural-type-shapes.js";

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

  const strippedExpectedType = stripNullish(expectedType);
  const resolvedExpectedType = resolveTypeAlias(strippedExpectedType, context);
  if (
    resolvedExpectedType.kind === "referenceType" &&
    resolvedExpectedType.name === "object"
  ) {
    return [emittedAst, context];
  }

  const prefersAnonymousStructuralTarget =
    canPreferAnonymousStructuralTarget(expectedType);
  const anonymousStructuralTarget = prefersAnonymousStructuralTarget
    ? resolveAnonymousStructuralReferenceType(expectedType, context)
    : undefined;
  const canonicalStructuralTarget =
    anonymousStructuralTarget && prefersAnonymousStructuralTarget
      ? undefined
      : resolveStructuralReferenceType(expectedType, context);
  const targetStructuralType =
    canonicalStructuralTarget ??
    anonymousStructuralTarget ?? resolvedExpectedType;
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

  const lambdaAst: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [],
    body: {
      kind: "blockStatement",
      statements,
    },
  };

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "parenthesizedExpression",
        expression: {
          kind: "castExpression",
          type: buildDelegateType([], safeTargetTypeAst),
          expression: {
            kind: "parenthesizedExpression",
            expression: lambdaAst,
          },
        },
      },
      arguments: [],
    },
    currentContext,
  ];
};
