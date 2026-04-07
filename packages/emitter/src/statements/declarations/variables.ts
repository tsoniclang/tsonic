/**
 * Variable declaration emission - facade/orchestrator
 *
 * Delegates to:
 * - variable-type-resolution.ts  (type resolution helpers)
 * - variable-static-arrow.ts     (static arrow field emission)
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
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

const registerConditionAlias = (
  originalName: string,
  declarationKind: "const" | "let" | "var",
  initializer: Extract<
    Extract<IrStatement, { kind: "variableDeclaration" }>["declarations"][number],
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
      const modifiers = [
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
      if (decl.initializer) {
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
        const [exprAst, newContext] = emitExpressionAst(
          decl.initializer,
          currentContext,
          expectedInitializerType
        );
        currentContext = newContext;
        const declaredInitializerType =
          decl.type ??
          (decl.initializer.kind === "typeAssertion"
            ? decl.initializer.targetType
            : resolveEffectiveVariableInitializerType(
                decl.initializer,
                currentContext
              ));
        const storageSurfaceNeedsCast =
          decl.initializer.kind === "identifier" &&
          !!declaredInitializerType &&
          !!resolveIdentifierValueSurfaceType(
            decl.initializer,
            currentContext
          ) &&
          !matchesEmittedStorageSurface(
            resolveIdentifierValueSurfaceType(decl.initializer, currentContext),
            declaredInitializerType,
            currentContext
          )[0];
        initAst =
          typeAst.kind !== "varType" &&
          !isExplicitCastLikeAst(exprAst) &&
          (shouldForceDeclaredInitializerCast(
            decl.initializer,
            declaredInitializerType,
            currentContext
          ) ||
            storageSurfaceNeedsCast)
            ? {
                kind: "castExpression" as const,
                type: typeAst,
                expression: exprAst,
              }
            : exprAst;
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
        currentContext
      );
      currentContext = registerConditionAlias(
        originalName,
        stmt.declarationKind,
        decl.initializer,
        currentContext
      );

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
