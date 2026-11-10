import type { ProviderExportDeclaration, ProviderTypeExpression } from "@tsonic/tsts";
import { tsonicCoreLangModule, tsonicCoreTypesModule } from "../identity.js";

export const memoryDescriptorKeys = Object.freeze({
  memorylayout: ["datalayout", "bytesize", "bytealignment", "stride", "fields"],
  memoryarraylayout: ["datalayout", "bytesize", "bytealignment", "stride", "elementlayout", "length"],
  memoryfield: ["select", "byteoffset", "bytealignment", "fieldlayout"],
} as const);

const descriptorNames = Object.freeze({
  memorylayout: "__TsonicMemoryLayoutDescriptor",
  memoryarraylayout: "__TsonicMemoryArrayLayoutDescriptor",
  memoryfield: "__TsonicMemoryFieldDescriptor",
});

export function memoryDescriptorReference(
  operation: keyof typeof descriptorNames,
  typeArguments: readonly ProviderTypeExpression[],
): ProviderTypeExpression {
  return { kind: "provider-ref", moduleSpecifier: tsonicCoreLangModule,
    exportName: descriptorNames[operation], typeArguments };
}

export function memoryDescriptorDeclarations(): readonly ProviderExportDeclaration[] {
  const owner: ProviderTypeExpression = { kind: "type-parameter", name: "T" };
  const field: ProviderTypeExpression = { kind: "type-parameter", name: "TField" };
  const length: ProviderTypeExpression = { kind: "type-parameter", name: "TLength" };
  const nativeUint: ProviderTypeExpression = { kind: "source-primitive", name: "native-uint" };
  const reference = (exportName: string, typeArguments: readonly ProviderTypeExpression[] = []): ProviderTypeExpression =>
    ({ kind: "provider-ref", moduleSpecifier: tsonicCoreTypesModule, exportName, typeArguments });
  const dimensions = {
    datalayout: reference("DataLayout"), bytesize: nativeUint, bytealignment: nativeUint, stride: nativeUint,
  };
  const types = {
    memorylayout: { ...dimensions, fields: { kind: "array", elementType: reference("MemoryFieldLayout", [owner]) } },
    memoryarraylayout: { ...dimensions, elementlayout: reference("MemoryLayout", [owner]), length },
    memoryfield: {
      select: { kind: "function", id: "memoryfield.selector", parameters: [{ name: "value", type: owner }], returnType: field },
      byteoffset: nativeUint, bytealignment: nativeUint, fieldlayout: reference("MemoryLayout", [field]),
    },
  } satisfies Record<keyof typeof descriptorNames, Readonly<Record<string, ProviderTypeExpression>>>;
  return (Object.keys(descriptorNames) as (keyof typeof descriptorNames)[]).map((operation): ProviderExportDeclaration => {
    const name = descriptorNames[operation];
    return {
      id: name, name, kind: "interface",
      typeParameters: [{ name: "T" }, ...(operation === "memoryfield" ? [{ name: "TField" }]
        : operation === "memoryarraylayout" ? [{ name: "TLength", constraints: [{ kind: "union" as const,
          types: [{ kind: "number" as const }, { kind: "bigint" as const }] }] }] : [])],
      members: memoryDescriptorKeys[operation].map((key) => ({
        id: `${name}.${key}`, name: key, kind: "property", readonly: true,
        type: (types[operation] as Readonly<Record<string, ProviderTypeExpression>>)[key]!,
      })),
    };
  });
}
