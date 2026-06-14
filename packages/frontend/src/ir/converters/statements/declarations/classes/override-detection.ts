/**
 * Override detection for class members
 *
 * Uses TypeSystem exclusively for declaration queries.
 */

import {
  getTstsExpressionName,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import type { ProgramContext } from "../../../../program-context.js";
import type { IrParameter } from "../../../../types.js";
import {
  externalSignatureTypeKey,
  type ExternalMemberMetadata,
} from "../../../../../external-metadata.js";
import { resolveHeritageReferenceType } from "../../../heritage-reference-type.js";

export type OverrideInfo = {
  readonly isOverride: boolean;
  readonly isShadow: boolean;
  /**
   * Required target accessibility for an override against a native target base member.
   *
   * native target `protected internal` members must be overridden as `protected` in
   * generated source when the override is emitted from a different assembly.
   * TypeScript cannot express these native target distinctions directly, so we
   * normalize them from bindings metadata here.
   */
  readonly requiredAccessibility?:
    | "public"
    | "protected"
    | "internal"
    | "protected internal"
    | "private";
};

/**
 * Check if a method/property should be marked as override based on base class metadata.
 * DETERMINISTIC: Uses Binding API for symbol resolution.
 */
export const detectOverride = (
  memberName: string,
  memberKind: "method" | "property",
  superClass: TstsNode | undefined,
  ctx: ProgramContext,
  parameters?: readonly IrParameter[]
): OverrideInfo => {
  if (!superClass) {
    return { isOverride: false, isShadow: false };
  }

  const heritageType = resolveHeritageReferenceType(superClass, ctx);
  const heritageTargetName =
    heritageType.kind === "referenceType"
      ? heritageType.providerQualifiedName
      : undefined;

  if (heritageTargetName && ctx.metadata.getTypeMetadata(heritageTargetName)) {
    return detectExternalOverride(
      memberName,
      memberKind,
      heritageTargetName,
      ctx,
      parameters
    );
  }

  // DETERMINISTIC: Get base class name directly from AST
  // For simple identifiers, get the name; for qualified names, get the full path
  const superExpression = TstsSyntax.Node_Expression(superClass);
  const baseClassName =
    superExpression?.Kind === TstsSyntax.KindIdentifier
      ? TstsSyntax.Node_Text(superExpression)
      : superExpression?.Kind === TstsSyntax.KindPropertyAccessExpression
        ? getFullPropertyAccessName(superExpression)
        : undefined;

  if (!baseClassName) {
    return { isOverride: false, isShadow: false };
  }

  // Try to resolve the identifier to get more context
  const declId =
    superExpression?.Kind === TstsSyntax.KindIdentifier
      ? ctx.binding.resolveIdentifier(superExpression)
      : undefined;

  // Get qualified name from Binding (works for both TS and tsbindgen declarations).
  const qualifiedName = declId
    ? ctx.binding.getFullyQualifiedName(declId)
    : baseClassName;

  if (qualifiedName && ctx.metadata.getTypeMetadata(qualifiedName)) {
    return detectExternalOverride(
      memberName,
      memberKind,
      qualifiedName,
      ctx,
      parameters
    );
  }

  if (declId) {
    return ctx.typeSystem.checkTsClassMemberOverride(
      declId,
      memberName,
      memberKind,
      parameters,
      heritageType
    );
  }

  return { isOverride: false, isShadow: false };
};

/**
 * Get full property access name (e.g., "Provider.Collections.Generic.List")
 */
const getFullPropertyAccessName = (
  expr: TstsNode
): string => {
  const name = getTstsExpressionName(expr);
  const parts: string[] = name ? [name] : [];
  let current = TstsSyntax.Node_Expression(expr);

  while (current?.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const currentName = getTstsExpressionName(current);
    if (currentName) parts.unshift(currentName);
    current = TstsSyntax.Node_Expression(current);
  }

  if (current?.Kind === TstsSyntax.KindIdentifier) {
    const currentText = TstsSyntax.Node_Text(current);
    if (currentText) parts.unshift(currentText);
  }

  return parts.join(".");
};

/**
 * Detect override for external base classes using metadata
 */
const detectExternalOverride = (
  memberName: string,
  memberKind: "method" | "property",
  qualifiedName: string,
  ctx: ProgramContext,
  parameters?: readonly IrParameter[]
): OverrideInfo => {
  const toOverrideAccessibility = (
    visibility: ExternalVisibility | undefined
  ): OverrideInfo["requiredAccessibility"] =>
    visibility === "protected internal" ? "protected" : visibility;

  if (memberKind === "method" && parameters) {
    const parameterTypes: string[] = [];
    for (const p of parameters) {
      const token = externalSignatureTypeKey(p.type);
      if (!token) {
        return { isOverride: false, isShadow: false };
      }

      parameterTypes.push(token);
    }

    const modifiersKey = buildParameterModifiersKey(parameters);

    const meta = ctx.metadata.getMethodMetadata(
      qualifiedName,
      memberName,
      parameterTypes,
      modifiersKey
    );

    // If we can't deterministically resolve the overload, leave it unresolved.
    if (!meta) return { isOverride: false, isShadow: false };

    const canOverride = meta.virtual === true && meta.sealed !== true;
    return {
      isOverride: canOverride,
      isShadow: !canOverride,
      requiredAccessibility: canOverride
        ? toOverrideAccessibility(meta.visibility)
        : undefined,
    };
  } else if (memberKind === "property") {
    // For properties, check without parameters
    const meta = ctx.metadata.getPropertyMetadata(qualifiedName, memberName);
    if (!meta) return { isOverride: false, isShadow: false };

    const canOverride = meta.virtual === true && meta.sealed !== true;
    return {
      isOverride: canOverride,
      isShadow: !canOverride,
      requiredAccessibility: canOverride
        ? toOverrideAccessibility(meta.visibility)
        : undefined,
    };
  }

  return { isOverride: false, isShadow: false };
};

type ExternalVisibility = NonNullable<ExternalMemberMetadata["visibility"]>;

const buildParameterModifiersKey = (params: readonly IrParameter[]): string => {
  const mods: Array<{ index: number; modifier: string }> = [];
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (!p) continue;
    if (p.passing === "value") continue;
    mods.push({ index: i, modifier: p.passing });
  }
  if (mods.length === 0) return "";
  return mods
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((m) => `${m.index}:${m.modifier}`)
    .join(",");
};
