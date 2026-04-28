/**
 * Variable type resolution — pure helpers for deriving semantic and storage
 * types from variable declarations and their initializers.
 *
 * Lives in core/semantic so both symbol-types.ts (canonical registration)
 * and variables.ts (emitter) can depend on it without cycles.
 */

import {
  getAwaitedIrType,
  type IrExpression,
  type IrStatement,
  type IrType,
  normalizedUnionType,
} from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { identifierExpression } from "../format/backend-ast/builders.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import { normalizeRuntimeStorageType } from "./storage-types.js";
import { getIdentifierTypeName } from "../format/backend-ast/utils.js";
import { resolveDirectStorageIrType } from "./direct-storage-ir-types.js";
import { matchesExpectedEmissionType } from "./expected-type-matching.js";
import { getRuntimeUnionAliasReferenceKey } from "./runtime-union-alias-identity.js";
import { applyConditionBranchNarrowing } from "./condition-branch-narrowing.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import { isAssignableToType } from "./type-compatibility.js";
import { getReferenceDeterministicIdentityKey } from "./clr-type-identity.js";

/**
 * Resolve the target type from an `asinterface` expression, unwrapping
 * tsbindgen's ExtensionMethods wrapper and intersection types.
 */
export const resolveAsInterfaceTargetType = (
  type: IrType,
  context: EmitterContext
): IrType => {
  const resolved = resolveTypeAlias(stripNullish(type), context);

  // Unwrap tsbindgen's `ExtensionMethods<TShape>` wrapper (type-only).
  if (resolved.kind === "referenceType" && resolved.typeArguments?.length) {
    const importBinding = context.importBindings?.get(resolved.name);
    const clrName =
      importBinding?.kind === "type"
        ? (getIdentifierTypeName(importBinding.typeAst) ?? "")
        : "";
    if (clrName.endsWith(".ExtensionMethods")) {
      const shape = resolved.typeArguments[0];
      if (shape) return resolveAsInterfaceTargetType(shape, context);
    }
  }

  if (resolved.kind === "intersectionType") {
    for (const part of resolved.types) {
      const candidate = resolveAsInterfaceTargetType(part, context);
      if (
        candidate.kind === "referenceType" &&
        candidate.name.startsWith("__Ext_")
      ) {
        continue;
      }
      if (
        candidate.kind === "objectType" ||
        candidate.kind === "intersectionType"
      ) {
        continue;
      }
      return candidate;
    }
  }

  return resolved;
};

/**
 * Resolve the semantic (frontend IR) type of a variable initializer.
 *
 * Returns the authored type without CLR storage normalization — alias names,
 * union structure, and type-parameter shapes are preserved exactly as written.
 */
const containsDeterministicReferenceIdentity = (type: IrType): boolean => {
  switch (type.kind) {
    case "referenceType":
      return (
        getReferenceDeterministicIdentityKey(type) !== undefined ||
        (type.typeArguments?.some(containsDeterministicReferenceIdentity) ??
          false)
      );
    case "arrayType":
      return containsDeterministicReferenceIdentity(type.elementType);
    case "dictionaryType":
      return (
        containsDeterministicReferenceIdentity(type.keyType) ||
        containsDeterministicReferenceIdentity(type.valueType)
      );
    case "tupleType":
      return type.elementTypes.some(containsDeterministicReferenceIdentity);
    case "functionType":
      return (
        type.parameters.some(
          (parameter) =>
            !!parameter.type &&
            containsDeterministicReferenceIdentity(parameter.type)
        ) || containsDeterministicReferenceIdentity(type.returnType)
      );
    case "unionType":
    case "intersectionType":
      return type.types.some(containsDeterministicReferenceIdentity);
    default:
      return false;
  }
};

const resolveSourceBackedInitializerType = (
  expression: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  switch (expression.kind) {
    case "call":
    case "new":
      return expression.sourceBackedReturnType;
    case "await": {
      const awaitedSourceType = resolveSourceBackedInitializerType(
        expression.expression,
        context
      );
      if (!awaitedSourceType) {
        return undefined;
      }

      const sourceAwaitedType =
        getAwaitedIrType(awaitedSourceType) ?? awaitedSourceType;
      if (
        expression.inferredType &&
        containsDeterministicReferenceIdentity(sourceAwaitedType) &&
        containsDeterministicReferenceIdentity(expression.inferredType) &&
        !areIrTypesEquivalent(
          sourceAwaitedType,
          expression.inferredType,
          context
        )
      ) {
        return expression.inferredType;
      }

      return sourceAwaitedType;
    }
    default:
      return undefined;
  }
};

const emitConditionNarrowingStub = (_expr: IrExpression, ctx: EmitterContext) =>
  [identifierExpression("__tsonic_narrow"), ctx] as [
    ReturnType<typeof identifierExpression>,
    EmitterContext,
  ];

const resolveConditionalBranchSemanticType = (
  branch: IrExpression,
  context: EmitterContext
): IrType | undefined =>
  resolveSourceBackedInitializerType(branch, context) ??
  resolveEffectiveExpressionType(branch, context) ??
  branch.inferredType;

const resolveConditionalInitializerType = (
  expression: Extract<IrExpression, { kind: "conditional" }>,
  context: EmitterContext
): IrType | undefined => {
  const truthyContext = applyConditionBranchNarrowing(
    expression.condition,
    "truthy",
    context,
    emitConditionNarrowingStub
  );
  const falsyContext = applyConditionBranchNarrowing(
    expression.condition,
    "falsy",
    context,
    emitConditionNarrowingStub
  );
  const whenTrueType = resolveConditionalBranchSemanticType(
    expression.whenTrue,
    truthyContext
  );
  const whenFalseType = resolveConditionalBranchSemanticType(
    expression.whenFalse,
    falsyContext
  );

  if (!whenTrueType) {
    return whenFalseType ?? expression.inferredType;
  }

  if (!whenFalseType) {
    return whenTrueType;
  }

  if (areIrTypesEquivalent(whenTrueType, whenFalseType, context)) {
    return whenTrueType;
  }

  if (isAssignableToType(whenTrueType, whenFalseType, context)) {
    return whenFalseType;
  }

  if (isAssignableToType(whenFalseType, whenTrueType, context)) {
    return whenTrueType;
  }

  return normalizedUnionType([whenTrueType, whenFalseType]);
};

const isTransparentFlowTypeAssertion = (
  expression: Extract<IrExpression, { kind: "typeAssertion" }>
): boolean => {
  const inner = expression.expression;
  if (inner.kind !== "identifier" && inner.kind !== "memberAccess") {
    return false;
  }
  if (!expression.sourceSpan || !inner.sourceSpan) {
    return false;
  }

  return (
    expression.sourceSpan.file === inner.sourceSpan.file &&
    expression.sourceSpan.line === inner.sourceSpan.line &&
    expression.sourceSpan.column === inner.sourceSpan.column &&
    expression.sourceSpan.length === inner.sourceSpan.length
  );
};

const hasExplicitRuntimeUnionCarrierIdentity = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  if (getRuntimeUnionAliasReferenceKey(type, context) !== undefined) {
    return true;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    resolved.kind === "unionType" &&
    resolved.runtimeCarrierFamilyKey !== undefined
  );
};

const shouldPreserveSemanticRuntimeCarrierStorage = (
  semanticType: IrType | undefined,
  initializerStorageType: IrType | undefined,
  context: EmitterContext
): semanticType is IrType => {
  if (
    !semanticType ||
    !hasExplicitRuntimeUnionCarrierIdentity(semanticType, context)
  ) {
    return false;
  }

  return (
    !initializerStorageType ||
    matchesExpectedEmissionType(initializerStorageType, semanticType, context)
  );
};

export const resolveSemanticVariableInitializerType = (
  initializer:
    | {
        readonly kind: string;
        readonly name?: string;
        readonly inferredType?: IrType;
        readonly targetType?: IrType;
      }
    | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!initializer) {
    return undefined;
  }

  const expression = initializer as IrExpression;

  if (expression.kind === "identifier") {
    const narrowedType = context.narrowedBindings?.get(expression.name)?.type;
    if (narrowedType) {
      return narrowedType;
    }
  }

  if (expression.kind === "typeAssertion") {
    if (isTransparentFlowTypeAssertion(expression)) {
      return (
        resolveEffectiveExpressionType(expression.expression, context) ??
        expression.expression.inferredType ??
        expression.targetType
      );
    }
    return expression.targetType;
  }

  if (expression.kind === "asinterface") {
    return resolveAsInterfaceTargetType(expression.targetType, context);
  }

  if (expression.kind === "conditional") {
    return resolveConditionalInitializerType(expression, context);
  }

  const sourceBackedType = resolveSourceBackedInitializerType(
    expression,
    context
  );
  if (sourceBackedType) {
    return sourceBackedType;
  }

  return (
    resolveEffectiveExpressionType(expression, context) ??
    expression.inferredType
  );
};

/**
 * Resolve the expected type for initializer EMISSION.
 *
 * For annotated locals, returns the declared type (an authored contract).
 * For unannotated locals with branch-sensitive initializers (conditionals,
 * ternaries), returns undefined so the conditional-emitter can derive its
 * own branch expectations from narrowed branch contexts — which produces
 * a more precise carrier than storage-normalizing the broad inferred type.
 * For other unannotated locals, returns the semantic initializer type
 * WITHOUT storage normalization.
 */
export const resolveInitializerEmissionExpectedType = (
  declaredType: IrType | undefined,
  initializer:
    | {
        readonly kind: string;
        readonly inferredType?: IrType;
        readonly targetType?: IrType;
      }
    | undefined,
  context: EmitterContext
): IrType | undefined => {
  // Explicit annotation: use it directly (authored contract)
  if (declaredType) {
    return declaredType;
  }

  if (!initializer) {
    return undefined;
  }

  // Branch-sensitive initializers: let the conditional/ternary emitter
  // derive branch expectations from narrowed contexts. Passing a
  // storage-normalized expected type here forces a carrier shape that
  // may not match the actual expression carrier (e.g., alias members
  // collapsed to 'object' by normalizeRuntimeStorageType).
  if (initializer.kind === "conditional") {
    return undefined;
  }

  // Type assertions / as-interface: use the target type
  if (
    initializer.kind === "typeAssertion" ||
    initializer.kind === "asinterface"
  ) {
    return resolveSemanticVariableInitializerType(initializer, context);
  }

  // Numeric narrowing: use the inferred type directly
  if (initializer.kind === "numericNarrowing") {
    return (initializer as { readonly inferredType?: IrType }).inferredType;
  }

  // Other initializers: use the semantic type (not storage-normalized)
  return resolveSemanticVariableInitializerType(initializer, context);
};

/**
 * Resolve the storage-normalized initializer type for a variable.
 *
 * This is the semantic initializer type passed through normalizeRuntimeStorageType.
 * Used for local storage type registration (resolveLocalStorageType) and
 * post-emission storage reasoning — NOT for initializer emission expectations.
 * For emission expected types, use resolveInitializerEmissionExpectedType.
 */
export const resolveEffectiveVariableInitializerType = (
  initializer:
    | {
        readonly kind: string;
        readonly inferredType?: IrType;
        readonly targetType?: IrType;
      }
    | undefined,
  context: EmitterContext
): IrType | undefined => {
  const semantic = resolveSemanticVariableInitializerType(initializer, context);
  return normalizeRuntimeStorageType(semantic, context) ?? semantic;
};

/** Inline type for variable declarator shape used by registration. */
export type VariableDeclaratorLike = {
  readonly type?: IrType;
  readonly initializer?: Extract<
    IrStatement,
    { kind: "variableDeclaration" }
  >["declarations"][number]["initializer"];
};

/**
 * Resolve the CLR storage type for a variable declaration.
 *
 * Uses the explicit type annotation or the initializer's storage-aware type.
 *
 * Some expressions intentionally emit through a broader CLR storage surface than
 * their semantic IR type (for example JS-surface dictionary safe reads that
 * carry `undefined` in storage). Reusing the direct storage IR type here keeps
 * localValueTypes aligned with the emitted initializer surface so later
 * expected-type adaptation can materialize the required concrete value.
 */
export const resolveLocalStorageType = (
  decl: VariableDeclaratorLike,
  context: EmitterContext
): IrType | undefined => {
  const initializerStorageType = decl.initializer
    ? resolveDirectStorageIrType(decl.initializer, context)
    : undefined;
  const semanticInitializerType =
    !decl.type && decl.initializer
      ? resolveSemanticVariableInitializerType(decl.initializer, context)
      : undefined;
  if (
    shouldPreserveSemanticRuntimeCarrierStorage(
      semanticInitializerType,
      initializerStorageType,
      context
    )
  ) {
    return semanticInitializerType;
  }

  const sourceType =
    decl.type ??
    initializerStorageType ??
    resolveEffectiveVariableInitializerType(decl.initializer, context);

  return normalizeRuntimeStorageType(sourceType, context);
};
