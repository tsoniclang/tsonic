/**
 * Property membership checks and structural type analysis.
 *
 * Deterministic property membership:
 * - hasDeterministicPropertyMembership: Check if a type has a property
 * - getAllPropertySignatures: Get all property signatures for a type
 * - collectInterfaceProps: Recursive interface property collection
 * - isTypeOnlyStructuralTarget: Check if a type is purely structural
 * - isCompilerGeneratedStructuralCarrierType: Detect compiler-generated carriers
 */

import type { IrType, IrPropertySignature } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { LocalTypeInfo } from "../../emitter-types/core.js";
import { resolveTypeAlias, stripNullish } from "./nullish-value-helpers.js";
import {
  getPropertyType,
  resolveLocalTypeInfo,
  resolveBindingBackedPropertySignatures,
} from "./property-lookup-resolution.js";

const stripGlobalPrefix = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

const getTypeMemberIndexCandidates = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): readonly string[] | undefined => {
  const index = context.options.typeMemberIndex;
  if (!index) return undefined;

  if (ref.typeId?.clrName) {
    return [stripGlobalPrefix(ref.typeId.clrName)];
  }

  if (ref.resolvedClrType) {
    return [stripGlobalPrefix(ref.resolvedClrType)];
  }

  if (ref.name.includes(".")) {
    return [ref.name];
  }

  const matches: string[] = [];
  for (const fqn of index.keys()) {
    if (fqn.endsWith(`.${ref.name}`) || fqn.endsWith(`.${ref.name}__Alias`)) {
      matches.push(fqn);
    }
  }

  if (matches.length <= 1) {
    return matches;
  }

  const list = matches.sort().join(", ");
  throw new Error(
    `ICE: Ambiguous type member index entry for '${ref.name}'. Candidates: ${list}`
  );
};

export const hasDeterministicPropertyMembership = (
  type: IrType,
  propertyName: string,
  context: EmitterContext
): boolean | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "objectType") {
    return resolved.members.some(
      (member) =>
        member.kind === "propertySignature" && member.name === propertyName
    );
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  if (resolved.structuralMembers?.length) {
    return resolved.structuralMembers.some(
      (member) =>
        member.kind === "propertySignature" && member.name === propertyName
    );
  }

  if (getPropertyType(resolved, propertyName, context)) {
    return true;
  }

  const knownProps = getAllPropertySignatures(resolved, context);
  if (knownProps) {
    return knownProps.some((member) => member.name === propertyName);
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (localInfo?.kind === "class") {
    return localInfo.members.some(
      (member) =>
        (member.kind === "propertyDeclaration" ||
          member.kind === "methodDeclaration") &&
        member.name === propertyName
    );
  }

  const candidates = getTypeMemberIndexCandidates(resolved, context);
  if (!candidates || candidates.length === 0) {
    return undefined;
  }

  return candidates.some((fqn) => {
    const perType = context.options.typeMemberIndex?.get(fqn);
    return perType?.has(propertyName) ?? false;
  });
};

/**
 * Get all property signatures for a type, including inherited interface members.
 *
 * Notes:
 * - Only supports referenceType -> local interface lookup (synthetic union members are always interfaces).
 * - Derived members override base members by name.
 * - Cycle-safe via visitedTypes.
 */
export const getAllPropertySignatures = (
  type: IrType,
  context: EmitterContext
): readonly IrPropertySignature[] | undefined => {
  // We only expect nominal reference types here (Result__0<T,E>, etc.)
  if (type.kind !== "referenceType") return undefined;

  const typeInfoResult = resolveLocalTypeInfo(type, context);
  if (!typeInfoResult) {
    return resolveBindingBackedPropertySignatures(type, context);
  }
  const typeInfo = typeInfoResult.info;
  if (!typeInfo || typeInfo.kind !== "interface") return undefined;

  // Collect into a map so derived overrides base by name deterministically
  const propMap = new Map<string, IrPropertySignature>();

  collectInterfaceProps(type, typeInfo, context, propMap, []);
  return [...propMap.values()];
};

/**
 * Recursive interface property collection.
 *
 * Ordering is important:
 * - Add own members first (so they override bases).
 * - Then walk extends for missing names.
 */
const collectInterfaceProps = (
  ref: Extract<IrType, { kind: "referenceType" }>,
  typeInfo: Extract<LocalTypeInfo, { kind: "interface" }>,
  context: EmitterContext,
  out: Map<string, IrPropertySignature>,
  visitedTypes: readonly string[]
): void => {
  // Prevent cycles
  const cycleKey = ref.resolvedClrType ?? ref.name;
  if (visitedTypes.includes(cycleKey)) return;
  const nextVisited = [...visitedTypes, cycleKey];

  // Add own properties first (derived overrides base)
  for (const m of typeInfo.members) {
    if (m.kind === "propertySignature") {
      out.set(m.name, m);
    }
  }

  // Walk base interfaces
  for (const base of typeInfo.extends) {
    if (base.kind !== "referenceType") continue;
    const baseInfoResult = resolveLocalTypeInfo(base, context);
    const baseInfo = baseInfoResult?.info;
    if (!baseInfo || baseInfo.kind !== "interface") continue;

    // Recurse. If derived already set the name, we keep the derived one.
    const basePropMap = new Map<string, IrPropertySignature>();
    collectInterfaceProps(base, baseInfo, context, basePropMap, nextVisited);

    for (const [name, sig] of basePropMap.entries()) {
      if (!out.has(name)) {
        out.set(name, sig);
      }
    }
  }
};

/**
 * True when a type is purely structural/type-only at runtime.
 *
 * Type assertions to these targets must be erased rather than emitted as
 * CLR casts, because there is no meaningful runtime conversion.
 */
export const isTypeOnlyStructuralTarget = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "objectType") {
    return true;
  }

  if (resolved.kind !== "referenceType") {
    return false;
  }

  if (isCompilerGeneratedStructuralCarrierType(resolved)) {
    return true;
  }

  if (resolved.resolvedClrType) {
    return false;
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (
    localInfo?.kind === "class" &&
    !isCompilerGeneratedStructuralCarrierType(resolved)
  ) {
    return false;
  }

  if (resolved.structuralMembers && resolved.structuralMembers.length > 0) {
    return true;
  }

  if (localInfo?.kind === "interface") {
    return true;
  }

  if (localInfo?.kind === "typeAlias") {
    return isTypeOnlyStructuralTarget(localInfo.type, context);
  }

  const inheritedProps = getAllPropertySignatures(resolved, context);
  return inheritedProps !== undefined && inheritedProps.length > 0;
};

const isCompilerGeneratedStructuralCarrierType = (
  type: Extract<IrType, { kind: "referenceType" }>
): boolean => {
  const simpleName = type.name.split(".").pop() ?? type.name;
  const clrSimpleName = type.resolvedClrType?.split(".").pop();
  const isCarrierName = (name: string | undefined): boolean =>
    !!name && (name.startsWith("__Anon_") || name.startsWith("__Rest_"));

  return isCarrierName(simpleName) || isCarrierName(clrSimpleName);
};
