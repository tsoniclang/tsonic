/**
 * Identifier and type argument emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import {
  identifierExpression,
  identifierType,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import {
  getIdentifierTypeName,
  stableIdentifierSuffixFromTypeAst,
  stableTypeKeyFromAst,
} from "../core/format/backend-ast/utils.js";
import { emitTypedDefaultAst } from "../core/semantic/defaults.js";
import {
  buildRuntimeUnionLayout,
  findRuntimeUnionMemberIndex,
} from "../core/semantic/runtime-unions.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { isAssignable } from "../core/semantic/index.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

const unwrapNullableTypeAst = (typeAst: CSharpTypeAst): CSharpTypeAst =>
  typeAst.kind === "nullableType" ? typeAst.underlyingType : typeAst;

const isRuntimeUnionTypeAst = (typeAst: CSharpTypeAst): boolean => {
  const concrete = unwrapNullableTypeAst(typeAst);
  const name = getIdentifierTypeName(concrete);
  return (
    name === "global::Tsonic.Runtime.Union" ||
    name === "Tsonic.Runtime.Union" ||
    name === "Union"
  );
};

const buildUnionFactoryCallAst = (
  unionTypeAst: CSharpTypeAst,
  memberIndex: number,
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: {
      kind: "typeReferenceExpression",
      type: unionTypeAst,
    },
    memberName: `From${memberIndex}`,
  },
  arguments: [valueAst],
});

const buildInvalidRuntimeUnionCastExpression = (
  actualType: IrType,
  expectedType: IrType
): CSharpExpressionAst => ({
  kind: "throwExpression",
  expression: {
    kind: "objectCreationExpression",
    type: identifierType("global::System.InvalidCastException"),
    arguments: [
      stringLiteral(
        `Cannot cast runtime union ${actualType.kind} to ${expectedType.kind}`
      ),
    ],
  },
});

const buildRuntimeSubsetExpressionAst = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const sourceType = narrowed.sourceType ?? expr.inferredType;
  const subsetType = narrowed.type;
  if (!sourceType || !subsetType) {
    return undefined;
  }

  const [sourceLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    sourceType,
    context,
    emitTypeAst
  );
  if (!sourceLayout) {
    return undefined;
  }

  const [subsetLayout, subsetLayoutContext] = buildRuntimeUnionLayout(
    subsetType,
    sourceLayoutContext,
    emitTypeAst
  );
  if (!subsetLayout) {
    return undefined;
  }

  const [subsetTypeAst, subsetTypeContext] = emitTypeAst(
    subsetType,
    subsetLayoutContext
  );
  const concreteSubsetTypeAst = unwrapNullableTypeAst(subsetTypeAst);
  if (!isRuntimeUnionTypeAst(concreteSubsetTypeAst)) {
    return undefined;
  }

  const expectedMemberIndexByAstKey = new Map<string, number>();
  for (let index = 0; index < subsetLayout.memberTypeAsts.length; index += 1) {
    const memberTypeAst = subsetLayout.memberTypeAsts[index];
    if (!memberTypeAst) continue;
    expectedMemberIndexByAstKey.set(stableTypeKeyFromAst(memberTypeAst), index);
  }

  const selectedRuntimeMembers = new Set(narrowed.runtimeMemberNs);
  const lambdaArgs: CSharpExpressionAst[] = [];

  for (let index = 0; index < sourceLayout.members.length; index += 1) {
    const actualMember = sourceLayout.members[index];
    if (!actualMember) continue;

    const parameterName = `__tsonic_union_member_${index + 1}`;
    const parameterExpr: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: parameterName,
    };

    if (!selectedRuntimeMembers.has(index + 1)) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeUnionCastExpression(actualMember, subsetType),
      });
      continue;
    }

    const actualMemberTypeAst = sourceLayout.memberTypeAsts[index];
    const expectedMemberIndex =
      (actualMemberTypeAst
        ? expectedMemberIndexByAstKey.get(
            stableTypeKeyFromAst(actualMemberTypeAst)
          )
        : undefined) ??
      findRuntimeUnionMemberIndex(
        subsetLayout.members,
        actualMember,
        subsetTypeContext
      );

    if (expectedMemberIndex === undefined) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeUnionCastExpression(actualMember, subsetType),
      });
      continue;
    }

    lambdaArgs.push({
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [{ name: parameterName }],
      body: buildUnionFactoryCallAst(
        concreteSubsetTypeAst,
        expectedMemberIndex + 1,
        parameterExpr
      ),
    });
  }

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression(escapeCSharpIdentifier(expr.name)),
        memberName: "Match",
      },
      arguments: lambdaArgs,
    },
    subsetTypeContext,
  ];
};

const tryEmitStorageCompatibleIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): CSharpExpressionAst | undefined => {
  if (!expectedType) {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  const effectiveType = resolveEffectiveExpressionType(expr, context);
  if (isAssignable(effectiveType, expectedType)) {
    return undefined;
  }

  if (!isAssignable(storageType, expectedType)) {
    return undefined;
  }

  return identifierExpression(remappedLocal);
};

/**
 * Emit an identifier as CSharpExpressionAst
 */
export const emitIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  // Special case for undefined -> default
  if (expr.name === "undefined") {
    if (
      expectedType?.kind === "typeParameterType" ||
      (expectedType?.kind === "primitiveType" &&
        expectedType.name === "undefined")
    ) {
      return [
        {
          kind: "defaultExpression",
          type: { kind: "predefinedType", keyword: "object" },
        },
        context,
      ];
    }
    if (expectedType) {
      const [typeAst, nextContext] = emitTypedDefaultAst(expectedType, context);
      return [{ kind: "defaultExpression", type: typeAst }, nextContext];
    }
    return [{ kind: "defaultExpression" }, context];
  }

  // TypeScript `super` maps to C# `base` for member access/calls.
  // (`super()` constructor calls are handled separately in constructor emission.)
  if (expr.name === "super") {
    return [identifierExpression("base"), context];
  }

  // Narrowing remap for union type guards
  // - "rename": account -> account__1_3 (if-statements with temp var)
  // - "expr": account -> (account.As1()) (ternary expressions, inline)
  if (context.narrowedBindings) {
    const narrowed = context.narrowedBindings.get(expr.name);
    if (narrowed) {
      const storageFallback = tryEmitStorageCompatibleIdentifier(
        expr,
        context,
        expectedType
      );
      if (storageFallback) {
        return [storageFallback, context];
      }

      if (narrowed.kind === "rename") {
        return [
          identifierExpression(escapeCSharpIdentifier(narrowed.name)),
          context,
        ];
      } else if (narrowed.kind === "expr") {
        // kind === "expr" - emit pre-built AST (e.g., parenthesized AsN() call)
        return [narrowed.exprAst, context];
      } else if (narrowed.kind === "runtimeSubset") {
        const subsetAst = buildRuntimeSubsetExpressionAst(
          expr,
          narrowed,
          context
        );
        if (subsetAst) {
          return subsetAst;
        }
      }

      return [identifierExpression(escapeCSharpIdentifier(expr.name)), context];
    }
  }

  // Lexical remap for locals/parameters (prevents C# CS0136 shadowing errors).
  const remappedLocal = context.localNameMap?.get(expr.name);
  if (remappedLocal) {
    return [identifierExpression(remappedLocal), context];
  }

  // Check if this identifier is from an import
  if (context.importBindings) {
    const binding = context.importBindings.get(expr.name);
    if (binding) {
      // Imported identifier - always use fully-qualified reference
      if (binding.kind === "value") {
        // Value import with member - Container.member
        return [
          identifierExpression(`${binding.clrName}.${binding.member}`),
          context,
        ];
      }
      if (binding.kind === "type") {
        return [
          {
            kind: "typeReferenceExpression",
            type: binding.typeAst,
          },
          context,
        ];
      }
      // Namespace import - use precomputed container name directly
      return [identifierExpression(binding.clrName), context];
    }
  }

  // Static module members (functions/fields) in the current file's container class.
  // These are emitted with namingPolicy (e.g., `main` → `Main` under `clr`).
  const valueSymbol = context.valueSymbols?.get(expr.name);
  if (valueSymbol) {
    const memberName = escapeCSharpIdentifier(valueSymbol.csharpName);
    if (
      context.moduleStaticClassName &&
      context.className !== context.moduleStaticClassName
    ) {
      return [
        identifierExpression(`${context.moduleStaticClassName}.${memberName}`),
        context,
      ];
    }
    return [identifierExpression(memberName), context];
  }

  // Use custom C# name from binding if specified (with global:: prefix)
  if (expr.csharpName && expr.resolvedAssembly) {
    const fqn = `global::${expr.resolvedAssembly}.${expr.csharpName}`;
    return [identifierExpression(fqn), context];
  }

  // Use resolved binding if available (from binding manifest) with global:: prefix
  // resolvedClrType is already the full CLR type name, just add global::
  if (expr.resolvedClrType) {
    const fqn = `global::${expr.resolvedClrType}`;
    return [identifierExpression(fqn), context];
  }

  // Fallback: use identifier as-is (escape C# keywords)
  return [identifierExpression(escapeCSharpIdentifier(expr.name)), context];
};

/**
 * Emit type arguments as CSharpTypeAst[]
 */
export const emitTypeArgumentAsts = (
  typeArgs: readonly IrType[],
  context: EmitterContext
): [CSharpTypeAst[], EmitterContext] => {
  if (!typeArgs || typeArgs.length === 0) {
    return [[], context];
  }

  let currentContext = context;
  const typeAsts: CSharpTypeAst[] = [];

  for (const typeArg of typeArgs) {
    const [typeAst, newContext] = emitTypeAst(typeArg, currentContext);
    currentContext = newContext;
    typeAsts.push(typeAst);
  }

  return [typeAsts, currentContext];
};

/**
 * Emit type arguments as typed CSharpTypeAst array.
 * Returns empty array for empty/null type arguments.
 */
export const emitTypeArgumentsAst = (
  typeArgs: readonly IrType[],
  context: EmitterContext
): [readonly CSharpTypeAst[], EmitterContext] => {
  if (!typeArgs || typeArgs.length === 0) {
    return [[], context];
  }

  let currentContext = context;
  const typeAsts: CSharpTypeAst[] = [];

  for (const typeArg of typeArgs) {
    const [typeAst, newContext] = emitTypeAst(typeArg, currentContext);
    currentContext = newContext;
    typeAsts.push(typeAst);
  }

  return [typeAsts, currentContext];
};

/**
 * Generate specialized method/class name from type arguments
 * Example: process with [string, number] → process__string__double
 */
export const generateSpecializedName = (
  baseName: string,
  typeArgs: readonly IrType[],
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;
  const typeNames: string[] = [];

  for (const typeArg of typeArgs) {
    const [typeAst, newContext] = emitTypeAst(typeArg, currentContext);
    currentContext = newContext;
    typeNames.push(stableIdentifierSuffixFromTypeAst(typeAst));
  }

  const specializedName = `${baseName}__${typeNames.join("__")}`;
  return [specializedName, currentContext];
};
