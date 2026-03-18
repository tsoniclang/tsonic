import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import { stableTypeKeyFromAst } from "../format/backend-ast/utils.js";
import { findRuntimeUnionMemberIndex } from "./runtime-unions.js";

export const buildRuntimeUnionMemberIndexByAstKey = (
  memberTypeAsts: readonly CSharpTypeAst[]
): ReadonlyMap<string, number> => {
  const memberIndexByAstKey = new Map<string, number>();
  for (let index = 0; index < memberTypeAsts.length; index += 1) {
    const memberTypeAst = memberTypeAsts[index];
    if (!memberTypeAst) continue;
    memberIndexByAstKey.set(stableTypeKeyFromAst(memberTypeAst), index);
  }
  return memberIndexByAstKey;
};

export const findMappedRuntimeUnionMemberIndex = (opts: {
  readonly targetMembers: readonly IrType[];
  readonly targetMemberIndexByAstKey: ReadonlyMap<string, number>;
  readonly actualMember: IrType;
  readonly actualMemberTypeAst?: CSharpTypeAst;
  readonly context: EmitterContext;
}): number | undefined =>
  (opts.actualMemberTypeAst
    ? opts.targetMemberIndexByAstKey.get(
        stableTypeKeyFromAst(opts.actualMemberTypeAst)
      )
    : undefined) ??
  findRuntimeUnionMemberIndex(
    opts.targetMembers,
    opts.actualMember,
    opts.context
  );
