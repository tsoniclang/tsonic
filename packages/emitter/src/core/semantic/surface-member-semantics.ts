import type { IrExpression, SurfaceMemberSemantics } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";

type MemberBinding = NonNullable<
  Extract<IrExpression, { kind: "memberAccess" }>["memberBinding"]
>;

const stripGlobalPrefix = (typeName: string): string =>
  typeName.startsWith("global::")
    ? typeName.slice("global::".length)
    : typeName;

const stripClrGenericArity = (typeName: string): string =>
  typeName.replace(/`\d+$/, "");

const getTypeNameCandidates = (typeName: string): readonly string[] => {
  const candidates = new Set<string>();
  const withoutGlobal = stripGlobalPrefix(typeName.trim());
  const withoutArity = stripClrGenericArity(withoutGlobal);

  if (typeName.trim().length > 0) {
    candidates.add(typeName.trim());
  }
  if (withoutGlobal.length > 0) {
    candidates.add(withoutGlobal);
  }
  if (withoutArity.length > 0) {
    candidates.add(withoutArity);
    candidates.add(`global::${withoutArity}`);
  }

  return [...candidates];
};

export const getSurfaceMemberSemantics = (
  binding: MemberBinding,
  context: EmitterContext
): SurfaceMemberSemantics | undefined => {
  const memberSemantics = context.options.surfaceCapabilities?.memberSemantics;
  if (!memberSemantics) return undefined;

  for (const typeName of getTypeNameCandidates(binding.type)) {
    const members = memberSemantics[typeName];
    const semantics = members?.[binding.member];
    if (semantics) {
      return semantics;
    }
  }

  return undefined;
};

export const surfaceMemberMutatesReceiver = (
  binding: MemberBinding,
  context: EmitterContext
): boolean =>
  getSurfaceMemberSemantics(binding, context)?.mutatesReceiver === true;

export const surfaceMemberReturnsReceiver = (
  binding: MemberBinding,
  context: EmitterContext
): boolean =>
  getSurfaceMemberSemantics(binding, context)?.returnsReceiver === true;

export const surfaceMemberReturnsArray = (
  binding: MemberBinding,
  context: EmitterContext
): boolean =>
  getSurfaceMemberSemantics(binding, context)?.returnsArray === true;

export const surfaceMemberReadsArrayLength = (
  binding: MemberBinding,
  context: EmitterContext
): boolean =>
  getSurfaceMemberSemantics(binding, context)?.storageAccess === "arrayLength";

export const getSurfaceEmittedMemberName = (
  binding: MemberBinding,
  context: EmitterContext
): string | undefined =>
  getSurfaceMemberSemantics(binding, context)?.emittedMemberName;

export const surfaceMemberEmitsAsInstanceMember = (
  binding: MemberBinding,
  context: EmitterContext
): boolean =>
  getSurfaceMemberSemantics(binding, context)?.emissionKind ===
  "instanceMember";
