/**
 * Variable type resolution — pure helpers for deriving semantic and storage
 * types from variable declarations and their initializers.
 *
 * Lives in core/semantic so both symbol-types.ts (canonical registration)
 * and variables.ts (emitter) can depend on it without cycles.
 */

import type { IrExpression, IrStatement, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import { normalizeRuntimeStorageType } from "./storage-types.js";
import { getIdentifierTypeName } from "../format/backend-ast/utils.js";

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
export const resolveSemanticVariableInitializerType = (
  initializer:
    | {
        readonly kind: string;
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

  if (expression.kind === "typeAssertion") {
    return expression.targetType;
  }

  if (expression.kind === "asinterface") {
    return resolveAsInterfaceTargetType(expression.targetType, context);
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
 * Uses the explicit type annotation or the storage-normalized initializer type.
 */
export const resolveLocalStorageType = (
  decl: VariableDeclaratorLike,
  context: EmitterContext
): IrType | undefined => {
  const sourceType =
    decl.type ??
    resolveEffectiveVariableInitializerType(decl.initializer, context);

  return normalizeRuntimeStorageType(sourceType, context);
};
