/**
 * Variable declaration emission - facade/orchestrator
 *
 * Delegates to:
 * - variable-type-resolution.ts  (type resolution helpers)
 * - variable-static-arrow.ts     (static arrow field emission)
 */

import { IrStatement, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  lowerPatternAst,
  lowerPatternToStaticMembersAst,
} from "../../patterns.js";
import {
  resolveEffectiveVariableInitializerType,
  resolveInitializerEmissionExpectedType,
} from "../../core/semantic/variable-type-resolution.js";
import {
  allocateLocalName,
  registerLocalName,
} from "../../core/format/local-names.js";
import { registerVariableSymbolTypes } from "../../core/semantic/symbol-types.js";
import { emitCSharpName } from "../../naming-policy.js";
import type {
  CSharpStatementAst,
  CSharpExpressionAst,
  CSharpMemberAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  resolveStaticFieldType,
  shouldEmitReadonlyStaticField,
  shouldTreatStructuralAssertionAsErased,
  isExplicitCastLikeAst,
  shouldForceDeclaredInitializerCast,
  resolveLocalTypeAst,
} from "./variable-type-resolution.js";
import { emitStaticArrowFieldMembers } from "./variable-static-arrow.js";
import { resolveIdentifierValueSurfaceType } from "../../core/semantic/direct-value-surfaces.js";
import { matchesEmittedStorageSurface } from "../../expressions/identifier-storage.js";
import { resolveDirectStorageExpressionType } from "../../expressions/direct-storage-types.js";
import { getDictionaryComputedAccess } from "../../expressions/operators/helpers.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import {
  identifierExpression,
  nullLiteral,
} from "../../core/format/backend-ast/builders.js";

const hasUnresolvedReferenceLeaves = (
  type: unknown,
  context: EmitterContext
): boolean => {
  if (!type || typeof type !== "object") {
    return false;
  }

  const record = type as Record<string, unknown>;
  const kind = typeof record.kind === "string" ? record.kind : undefined;
  switch (kind) {
    case "referenceType": {
      if (typeof record.externalQualifiedName === "string") {
        return false;
      }

      const typeIdClrName =
        record.typeId &&
        typeof record.typeId === "object" &&
        typeof (record.typeId as { clrName?: unknown }).clrName === "string";
      if (typeIdClrName) {
        return false;
      }

      const rawName = typeof record.name === "string" ? record.name : undefined;
      const lookupName = rawName?.includes(".")
        ? (rawName.split(".").pop() ?? rawName)
        : rawName;
      if (
        (rawName &&
          (context.localTypes?.has(rawName) ||
            context.importBindings?.has(rawName))) ||
        (lookupName &&
          (context.localTypes?.has(lookupName) ||
            context.importBindings?.has(lookupName)))
      ) {
        return false;
      }

      return true;
    }
    case "arrayType":
      return hasUnresolvedReferenceLeaves(record.elementType, context);
    case "dictionaryType":
      return (
        hasUnresolvedReferenceLeaves(record.keyType, context) ||
        hasUnresolvedReferenceLeaves(record.valueType, context)
      );
    case "tupleType":
      return Array.isArray(record.elementTypes)
        ? record.elementTypes.some((elementType) =>
            hasUnresolvedReferenceLeaves(elementType, context)
          )
        : false;
    case "unionType":
    case "intersectionType":
      return Array.isArray(record.types)
        ? record.types.some((memberType) =>
            hasUnresolvedReferenceLeaves(memberType, context)
          )
        : false;
    case "functionType":
      return (
        (Array.isArray(record.parameters)
          ? record.parameters.some((parameter) =>
              hasUnresolvedReferenceLeaves(
                parameter && typeof parameter === "object"
                  ? (parameter as { type?: unknown }).type
                  : undefined,
                context
              )
            )
          : false) || hasUnresolvedReferenceLeaves(record.returnType, context)
      );
    default:
      return false;
  }
};

const registerConditionAlias = (
  originalName: string,
  declarationKind: "const" | "let" | "var",
  initializer: Extract<
    Extract<
      IrStatement,
      { kind: "variableDeclaration" }
    >["declarations"][number],
    { kind: "variableDeclarator" }
  >["initializer"],
  context: EmitterContext
): EmitterContext => {
  const nextAliases = new Map(context.conditionAliases ?? []);
  if (declarationKind === "const" && initializer) {
    nextAliases.set(originalName, initializer);
  } else {
    nextAliases.delete(originalName);
  }

  return {
    ...context,
    conditionAliases: nextAliases,
  };
};

const registerDictionaryReadPresenceLocal = (
  originalName: string,
  presenceLocalName: string,
  context: EmitterContext
): EmitterContext => ({
  ...context,
  dictionaryReadPresenceLocals: new Map([
    ...(context.dictionaryReadPresenceLocals ?? []),
    [originalName, presenceLocalName],
  ]),
});

const emitDictionaryReadLocalInitialization = (
  originalName: string,
  initializer: NonNullable<
    Extract<
      Extract<
        IrStatement,
        { kind: "variableDeclaration" }
      >["declarations"][number],
      { kind: "variableDeclarator" }
    >["initializer"]
  >,
  valueTypeAst: CSharpTypeAst,
  context: EmitterContext
):
  | {
      readonly statements: readonly CSharpStatementAst[];
      readonly initializer: CSharpExpressionAst;
      readonly presenceLocalName: string;
      readonly storageType?: IrType;
      readonly context: EmitterContext;
    }
  | undefined => {
  const dictionaryRead = getDictionaryComputedAccess(initializer, context);
  if (!dictionaryRead) {
    return undefined;
  }

  let currentContext = context;
  const dictionaryObjectType =
    resolveEffectiveExpressionType(dictionaryRead.object, currentContext) ??
    dictionaryRead.object.inferredType;
  const dictionaryValueType = dictionaryObjectType
    ? (() => {
        const resolvedObjectType = resolveTypeAlias(
          stripNullish(dictionaryObjectType),
          currentContext
        );
        return resolvedObjectType.kind === "dictionaryType"
          ? resolvedObjectType.valueType
          : undefined;
      })()
    : undefined;
  const [objectAst, objectContext] = emitExpressionAst(
    dictionaryRead.object,
    currentContext,
    dictionaryRead.object.inferredType
  );
  currentContext = objectContext;
  const [keyAst, keyContext] = emitExpressionAst(
    dictionaryRead.property,
    currentContext,
    dictionaryRead.property.inferredType
  );
  currentContext = keyContext;

  const dictionaryAlloc = allocateLocalName(
    `__tsonic_${originalName}_dict`,
    currentContext
  );
  currentContext = dictionaryAlloc.context;
  const keyAlloc = allocateLocalName(
    `__tsonic_${originalName}_key`,
    currentContext
  );
  currentContext = keyAlloc.context;
  const presenceAlloc = allocateLocalName(
    `__tsonic_${originalName}_present`,
    currentContext
  );
  currentContext = presenceAlloc.context;

  const dictionaryId = identifierExpression(dictionaryAlloc.emittedName);
  const keyId = identifierExpression(keyAlloc.emittedName);
  const containsKeyAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: dictionaryId,
      memberName: "ContainsKey",
    },
    arguments: [keyId],
  };
  const presenceInitializer: CSharpExpressionAst = dictionaryRead.isOptional
    ? {
        kind: "binaryExpression",
        operatorToken: "&&",
        left: {
          kind: "binaryExpression",
          operatorToken: "!=",
          left: dictionaryId,
          right: nullLiteral(),
        },
        right: containsKeyAst,
      }
    : containsKeyAst;
  const presenceId = identifierExpression(presenceAlloc.emittedName);
  const valueInitializer: CSharpExpressionAst = {
    kind: "conditionalExpression",
    condition: presenceId,
    whenTrue: {
      kind: "elementAccessExpression",
      expression: dictionaryId,
      arguments: [keyId],
    },
    whenFalse: {
      kind: "defaultExpression",
      type: valueTypeAst,
    },
  };

  return {
    statements: [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "varType" },
        declarators: [
          { name: dictionaryAlloc.emittedName, initializer: objectAst },
        ],
      },
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "varType" },
        declarators: [{ name: keyAlloc.emittedName, initializer: keyAst }],
      },
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "predefinedType", keyword: "bool" },
        declarators: [
          {
            name: presenceAlloc.emittedName,
            initializer: presenceInitializer,
          },
        ],
      },
    ],
    initializer: valueInitializer,
    presenceLocalName: presenceAlloc.emittedName,
    storageType: dictionaryValueType,
    context: currentContext,
  };
};

const isCompileTimeConstantStaticField = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  decl: Extract<
    Extract<
      IrStatement,
      { kind: "variableDeclaration" }
    >["declarations"][number],
    { kind: "variableDeclarator" }
  >,
  context: EmitterContext
): boolean => {
  if (!shouldEmitReadonlyStaticField(stmt, decl, context)) {
    return false;
  }
  const initializer = decl.initializer;
  return (
    initializer?.kind === "literal" &&
    (typeof initializer.value === "string" ||
      typeof initializer.value === "number" ||
      typeof initializer.value === "boolean")
  );
};

/**
 * Emit a static variable declaration as AST members (fields, methods, delegates).
 */
export const emitVariableDeclaration = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  context: EmitterContext
): [readonly CSharpMemberAst[], EmitterContext] => {
  let currentContext = context;
  const members: CSharpMemberAst[] = [];

  for (const decl of stmt.declarations) {
    // Handle destructuring patterns as static field AST members.
    if (
      decl.name.kind === "arrayPattern" ||
      decl.name.kind === "objectPattern"
    ) {
      if (!decl.initializer) {
        throw new Error(
          "Destructuring declaration requires an initializer in static context."
        );
      }

      const [initAst, newContext] = emitExpressionAst(
        decl.initializer,
        currentContext,
        decl.type
      );
      currentContext = newContext;
      const patternType =
        decl.type ??
        resolveEffectiveVariableInitializerType(
          decl.initializer,
          currentContext
        );
      const result = lowerPatternToStaticMembersAst(
        decl.name,
        initAst,
        patternType,
        currentContext
      );
      members.push(...result.members);
      currentContext = result.context;
      continue;
    }

    // Arrow function in static context -> field + __Impl method (+ optional delegate)
    if (context.isStatic && decl.initializer?.kind === "arrowFunction") {
      const [arrowMembers, arrowCtx] = emitStaticArrowFieldMembers(
        stmt,
        decl as Parameters<typeof emitStaticArrowFieldMembers>[1],
        currentContext
      );
      members.push(...arrowMembers);
      currentContext = arrowCtx;
      continue;
    }

    // Simple identifier field declaration
    if (decl.name.kind === "identifierPattern") {
      const originalName = decl.name.name;
      const fieldName = emitCSharpName(originalName, "fields", context);

      // Determine type
      const [typeAst, typeCtx] = resolveStaticFieldType(decl, currentContext);
      currentContext = typeCtx;

      // Determine modifiers
      const emitCompileTimeConst = isCompileTimeConstantStaticField(
        stmt,
        decl as Extract<
          Extract<
            IrStatement,
            { kind: "variableDeclaration" }
          >["declarations"][number],
          { kind: "variableDeclarator" }
        >,
        currentContext
      );
      const modifiers = emitCompileTimeConst
        ? [stmt.isExported ? "public" : "internal", "const"]
        : [
            stmt.isExported ? "public" : "internal",
            "static",
            ...(shouldEmitReadonlyStaticField(stmt, decl, currentContext)
              ? ["readonly"]
              : []),
          ];

      // Emit initializer
      let initializerAst: CSharpExpressionAst | undefined;
      if (decl.initializer) {
        const [initAst, newContext] = emitExpressionAst(
          decl.initializer,
          currentContext,
          decl.type
        );
        currentContext = newContext;
        initializerAst = initAst;
      }

      members.push({
        kind: "fieldDeclaration",
        attributes: [],
        modifiers,
        type: typeAst,
        name: fieldName,
        initializer: initializerAst,
      });
    } else {
      throw new Error(
        "Unsupported variable declaration pattern in static context."
      );
    }
  }

  return [
    members,
    {
      ...context,
      ...currentContext,
      indentLevel: context.indentLevel,
      isStatic: context.isStatic,
      isAsync: context.isAsync,
      className: context.className,
      returnType: context.returnType,
      narrowedBindings: context.narrowedBindings,
      voidResolveNames: context.voidResolveNames,
      promiseResolveValueTypes: context.promiseResolveValueTypes,
      typeParameters: context.typeParameters,
      typeParamConstraints: context.typeParamConstraints,
      typeParameterNameMap: context.typeParameterNameMap,
      localNameMap: context.localNameMap,
      usedLocalNames: context.usedLocalNames,
    },
  ];
};

/**
 * Emit a local (non-static) variable declaration as AST.
 *
 * Static variable declarations (module-level fields) are handled by the
 * text-based emitVariableDeclaration above.
 */
export const emitVariableDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];

  for (const decl of stmt.declarations) {
    // Handle destructuring patterns with AST lowering
    if (
      decl.name.kind === "arrayPattern" ||
      decl.name.kind === "objectPattern"
    ) {
      if (!decl.initializer) {
        // Destructuring requires an initializer
        statements.push({ kind: "emptyStatement" });
        continue;
      }

      const [initAst, newContext] = emitExpressionAst(
        decl.initializer,
        currentContext,
        decl.type
      );
      currentContext = newContext;

      const patternType =
        decl.type ??
        resolveEffectiveVariableInitializerType(
          decl.initializer,
          currentContext
        );
      const result = lowerPatternAst(
        decl.name,
        initAst,
        patternType,
        currentContext
      );
      statements.push(...result.statements);
      currentContext = result.context;
      continue;
    }

    // Simple identifier pattern
    if (decl.name.kind === "identifierPattern") {
      const originalName = decl.name.name;

      // Determine type AST (may update context)
      const [typeAst, typeContext] = resolveLocalTypeAst(decl, currentContext);
      currentContext = typeContext;

      // Allocate local name
      const alloc = allocateLocalName(originalName, currentContext);
      const localName = alloc.emittedName;
      currentContext = alloc.context;

      const needsTwoPhaseFunctionInit =
        decl.initializer?.kind === "arrowFunction" ||
        decl.initializer?.kind === "functionExpression";

      if (needsTwoPhaseFunctionInit && typeAst.kind !== "varType") {
        statements.push({
          kind: "localDeclarationStatement",
          modifiers: [],
          type: typeAst,
          declarators: [
            {
              name: localName,
              initializer: {
                kind: "defaultExpression",
                type: typeAst,
              },
            },
          ],
        });

        currentContext = registerLocalName(
          originalName,
          localName,
          currentContext
        );
        currentContext = registerVariableSymbolTypes(
          originalName,
          decl,
          currentContext
        );
        currentContext = registerConditionAlias(
          originalName,
          stmt.declarationKind,
          decl.initializer,
          currentContext
        );

        const expectedInitializerType =
          decl.type ??
          (decl.initializer.inferredType?.kind === "functionType"
            ? decl.initializer.inferredType
            : undefined);

        const [exprAst, newContext] = emitExpressionAst(
          decl.initializer,
          currentContext,
          expectedInitializerType
        );
        currentContext = newContext;

        statements.push({
          kind: "expressionStatement",
          expression: {
            kind: "assignmentExpression",
            left: {
              kind: "identifierExpression",
              identifier: localName,
            },
            operatorToken: "=",
            right: exprAst,
          },
        });
        continue;
      }

      // Emit initializer (after allocation, before registration - C# scoping)
      let initAst = undefined;
      let emittedInitializerStorageType = undefined;
      let emittedInitializerSemanticType = undefined;
      let dictionaryPresenceLocalName: string | undefined = undefined;
      let dictionaryReadStorageType: IrType | undefined = undefined;
      if (decl.initializer) {
        const declaredInitializerType =
          decl.type ??
          resolveEffectiveVariableInitializerType(
            decl.initializer,
            currentContext
          );
        const expectedInitializerType = shouldTreatStructuralAssertionAsErased(
          decl,
          currentContext
        )
          ? undefined
          : resolveInitializerEmissionExpectedType(
              decl.type,
              decl.initializer,
              currentContext
            );
        const [initializerValueTypeAst, initializerValueTypeContext] =
          declaredInitializerType
            ? emitTypeAst(declaredInitializerType, currentContext)
            : [
                {
                  kind: "predefinedType",
                  keyword: "object",
                } as CSharpTypeAst,
                currentContext,
              ];
        currentContext = initializerValueTypeContext;
        const dictionaryReadInitialization =
          typeAst.kind === "varType"
            ? emitDictionaryReadLocalInitialization(
                originalName,
                decl.initializer,
                initializerValueTypeAst,
                currentContext
              )
            : undefined;
        if (dictionaryReadInitialization) {
          statements.push(...dictionaryReadInitialization.statements);
          initAst = dictionaryReadInitialization.initializer;
          dictionaryPresenceLocalName =
            dictionaryReadInitialization.presenceLocalName;
          dictionaryReadStorageType = dictionaryReadInitialization.storageType;
          currentContext = dictionaryReadInitialization.context;
        } else {
          const [exprAst, newContext] = emitExpressionAst(
            decl.initializer,
            currentContext,
            expectedInitializerType
          );
          currentContext = newContext;
          initAst =
            typeAst.kind !== "varType" &&
            !isExplicitCastLikeAst(exprAst) &&
            (shouldForceDeclaredInitializerCast(
              decl.initializer,
              declaredInitializerType,
              currentContext
            ) ||
              (decl.initializer.kind === "identifier" &&
                !!declaredInitializerType &&
                !!resolveIdentifierValueSurfaceType(
                  decl.initializer,
                  currentContext
                ) &&
                !matchesEmittedStorageSurface(
                  resolveIdentifierValueSurfaceType(
                    decl.initializer,
                    currentContext
                  ),
                  declaredInitializerType,
                  currentContext
                )[0]))
              ? {
                  kind: "castExpression" as const,
                  type: typeAst,
                  expression: exprAst,
                }
              : exprAst;
        }
        emittedInitializerStorageType =
          typeAst.kind === "varType"
            ? (dictionaryReadStorageType ??
              (() => {
                const candidateStorageType = resolveDirectStorageExpressionType(
                  decl.initializer,
                  initAst,
                  currentContext
                );
                if (
                  candidateStorageType &&
                  !hasUnresolvedReferenceLeaves(
                    candidateStorageType,
                    currentContext
                  )
                ) {
                  return candidateStorageType;
                }

                return declaredInitializerType &&
                  !hasUnresolvedReferenceLeaves(
                    declaredInitializerType,
                    currentContext
                  )
                  ? declaredInitializerType
                  : undefined;
              })())
            : undefined;
        emittedInitializerSemanticType =
          !decl.type && decl.initializer.kind === "conditional"
            ? emittedInitializerStorageType
            : undefined;
      } else if (typeAst.kind !== "varType") {
        initAst = {
          kind: "defaultExpression" as const,
          type: typeAst,
        };
      }

      // Register local name after initializer emission
      currentContext = registerLocalName(
        originalName,
        localName,
        currentContext
      );
      currentContext = registerVariableSymbolTypes(
        originalName,
        decl,
        currentContext,
        emittedInitializerStorageType,
        emittedInitializerSemanticType
      );
      currentContext = registerConditionAlias(
        originalName,
        stmt.declarationKind,
        decl.initializer,
        currentContext
      );
      if (dictionaryPresenceLocalName) {
        currentContext = registerDictionaryReadPresenceLocal(
          originalName,
          dictionaryPresenceLocalName,
          currentContext
        );
      }

      statements.push({
        kind: "localDeclarationStatement",
        modifiers: [],
        type: typeAst,
        declarators: [{ name: localName, initializer: initAst }],
      });
    }
  }

  return [statements, currentContext];
};
