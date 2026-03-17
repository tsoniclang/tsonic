import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  isDefinitelyValueType,
  resolveTypeAlias,
  stripNullish,
} from "./type-resolution.js";

const addUndefinedBranch = (type: IrType): IrType => {
  if (
    type.kind === "unionType" &&
    type.types.some(
      (member) => member.kind === "primitiveType" && member.name === "undefined"
    )
  ) {
    return type;
  }

  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

export const getAcceptedSurfaceType = (
  type: IrType | undefined,
  isOptional: boolean
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  if (!isOptional) {
    return type;
  }

  return addUndefinedBranch(type);
};

export const getAcceptedParameterType = (
  parameterType: IrType | undefined,
  isOptional: boolean
): IrType | undefined => getAcceptedSurfaceType(parameterType, isOptional);

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
