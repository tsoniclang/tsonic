import type {
  ProviderExportDeclaration,
  ProviderParameterDeclaration,
  ProviderTypeExpression,
} from "@tsonic/tsts";
import {
  tsonicCoreTypesModule,
} from "../identity.js";

export interface SourceNativePointerProviderNames {
  readonly typesModuleSpecifier: string;
  readonly nativePointerExport: string;
  readonly loadExport: string;
  readonly storeExport: string;
  readonly offsetExport: string;
  readonly offsetBytesExport: string;
}

export const sourceNativePointerSignatureIds = Object.freeze({
  load: "loadNativePointer<T>(pointer)",
  store: "storeNativePointer<T>(pointer,value)",
  offset: "offsetNativePointer<T>(pointer,elementOffset)",
  offsetBytes: "offsetNativePointerBytes<T>(pointer,byteOffset)",
});

export const tsonicCoreNativePointerProviderNames: SourceNativePointerProviderNames = Object.freeze({
  typesModuleSpecifier: tsonicCoreTypesModule,
  nativePointerExport: "NativePointer",
  loadExport: "loadNativePointer",
  storeExport: "storeNativePointer",
  offsetExport: "offsetNativePointer",
  offsetBytesExport: "offsetNativePointerBytes",
});

export function nativePointerProviderDeclaration(
  exportName: string,
): ProviderExportDeclaration {
  const pointee = { kind: "type-parameter" as const, name: "T" };
  const brandId = `${exportName}.__tsonicNativePointer`;
  return {
    id: exportName,
    name: exportName,
    kind: "interface",
    typeParameters: [{ name: "T" }],
    members: [{
      id: brandId,
      name: "__tsonicNativePointer",
      kind: "property",
      readonly: true,
      type: {
        kind: "function",
        id: brandId,
        parameters: [{ name: "value", type: pointee }],
        returnType: pointee,
      },
    }],
  };
}

export function nativePointerOperationProviderDeclarations(
  names: SourceNativePointerProviderNames,
): readonly ProviderExportDeclaration[] {
  const pointee = { kind: "type-parameter" as const, name: "T" };
  const pointer = providerReference(
    names.typesModuleSpecifier,
    names.nativePointerExport,
    [pointee],
  );
  return [
    nativePointerOperationDeclaration(
      names.loadExport,
      sourceNativePointerSignatureIds.load,
      [{ name: "pointer", type: pointer }],
      pointee,
    ),
    nativePointerOperationDeclaration(
      names.storeExport,
      sourceNativePointerSignatureIds.store,
      [
        { name: "pointer", type: pointer },
        { name: "value", type: pointee },
      ],
      { kind: "void" },
    ),
    nativePointerOperationDeclaration(
      names.offsetExport,
      sourceNativePointerSignatureIds.offset,
      [
        { name: "pointer", type: pointer },
        {
          name: "elementOffset",
          type: { kind: "source-primitive", name: "native-int" },
        },
      ],
      pointer,
    ),
    nativePointerOperationDeclaration(
      names.offsetBytesExport,
      sourceNativePointerSignatureIds.offsetBytes,
      [
        { name: "pointer", type: pointer },
        {
          name: "byteOffset",
          type: { kind: "source-primitive", name: "native-int" },
        },
      ],
      pointer,
    ),
  ];
}

function nativePointerOperationDeclaration(
  exportName: string,
  signatureId: string,
  parameters: readonly ProviderParameterDeclaration[],
  returnType: ProviderTypeExpression,
): ProviderExportDeclaration {
  return {
    id: exportName,
    name: exportName,
    kind: "function",
    signatures: [{
      id: signatureId,
      typeParameters: [{ name: "T" }],
      parameters,
      returnType,
    }],
  };
}

function providerReference(
  moduleSpecifier: string,
  exportName: string,
  typeArguments: readonly ProviderTypeExpression[],
): ProviderTypeExpression {
  return {
    kind: "provider-ref",
    moduleSpecifier,
    exportName,
    typeArguments,
  };
}
