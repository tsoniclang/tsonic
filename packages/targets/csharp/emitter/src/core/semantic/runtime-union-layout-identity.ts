import type { RuntimeUnionLayout } from "./runtime-union-shared.js";
import {
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../format/backend-ast/utils.js";

export const runtimeUnionLayoutsHaveSameSlotIdentity = (
  left: RuntimeUnionLayout,
  right: RuntimeUnionLayout
): boolean =>
  left.runtimeUnionArity === right.runtimeUnionArity &&
  left.memberTypeAsts.length === right.memberTypeAsts.length &&
  left.memberTypeAsts.every((memberTypeAst, index) => {
    const rightMemberTypeAst = right.memberTypeAsts[index];
    return (
      rightMemberTypeAst !== undefined &&
      sameTypeAstSurface(
        stripNullableTypeAst(memberTypeAst),
        stripNullableTypeAst(rightMemberTypeAst)
      )
    );
  });
