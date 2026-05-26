import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import { stableTypeKeyFromAst } from "../format/backend-ast/utils.js";
import {
  resolveTypeAlias,
  stripNullish,
  unionMemberMatchesTarget,
} from "./type-resolution.js";
import { runtimeUnionAliasReferencesMatch } from "./runtime-union-alias-identity.js";

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
}): number | undefined => {
  const astMatch = opts.actualMemberTypeAst
    ? opts.targetMemberIndexByAstKey.get(
        stableTypeKeyFromAst(opts.actualMemberTypeAst)
      )
    : undefined;
  if (astMatch !== undefined) {
    return astMatch;
  }

  const actualMemberIsRuntimeUnion =
    resolveTypeAlias(stripNullish(opts.actualMember), opts.context).kind ===
    "unionType";
  const semanticMatch = opts.targetMembers.findIndex((targetMember) => {
    if (
      runtimeUnionAliasReferencesMatch(
        opts.actualMember,
        targetMember,
        opts.context
      )
    ) {
      return true;
    }

    if (
      actualMemberIsRuntimeUnion &&
      resolveTypeAlias(stripNullish(targetMember), opts.context).kind !==
        "unionType"
    ) {
      return false;
    }

    return unionMemberMatchesTarget(
      opts.actualMember,
      targetMember,
      opts.context
    );
  });
  return semanticMatch >= 0 ? semanticMatch : undefined;
};
