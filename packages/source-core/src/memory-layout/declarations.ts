import type { ProviderExportDeclaration, ProviderParameterDeclaration, ProviderTypeExpression } from "@tsonic/tsts";
import { tsonicCoreTypesModule } from "../identity.js";
import { memoryDescriptorDeclarations, memoryDescriptorReference } from "./descriptor-declarations.js";

export const tsonicMemorySignatureIds = Object.freeze({
  torawptr: "torawptr<T>(pointer,layout)",
  reinterpretrawptr: "reinterpretrawptr<T>(pointer,layout)",
  offsetrawptr: "offsetrawptr<TOffset>(pointer,byteOffset,dataLayout)",
  rawptrtoaddressinteger: "rawptrtoaddressinteger<TAddress>(pointer,dataLayout)",
  addressintegertorawptr: "addressintegertorawptr<TAddress>(address,dataLayout)",
  memorylayout: "memorylayout<T>(descriptor)",
  memoryarraylayout: "memoryarraylayout<T,TLength>(descriptor)",
  memoryfield: "memoryfield<T,TField>(descriptor)",
  bindmemoryfield: "bindmemoryfield<T,TField>(field,pointer)",
  bindmemoryrecord: "bindmemoryrecord<T>(layout,...fields)",
  sizeof: "sizeof<T>(layout)",
  alignof: "alignof<T>(layout)",
  strideof: "strideof<T>(layout)",
  fieldoffsetof: "fieldoffsetof<T,TField>(layout,select)",
  keepalive: "keepalive<T>(value)",
});

export const tsonicMemoryTypeExports = Object.freeze(["DataLayout", "MemoryLayout", "MemoryFieldLayout", "MemoryFieldBinding"] as const);

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
  const address: ProviderTypeExpression = { kind: "type-parameter", name: "TAddress" };
  const addressParameters = [{ name: "TAddress", constraints: [{ kind: "union" as const,
    types: [{ kind: "number" as const }, { kind: "bigint" as const }] }] }];
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
    ...memoryDescriptorDeclarations(),
    declaration("torawptr", [{ name: "pointer", type: pointer }, { name: "layout", type: layout }], raw, generic),
    declaration("reinterpretrawptr", [{ name: "pointer", type: raw }, { name: "layout", type: layout }], pointer, generic),
    declaration("offsetrawptr", [
      { name: "pointer", type: raw }, { name: "byteOffset", type: { kind: "type-parameter", name: "TOffset" } }, dataLayout,
    ], raw, [{ name: "TOffset", constraints: [{ kind: "union", types: [{ kind: "number" }, { kind: "bigint" }] }] }]),
    declaration("rawptrtoaddressinteger", [{ name: "pointer", type: raw }, dataLayout], address, addressParameters),
    declaration("addressintegertorawptr", [{ name: "address", type: address }, dataLayout], raw, addressParameters),
    declaration("memorylayout", [{ name: "descriptor", type: memoryDescriptorReference("memorylayout", [pointee]) }], layout, generic),
    declaration("memoryarraylayout", [{ name: "descriptor",
      type: memoryDescriptorReference("memoryarraylayout", [pointee, { kind: "type-parameter", name: "TLength" }]),
    }], reference("MemoryLayout", [reference("FixedArray", [pointee, { kind: "type-parameter", name: "TLength" }])]),
    [{ name: "T" }, { name: "TLength", constraints: [{ kind: "union", types: [{ kind: "number" }, { kind: "bigint" }] }] }]),
    declaration("memoryfield", [{ name: "descriptor", type: memoryDescriptorReference("memoryfield", [pointee, field]) }],
      reference("MemoryFieldLayout", [pointee]), [{ name: "T" }, { name: "TField" }]),
    declaration("bindmemoryfield", [
      { name: "field", type: reference("MemoryFieldLayout", [pointee]) },
      { name: "pointer", type: reference("Pointer", [field]) },
    ], reference("MemoryFieldBinding", [pointee]), [{ name: "T" }, { name: "TField" }]),
    declaration("bindmemoryrecord", [
      { name: "layout", type: layout },
      { name: "fields", rest: true, type: { kind: "array", elementType: reference("MemoryFieldBinding", [pointee]) } },
    ], pointee, generic),
    ...(["sizeof", "alignof", "strideof"] as const).map((name) => declaration(name, [{ name: "layout", type: layout }], nativeUint, generic)),
    declaration("fieldoffsetof", [{ name: "layout", type: layout }, selector("fieldoffsetof.selector")], nativeUint, [{ name: "T" }, { name: "TField" }]),
    declaration("keepalive", [{ name: "value", type: pointee }], { kind: "void" }, generic),
  ];
}
