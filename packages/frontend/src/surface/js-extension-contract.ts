import type { IrType } from "../ir/types.js";

export const JS_SURFACE_EXTENSION_NAMESPACE_KEY = "Tsonic_JSRuntime" as const;

const JS_SURFACE_PRIMITIVE_RECEIVER_CANDIDATES: Readonly<
  Record<string, readonly string[]>
> = {
  string: ["String", "string"],
  number: ["Double", "double", "number"],
  int: ["Int32", "int"],
  boolean: ["Boolean", "bool", "boolean"],
};

const getReferenceTypeCandidates = (
  receiverType: Extract<IrType, { kind: "referenceType" }>
): readonly string[] => {
  const candidates = new Set<string>([receiverType.name]);
  const clrName = receiverType.resolvedClrType ?? receiverType.typeId?.clrName;
  if (clrName) {
    const simple = clrName.includes(".")
      ? clrName.slice(clrName.lastIndexOf(".") + 1)
      : clrName;
    candidates.add(simple);
  }
  return Array.from(candidates);
};

export const getJsSurfaceReceiverCandidates = (
  receiverType: IrType
): readonly string[] => {
  if (receiverType.kind === "primitiveType") {
    return (
      JS_SURFACE_PRIMITIVE_RECEIVER_CANDIDATES[receiverType.name] ?? [
        receiverType.name,
      ]
    );
  }

  if (receiverType.kind === "referenceType") {
    return getReferenceTypeCandidates(receiverType);
  }

  if (receiverType.kind === "arrayType") {
    return ["Array", "JSArray_1", "List_1"];
  }

  return [];
};
