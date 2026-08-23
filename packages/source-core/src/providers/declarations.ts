import type {
  ProviderExportDeclaration,
  ProviderTypeExpression,
  SourceCallMarkerKind,
  SourcePrimitiveKind,
  SourceSemanticsModule,
  SourceTypeMarkerKind,
} from "@tsonic/tsts";
import {
  attributeBuilderDeclaration,
  attributeCallMarkerDeclaration,
  attributeMemberBuilderDeclaration,
  tsonicAttributeBuilderMemberIds,
  tsonicAttributeBuilderSignatureIds,
} from "../attributes/provider-declarations.js";
import {
  fixedArrayTypeMarkerDeclaration,
} from "../fixed-arrays/provider-declarations.js";
import {
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
} from "../identity.js";
import {
  pointerCallMarkerDeclaration,
  pointerTypeMarkerDeclaration,
  tsonicPointerMarkerSignatureIds,
} from "../pointers/marker-declarations.js";
import {
  nativePointerOperationProviderDeclarations,
  nativePointerProviderDeclaration,
  tsonicCoreNativePointerProviderNames,
} from "../pointers/provider-declarations.js";
import {
  safetyProviderDeclarations,
  tsonicCoreSafetyProviderNames,
  unsafeContextProviderDeclaration,
} from "../safety/declarations.js";

export {
  attributeBuilderDeclaration,
  attributeMemberBuilderDeclaration,
  tsonicAttributeBuilderMemberIds,
  tsonicAttributeBuilderSignatureIds,
};

export const tsonicSourceMarkerSignatureIds = Object.freeze({
  field: "field<T>()",
  defaultValue: "defaultValue<T>()",
  ...tsonicPointerMarkerSignatureIds,
});

export function providerExportDeclarationsForSourceModule(
  sourceModule: SourceSemanticsModule,
): readonly ProviderExportDeclaration[] {
  return [
    ...sourceSemanticsHelperDeclarations(sourceModule.moduleSpecifier),
    ...providerExportDeclarationsForSemanticsModule(sourceModule),
  ];
}

export function providerExportDeclarationsForSemanticsModule(
  sourceModule: SourceSemanticsModule,
): readonly ProviderExportDeclaration[] {
  return sourceModule.exports.map(providerExportDeclarationForSourceSemantics);
}

function sourceSemanticsHelperDeclarations(
  moduleSpecifier: string,
): readonly ProviderExportDeclaration[] {
  if (moduleSpecifier === tsonicCoreLangModule) {
    return [
      attributeBuilderDeclaration(),
      attributeMemberBuilderDeclaration(),
      ...nativePointerOperationProviderDeclarations(
        tsonicCoreNativePointerProviderNames,
      ),
      unsafeContextProviderDeclaration(tsonicCoreSafetyProviderNames),
      ...safetyProviderDeclarations(tsonicCoreSafetyProviderNames),
    ];
  }
  return moduleSpecifier === tsonicCoreTypesModule
    ? [
        nativePointerProviderDeclaration(
          tsonicCoreNativePointerProviderNames.nativePointerExport,
        ),
      ]
    : [];
}

function providerExportDeclarationForSourceSemantics(
  declaration: SourceSemanticsModule["exports"][number],
): ProviderExportDeclaration {
  switch (declaration.kind) {
    case "source-primitive":
      return providerPrimitiveDeclaration(
        declaration.exportName,
        declaration.primitive,
      );
    case "type-marker":
      return providerTypeMarkerDeclaration(
        declaration.exportName,
        declaration.marker,
      );
    case "call-marker":
      return providerCallMarkerDeclaration(
        declaration.exportName,
        declaration.marker,
      );
  }
}

export function providerTypeMarkerDeclaration(
  exportName: string,
  marker: SourceTypeMarkerKind,
): ProviderExportDeclaration {
  switch (marker) {
    case "fixed-array":
      return fixedArrayTypeMarkerDeclaration(exportName);
    case "pointer":
    case "function-pointer":
    case "raw-pointer":
      return pointerTypeMarkerDeclaration(exportName, marker);
    case "js-string":
      return unsupportedProviderMarkerDeclaration(marker);
  }
}

export function providerCallMarkerDeclaration(
  exportName: string,
  marker: SourceCallMarkerKind,
): ProviderExportDeclaration {
  const typeParameter = { kind: "type-parameter" as const, name: "T" };
  switch (marker) {
    case "write-only-reference":
    case "read-write-reference":
    case "read-only-reference":
    case "shared-borrow":
    case "mutable-borrow":
    case "move":
    case "struct":
      return sourceValueMarkerDeclaration(exportName, typeParameter);
    case "field":
    case "default-value":
      return sourceTypeValueMarkerDeclaration(
        exportName,
        marker,
        typeParameter,
      );
    case "address-of":
    case "allocate":
    case "load":
    case "store":
    case "equal-pointer":
    case "hash-pointer":
    case "bind-pointer":
    case "project-pointer":
    case "bind-raw-pointer":
    case "equal-raw-pointer":
    case "hash-raw-pointer":
      return pointerCallMarkerDeclaration(exportName, marker, typeParameter);
    case "attribute":
      return attributeCallMarkerDeclaration(exportName, typeParameter);
    case "js-string":
      return unsupportedProviderMarkerDeclaration(marker);
  }
}

function unsupportedProviderMarkerDeclaration(
  marker: SourceCallMarkerKind | SourceTypeMarkerKind,
): never {
  throw new Error(
    `Source marker '${marker}' requires its owning source-profile package to provide an exact declaration model.`,
  );
}

function sourceValueMarkerDeclaration(
  exportName: string,
  typeParameter: ProviderTypeExpression,
): ProviderExportDeclaration {
  return {
    id: exportName,
    name: exportName,
    kind: "function",
    signatures: [{
      id: `${exportName}(value)`,
      typeParameters: [{ name: "T" }],
      parameters: [{ name: "value", type: typeParameter }],
      returnType: typeParameter,
    }],
  };
}

function sourceTypeValueMarkerDeclaration(
  exportName: string,
  marker: "field" | "default-value",
  typeParameter: ProviderTypeExpression,
): ProviderExportDeclaration {
  return {
    id: exportName,
    name: exportName,
    kind: "function",
    signatures: [{
      id: marker === "field"
        ? tsonicSourceMarkerSignatureIds.field
        : tsonicSourceMarkerSignatureIds.defaultValue,
      typeParameters: [{ name: "T" }],
      parameters: [],
      returnType: typeParameter,
    }],
  };
}

export function providerPrimitiveDeclaration(
  exportName: string,
  primitive: SourcePrimitiveKind,
): ProviderExportDeclaration {
  return {
    id: exportName,
    name: exportName,
    kind: "type",
    type: { kind: "source-primitive", name: primitive },
  };
}
