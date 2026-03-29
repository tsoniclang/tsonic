import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import { stableTypeKeyFromAst } from "../format/backend-ast/utils.js";
import { identifierType } from "../format/backend-ast/builders.js";
import { resolveTypeAlias } from "./type-resolution.js";
import type {
  EmitTypeAstLike,
  RuntimeUnionFrame,
  RuntimeUnionLayout,
} from "./runtime-union-shared.js";
import {
  collectRuntimeUnionRawMembers,
  expandRuntimeUnionMembers,
  isRuntimeUnionElementFamily,
} from "./runtime-union-expansion.js";
import { getRuntimeUnionMemberSortKey } from "./runtime-union-ordering.js";
import { resolveStructuralReferenceType } from "./structural-shape-matching.js";
import {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
  findRuntimeUnionMemberIndex,
  findRuntimeUnionMemberIndices,
} from "./runtime-union-matching.js";
export {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
  findRuntimeUnionMemberIndex,
  findRuntimeUnionMemberIndices,
};
export type {
  EmitTypeAstLike,
  RuntimeUnionFrame,
  RuntimeUnionLayout,
} from "./runtime-union-shared.js";
export {
  getRuntimeUnionReferenceMembers,
  isRuntimeUnionTypeName,
} from "./runtime-union-shared.js";

export const buildRuntimeUnionLayout = (
  type: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): [RuntimeUnionLayout | undefined, EmitterContext] => {
  const frame = buildRuntimeUnionFrame(type, context);
  if (!frame) {
    return [undefined, context];
  }
  const semanticMembers = frame.members;
  const preserveRuntimeLayout =
    type.kind === "unionType" && type.preserveRuntimeLayout === true;

  const orderedMembers: { member: IrType; typeAst: CSharpTypeAst }[] = [];
  const byAstKey = preserveRuntimeLayout
    ? undefined
    : new Map<string, { member: IrType; typeAst: CSharpTypeAst }>();
  let currentContext = context;

  for (const member of semanticMembers) {
    const carrierMember =
      resolveStructuralReferenceType(member, currentContext) ?? member;
    const emissionContext = currentContext.preferResolvedLocalClrIdentity
      ? currentContext
      : { ...currentContext, preferResolvedLocalClrIdentity: true };
    const [typeAst, nextContext] = emitTypeAst(carrierMember, emissionContext);
    currentContext =
      emissionContext === currentContext
        ? nextContext
        : {
            ...nextContext,
            preferResolvedLocalClrIdentity:
              currentContext.preferResolvedLocalClrIdentity,
          };
    if (preserveRuntimeLayout) {
      orderedMembers.push({ member, typeAst });
      continue;
    }
    const key = stableTypeKeyFromAst(typeAst);
    if (byAstKey && !byAstKey.has(key)) {
      byAstKey.set(key, { member, typeAst });
    }
  }

  const ordered = preserveRuntimeLayout
    ? orderedMembers
    : Array.from(byAstKey?.values() ?? []);

  if (ordered.length < 2 || ordered.length > 8) {
    return [undefined, currentContext];
  }

  return [
    {
      members: ordered.map((entry) => entry.member),
      memberTypeAsts: ordered.map((entry) => entry.typeAst),
      runtimeUnionArity: ordered.length,
    },
    currentContext,
  ];
};

export const buildRuntimeUnionTypeAst = (
  layout: RuntimeUnionLayout
): CSharpTypeAst =>
  identifierType("global::Tsonic.Runtime.Union", [...layout.memberTypeAsts]);

export const emitRuntimeCarrierTypeAst = (
  type: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstLike
): [CSharpTypeAst, RuntimeUnionLayout | undefined, EmitterContext] => {
  const [layout, layoutContext] = buildRuntimeUnionLayout(
    type,
    context,
    emitTypeAst
  );
  if (layout) {
    return [buildRuntimeUnionTypeAst(layout), layout, layoutContext];
  }

  const [typeAst, typeContext] = emitTypeAst(type, context);
  return [typeAst, undefined, typeContext];
};

export const buildRuntimeUnionFrame = (
  type: IrType,
  context: EmitterContext
): RuntimeUnionFrame | undefined => {
  const members = getCanonicalRuntimeUnionMembers(type, context);
  if (!members) {
    return undefined;
  }

  return {
    members,
    runtimeUnionArity: members.length,
  };
};

export const hasRuntimeUnionArrayMemberWithRuntimeUnionElements = (
  type: IrType,
  context: EmitterContext
): boolean => {
  return collectRuntimeUnionRawMembers(type, context).some((member) => {
    const resolvedMember = resolveTypeAlias(member, context);
    return (
      resolvedMember.kind === "arrayType" &&
      isRuntimeUnionElementFamily(resolvedMember.elementType, context)
    );
  });
};

export const shouldEraseRecursiveRuntimeUnionArrayElement = (
  type: IrType,
  context: EmitterContext
): boolean => {
  return hasRuntimeUnionArrayMemberWithRuntimeUnionElements(type, context);
};

export const getCanonicalRuntimeUnionMembers = (
  type: IrType,
  context: EmitterContext
): readonly IrType[] | undefined => {
  const preserveRuntimeLayout =
    type.kind === "unionType" && type.preserveRuntimeLayout === true;
  const semanticMembers = preserveRuntimeLayout
    ? collectRuntimeUnionRawMembers(type, context)
    : expandRuntimeUnionMembers(type, context);
  if (semanticMembers.length < 2 || semanticMembers.length > 8) {
    return undefined;
  }

  if (preserveRuntimeLayout) {
    return semanticMembers;
  }

  const deduped = new Map<string, IrType>();
  for (const member of semanticMembers) {
    deduped.set(stableIrTypeKey(member), member);
  }

  return Array.from(deduped.entries())
    .map(([, member]) => member)
    .sort((left, right) => {
      const leftKey = getRuntimeUnionMemberSortKey(left, context);
      const rightKey = getRuntimeUnionMemberSortKey(right, context);
      if (leftKey !== rightKey) {
        return leftKey.localeCompare(rightKey);
      }
      return stableIrTypeKey(left).localeCompare(stableIrTypeKey(right));
    });
};
