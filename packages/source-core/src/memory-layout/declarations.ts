import type { ProviderExportDeclaration, ProviderParameterDeclaration, ProviderTypeExpression } from "@tsonic/tsts";
import { tsonicCoreTypesModule } from "../identity.js";

export const tsonicMemorySignatureIds = Object.freeze({
  toRawPointer: "toRawPointer<T>(pointer,layout)",
  reinterpretRawPointer: "reinterpretRawPointer<T>(pointer,layout)",
  offsetRawPointer: "offsetRawPointer<TOffset>(pointer,byteOffset,dataLayout)",
  rawPointerToAddressInteger: "rawPointerToAddressInteger(pointer,dataLayout)",
  addressIntegerToRawPointer: "addressIntegerToRawPointer(address,dataLayout)",
  memoryLayout: "memoryLayout<T>(dataLayout,byteSize,byteAlignment,stride,...fields)",
  memoryField: "memoryField<T,TField>(select,byteOffset,byteAlignment)",
  sizeOf: "sizeOf<T>(layout)",
  alignOf: "alignOf<T>(layout)",
  strideOf: "strideOf<T>(layout)",
  fieldOffsetOf: "fieldOffsetOf<T,TField>(layout,select)",
  keepAlive: "keepAlive<T>(value)",
});

export const tsonicMemoryTypeExports = Object.freeze(["DataLayout", "MemoryLayout", "MemoryFieldLayout"] as const);

const pointee: ProviderTypeExpression = { kind: "type-parameter", name: "T" };
const field: ProviderTypeExpression = { kind: "type-parameter", name: "TField" };
const nativeUint: ProviderTypeExpression = { kind: "source-primitive", name: "native-uint" };

function reference(exportName: string, typeArguments: readonly ProviderTypeExpression[] = []): ProviderTypeExpression {
  return { kind: "provider-ref", moduleSpecifier: tsonicCoreTypesModule, exportName, typeArguments };
}

function optional(type: ProviderTypeExpression): ProviderTypeExpression {
  return { kind: "union", types: [type, { kind: "undefined" }] };
}

export function memoryTypeDeclarations(): readonly ProviderExportDeclaration[] {
  return tsonicMemoryTypeExports.map((name) => ({
    id: name, name, kind: "interface",
    ...(name === "DataLayout" ? {} : { typeParameters: [{ name: "T" }] }),
    members: [{
      id: `${name}.brand`, name: `__tsonic${name}`, kind: "property", readonly: true,
      type: name === "DataLayout"
        ? { kind: "literal", value: "DataLayout" }
        : { kind: "function", id: `${name}.brand`, parameters: [{ name: "value", type: pointee }], returnType: pointee },
    }],
  }));
}

export function memoryOperationDeclarations(): readonly ProviderExportDeclaration[] {
  const raw = optional(reference("RawPointer"));
  const pointer = optional(reference("Pointer", [pointee]));
  const layout = reference("MemoryLayout", [pointee]);
  const dataLayout = { name: "dataLayout", type: reference("DataLayout") };
  const generic = [{ name: "T" }];
  const selector = (id: string): ProviderParameterDeclaration => ({
    name: "select", type: { kind: "function", id, parameters: [{ name: "value", type: pointee }], returnType: field },
  });
  const declaration = (
    name: keyof typeof tsonicMemorySignatureIds,
    parameters: readonly ProviderParameterDeclaration[],
    returnType: ProviderTypeExpression,
    typeParameters: NonNullable<NonNullable<ProviderExportDeclaration["signatures"]>[number]["typeParameters"]> = [],
  ): ProviderExportDeclaration => ({
    id: name, name, kind: "function",
    signatures: [{ id: tsonicMemorySignatureIds[name], typeParameters, parameters, returnType }],
  });
  return [
    declaration("toRawPointer", [{ name: "pointer", type: pointer }, { name: "layout", type: layout }], raw, generic),
    declaration("reinterpretRawPointer", [{ name: "pointer", type: raw }, { name: "layout", type: layout }], pointer, generic),
    declaration("offsetRawPointer", [
      { name: "pointer", type: raw }, { name: "byteOffset", type: { kind: "type-parameter", name: "TOffset" } }, dataLayout,
    ], raw, [{ name: "TOffset", constraints: [{ kind: "union", types: [{ kind: "number" }, { kind: "bigint" }] }] }]),
    declaration("rawPointerToAddressInteger", [{ name: "pointer", type: raw }, dataLayout], nativeUint),
    declaration("addressIntegerToRawPointer", [{ name: "address", type: nativeUint }, dataLayout], raw),
    declaration("memoryLayout", [dataLayout,
      ...["byteSize", "byteAlignment", "stride"].map((name) => ({ name, type: nativeUint })),
      { name: "fields", rest: true, type: { kind: "array", elementType: reference("MemoryFieldLayout", [pointee]) } },
    ], layout, generic),
    declaration("memoryField", [selector("memoryField.selector"),
      { name: "byteOffset", type: nativeUint }, { name: "byteAlignment", type: nativeUint },
    ], reference("MemoryFieldLayout", [pointee]), [{ name: "T" }, { name: "TField" }]),
    ...(["sizeOf", "alignOf", "strideOf"] as const).map((name) => declaration(name, [{ name: "layout", type: layout }], nativeUint, generic)),
    declaration("fieldOffsetOf", [{ name: "layout", type: layout }, selector("fieldOffsetOf.selector")], nativeUint, [{ name: "T" }, { name: "TField" }]),
    declaration("keepAlive", [{ name: "value", type: pointee }], { kind: "void" }, generic),
  ];
}
