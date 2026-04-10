import { IrType } from "@tsonic/frontend";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import type { EmitterContext } from "../../types.js";

export type EmitTypeAstLike = (
  type: IrType,
  context: EmitterContext
) => [CSharpTypeAst, EmitterContext];

export type RuntimeUnionLayout = {
  readonly members: readonly IrType[];
  readonly memberTypeAsts: readonly CSharpTypeAst[];
  readonly runtimeUnionArity: number;
  readonly carrierName?: string;
};

export type RuntimeUnionFrame = {
  readonly members: readonly IrType[];
  readonly runtimeUnionArity: number;
};

export const UNKNOWN_TYPE: IrType = { kind: "unknownType" };
export const BROAD_OBJECT_TYPE: IrType = {
  kind: "referenceType",
  name: "object",
  resolvedClrType: "System.Object",
};

export const isRuntimeUnionTypeName = (name: string): boolean => {
  const normalized = name.startsWith("global::")
    ? name.slice("global::".length)
    : name;
  const leaf = normalized.split(".").pop() ?? normalized;
  return (
    leaf === "Union" ||
    /^Union_\d+$/.test(leaf) ||
    /^Union`\d+$/.test(leaf) ||
    /^Union\d+$/.test(leaf) ||
    /^Union\d+_[A-F0-9]{8}$/.test(leaf)
  );
};

export const getRuntimeUnionReferenceMembers = (
  type: Extract<IrType, { kind: "referenceType" }>
): readonly IrType[] | undefined => {
  if (
    (isRuntimeUnionTypeName(type.name) ||
      (type.resolvedClrType
        ? isRuntimeUnionTypeName(type.resolvedClrType)
        : false)) &&
    type.typeArguments &&
    type.typeArguments.length >= 2
  ) {
    return type.typeArguments;
  }

  return undefined;
};
