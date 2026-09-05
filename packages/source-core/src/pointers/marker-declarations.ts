import type {
  ProviderExportDeclaration,
  ProviderParameterDeclaration,
  ProviderSignatureDeclaration,
  ProviderTypeExpression,
  SourceCallMarkerKind,
  SourceTypeMarkerKind,
} from "@tsonic/tsts";
import {
  tsonicCoreTypesModule,
} from "../identity.js";

export const tsonicPointerMarkerSignatureIds = Object.freeze({
  addressOf: "addressOf<T>(storage)",
  allocatePointer: "allocatePointer<T>(initial)",
  loadPointer: "loadPointer<T>(pointer)",
  storePointer: "storePointer<T>(pointer,value)",
  equalPointer: "equalPointer<T>(left,right)",
  hashPointer: "hashPointer<T>(pointer)",
  bindPointer: "bindPointer<T>(identity,read,write)",
  projectPointer: "projectPointer<F,T>(pointer,fromSource,toSource)",
  projectOptionalPointer: "projectPointer<F,T>(pointer?,fromSource,toSource)",
  equalRawPointer: "equalRawPointer(left,right)",
  hashRawPointer: "hashRawPointer(pointer)",
});

export function pointerTypeMarkerDeclaration(
  exportName: string,
  marker: Exclude<SourceTypeMarkerKind, "fixed-array">,
): ProviderExportDeclaration {
  if (marker === "raw-pointer") {
    const brand = { kind: "literal" as const, value: "RawPointer" };
    return {
      id: exportName,
      name: exportName,
      kind: "interface",
      members: [sourceTypeBrandMember(exportName, brand, brand)],
    };
  }
  if (marker === "pointer") {
    const pointee = { kind: "type-parameter" as const, name: "T" };
    return {
      id: exportName,
      name: exportName,
      kind: "interface",
      typeParameters: [{ name: "T" }],
      members: [sourceTypeBrandMember(exportName, pointee, pointee)],
    };
  }
  const argumentsType = { kind: "type-parameter" as const, name: "TArgs" };
  const resultType = { kind: "type-parameter" as const, name: "TReturn" };
  return {
    id: exportName,
    name: exportName,
    kind: "interface",
    typeParameters: [{ name: "TArgs" }, { name: "TReturn" }],
    members: [sourceTypeBrandMember(exportName, argumentsType, resultType)],
  };
}

export function pointerCallMarkerDeclaration(
  exportName: string,
  marker: Extract<
    SourceCallMarkerKind,
    | "address-of"
    | "allocate"
    | "load"
    | "store"
    | "equal-pointer"
    | "hash-pointer"
    | "bind-pointer"
    | "project-pointer"
    | "equal-raw-pointer"
    | "hash-raw-pointer"
  >,
  pointee: ProviderTypeExpression,
): ProviderExportDeclaration {
  switch (marker) {
    case "equal-raw-pointer":
    case "hash-raw-pointer":
      return rawPointerOperationDeclaration(exportName, marker);
    default:
      return pointerOperationDeclaration(exportName, marker, pointee);
  }
}

function rawPointerOperationDeclaration(
  exportName: string,
  marker: Extract<SourceCallMarkerKind, "equal-raw-pointer" | "hash-raw-pointer">,
): ProviderExportDeclaration {
  const rawPointer: ProviderTypeExpression = {
    kind: "provider-ref",
    moduleSpecifier: tsonicCoreTypesModule,
    exportName: "RawPointer",
  };
  const optionalRawPointer: ProviderTypeExpression = {
    kind: "union",
    types: [rawPointer, { kind: "undefined" }],
  };
  switch (marker) {
    case "equal-raw-pointer":
      return functionDeclaration(exportName, {
        id: tsonicPointerMarkerSignatureIds.equalRawPointer,
        parameters: [
          { name: "left", type: optionalRawPointer },
          { name: "right", type: optionalRawPointer },
        ],
        returnType: { kind: "boolean" },
      });
    case "hash-raw-pointer":
      return functionDeclaration(exportName, {
        id: tsonicPointerMarkerSignatureIds.hashRawPointer,
        parameters: [{ name: "pointer", type: optionalRawPointer }],
        returnType: { kind: "number" },
      });
  }
}

function pointerOperationDeclaration(
  exportName: string,
  marker: Extract<SourceCallMarkerKind, "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer">,
  pointee: ProviderTypeExpression,
): ProviderExportDeclaration {
  if (marker === "project-pointer") {
    return pointerProjectionDeclaration(exportName, pointee);
  }
  const pointer: ProviderTypeExpression = {
    kind: "provider-ref",
    moduleSpecifier: tsonicCoreTypesModule,
    exportName: "Pointer",
    typeArguments: [pointee],
  };
  const optionalPointer: ProviderTypeExpression = {
    kind: "union",
    types: [pointer, { kind: "undefined" }],
  };
  const signature = (() => {
    switch (marker) {
      case "address-of":
        return {
          id: tsonicPointerMarkerSignatureIds.addressOf,
          parameters: [{
            name: "storage",
            type: { kind: "union" as const, types: [pointee, { kind: "undefined" as const }] },
          }],
          returnType: pointer,
        };
      case "allocate":
        return {
          id: tsonicPointerMarkerSignatureIds.allocatePointer,
          parameters: [{ name: "initial", type: pointee }],
          returnType: pointer,
        };
      case "load":
        return {
          id: tsonicPointerMarkerSignatureIds.loadPointer,
          parameters: [{ name: "pointer", type: pointer }],
          returnType: pointee,
        };
      case "store":
        return {
          id: tsonicPointerMarkerSignatureIds.storePointer,
          parameters: [
            { name: "pointer", type: pointer },
            { name: "value", type: pointee },
          ],
          returnType: { kind: "void" as const },
        };
      case "equal-pointer":
        return {
          id: tsonicPointerMarkerSignatureIds.equalPointer,
          parameters: [
            { name: "left", type: optionalPointer },
            { name: "right", type: optionalPointer },
          ],
          returnType: { kind: "boolean" as const },
        };
      case "hash-pointer":
        return {
          id: tsonicPointerMarkerSignatureIds.hashPointer,
          parameters: [{ name: "pointer", type: optionalPointer }],
          returnType: { kind: "number" as const },
        };
      case "bind-pointer":
        return {
          id: tsonicPointerMarkerSignatureIds.bindPointer,
          parameters: [
            { name: "identity", type: { kind: "object" as const } },
            {
              name: "read",
              type: {
                kind: "function" as const,
                id: `${exportName}.read`,
                parameters: [],
                returnType: pointee,
              },
            },
            {
              name: "write",
              type: {
                kind: "function" as const,
                id: `${exportName}.write`,
                parameters: [{ name: "value", type: pointee }],
                returnType: { kind: "void" as const },
              },
            },
          ],
          returnType: pointer,
        };
    }
  })();
  return functionDeclaration(exportName, {
    ...signature,
    typeParameters: [{ name: "T" }],
  });
}

function pointerProjectionDeclaration(
  exportName: string,
  targetPointee: ProviderTypeExpression,
): ProviderExportDeclaration {
  const sourcePointee = { kind: "type-parameter" as const, name: "F" };
  const sourcePointer: ProviderTypeExpression = {
    kind: "provider-ref",
    moduleSpecifier: tsonicCoreTypesModule,
    exportName: "Pointer",
    typeArguments: [sourcePointee],
  };
  const targetPointer: ProviderTypeExpression = {
    kind: "provider-ref",
    moduleSpecifier: tsonicCoreTypesModule,
    exportName: "Pointer",
    typeArguments: [targetPointee],
  };
  const parameters = (
    pointer: ProviderTypeExpression,
    identity: string,
  ): readonly ProviderParameterDeclaration[] => [
    { name: "pointer", type: pointer },
    {
      name: "fromSource",
      type: {
        kind: "function",
        id: `${exportName}.${identity}.fromSource`,
        parameters: [{ name: "value", type: sourcePointee }],
        returnType: targetPointee,
      },
    },
    {
      name: "toSource",
      type: {
        kind: "function",
        id: `${exportName}.${identity}.toSource`,
        parameters: [{ name: "value", type: targetPointee }],
        returnType: sourcePointee,
      },
    },
  ];
  const typeParameters = [{ name: "F" }, { name: "T" }];
  return {
    id: exportName,
    name: exportName,
    kind: "function",
    signatures: [
      {
        id: tsonicPointerMarkerSignatureIds.projectPointer,
        typeParameters,
        parameters: parameters(sourcePointer, "defined"),
        returnType: targetPointer,
      },
      {
        id: tsonicPointerMarkerSignatureIds.projectOptionalPointer,
        typeParameters,
        parameters: parameters({
          kind: "union",
          types: [sourcePointer, { kind: "undefined" }],
        }, "optional"),
        returnType: {
          kind: "union",
          types: [targetPointer, { kind: "undefined" }],
        },
      },
    ],
  };
}

function sourceTypeBrandMember(
  owner: string,
  parameterType: ProviderTypeExpression,
  returnType: ProviderTypeExpression,
) {
  const id = `${owner}.__tsonicSourceType`;
  return {
    id,
    name: "__tsonicSourceType",
    kind: "property" as const,
    readonly: true,
    type: {
      kind: "function" as const,
      id,
      parameters: [{ name: "value", type: parameterType }],
      returnType,
    },
  };
}

function functionDeclaration(
  exportName: string,
  signature: ProviderSignatureDeclaration,
): ProviderExportDeclaration {
  return {
    id: exportName,
    name: exportName,
    kind: "function",
    signatures: [signature],
  };
}
