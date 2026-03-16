import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  isDefinitelyValueType,
  resolveTypeAlias,
  stripNullish,
} from "./type-resolution.js";

const getSingleNonNullishMember = (type: IrType): IrType | undefined => {
  if (type.kind !== "unionType") {
    return undefined;
  }

  const nonNullish = type.types.filter(
    (member) =>
      !(
        member.kind === "primitiveType" &&
        (member.name === "null" || member.name === "undefined")
      )
  );

  if (nonNullish.length !== 1) {
    return undefined;
  }

  return nonNullish[0];
};

export const emitTypedDefaultAst = (
  expectedType: IrType | undefined,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] => {
  if (!expectedType) {
    return [undefined, context];
  }

  const singleNonNullish = getSingleNonNullishMember(expectedType);
  const nullableBase = singleNonNullish ?? stripNullish(expectedType);
  const resolvedBase = resolveTypeAlias(nullableBase, context);

  if (singleNonNullish && isDefinitelyValueType(resolvedBase)) {
    const [underlyingTypeAst, nextContext] = emitTypeAst(nullableBase, context);
    return [
      {
        kind: "nullableType",
        underlyingType: underlyingTypeAst,
      },
      nextContext,
    ];
  }

  const [typeAst, nextContext] = emitTypeAst(
    singleNonNullish ?? expectedType,
    context
  );
  return [typeAst, nextContext];
};
