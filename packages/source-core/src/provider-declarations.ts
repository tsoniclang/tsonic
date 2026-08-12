import type {
  ProviderExportDeclaration,
  ProviderParameterDeclaration,
  ProviderTypeExpression,
  SourceCallMarkerKind,
  SourcePrimitiveKind,
  SourceSemanticsModule,
  SourceTypeMarkerKind,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
} from "./identity.js";
import {
  nativePointerOperationProviderDeclarations,
  nativePointerProviderDeclaration,
  safetyProviderDeclarations,
  tsonicCoreNativePointerProviderNames,
  tsonicCoreSafetyProviderNames,
  unsafeContextProviderDeclaration,
} from "./explicit-safety-declarations.js";

export const tsonicAttributeBuilderMemberIds = Object.freeze({
  add: "__TsonicAttributeBuilder.add",
  property: "__TsonicAttributeBuilder.property",
  method: "__TsonicAttributeBuilder.method",
  constructor: "__TsonicAttributeBuilder.constructor",
  memberAdd: "__TsonicAttributeMemberBuilder.add",
  parameter: "__TsonicAttributeMemberBuilder.parameter",
  target: "__TsonicAttributeMemberBuilder.target",
});

export const tsonicAttributeBuilderSignatureIds = Object.freeze({
  root: "attribute<T>(...args)",
  add: tsonicAttributeBuilderMemberIds.add,
  property: tsonicAttributeBuilderMemberIds.property,
  method: tsonicAttributeBuilderMemberIds.method,
  constructor: "__TsonicAttributeBuilder.constructor()",
  memberAdd: tsonicAttributeBuilderMemberIds.memberAdd,
  parameter: tsonicAttributeBuilderMemberIds.parameter,
  target: tsonicAttributeBuilderMemberIds.target,
});

export const tsonicSourceMarkerSignatureIds = Object.freeze({
  field: "field<T>()",
  defaultValue: "defaultValue<T>()",
  addressOf: "addressOf<T>(storage)",
  allocatePointer: "allocatePointer<T>(initial)",
  loadPointer: "loadPointer<T>(pointer)",
  storePointer: "storePointer<T>(pointer,value)",
  equalPointer: "equalPointer<T>(left,right)",
  hashPointer: "hashPointer<T>(pointer)",
  bindPointer: "bindPointer<T>(identity,read,write)",
  projectPointer: "projectPointer<F,T>(pointer,fromSource,toSource)",
  projectOptionalPointer: "projectPointer<F,T>(pointer?,fromSource,toSource)",
  bindRawPointer: "bindRawPointer(identity)",
  equalRawPointer: "equalRawPointer(left,right)",
  hashRawPointer: "hashRawPointer(pointer)",
});

export function providerExportDeclarationsForSourceModule(sourceModule: SourceSemanticsModule): readonly ProviderExportDeclaration[] {
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

function sourceSemanticsHelperDeclarations(moduleSpecifier: string): readonly ProviderExportDeclaration[] {
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
    ? [nativePointerProviderDeclaration(
        tsonicCoreNativePointerProviderNames.nativePointerExport,
      )]
    : [];
}

function providerExportDeclarationForSourceSemantics(declaration: SourceSemanticsModule["exports"][number]): ProviderExportDeclaration {
  switch (declaration.kind) {
    case "source-primitive":
      return providerPrimitiveDeclaration(declaration.exportName, declaration.primitive);
    case "type-marker":
      return providerTypeMarkerDeclaration(declaration.exportName, declaration.marker);
    case "call-marker":
      return providerCallMarkerDeclaration(declaration.exportName, declaration.marker);
  }
}

export function providerTypeMarkerDeclaration(exportName: string, marker: SourceTypeMarkerKind): ProviderExportDeclaration {
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

export function providerCallMarkerDeclaration(exportName: string, marker: SourceCallMarkerKind): ProviderExportDeclaration {
  const typeParameter = { kind: "type-parameter" as const, name: "T" };
  switch (marker) {
    case "write-only-reference":
    case "read-write-reference":
    case "read-only-reference":
    case "shared-borrow":
    case "mutable-borrow":
    case "move":
    case "struct":
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
    case "field":
    case "default-value":
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
    case "address-of":
    case "allocate":
    case "load":
    case "store":
    case "equal-pointer":
    case "hash-pointer":
    case "bind-pointer":
    case "project-pointer":
      return pointerOperationDeclaration(exportName, marker, typeParameter);
    case "bind-raw-pointer":
    case "equal-raw-pointer":
    case "hash-raw-pointer":
      return rawPointerOperationDeclaration(exportName, marker);
    case "attribute":
      return {
        id: exportName,
        name: exportName,
        kind: "function",
        signatures: [{
          id: tsonicAttributeBuilderSignatureIds.root,
          typeParameters: [{ name: "T" }],
          parameters: [],
          returnType: {
            kind: "provider-ref",
            moduleSpecifier: tsonicCoreLangModule,
            exportName: "__TsonicAttributeBuilder",
            typeArguments: [typeParameter],
          },
        }],
      };
  }
}

function rawPointerOperationDeclaration(
  exportName: string,
  marker: Extract<SourceCallMarkerKind, "bind-raw-pointer" | "equal-raw-pointer" | "hash-raw-pointer">,
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
  const signature = (() => {
    switch (marker) {
      case "bind-raw-pointer":
        return {
          id: tsonicSourceMarkerSignatureIds.bindRawPointer,
          parameters: [{ name: "identity", type: { kind: "object" as const } }],
          returnType: rawPointer,
        };
      case "equal-raw-pointer":
        return {
          id: tsonicSourceMarkerSignatureIds.equalRawPointer,
          parameters: [
            { name: "left", type: optionalRawPointer },
            { name: "right", type: optionalRawPointer },
          ],
          returnType: { kind: "boolean" as const },
        };
      case "hash-raw-pointer":
        return {
          id: tsonicSourceMarkerSignatureIds.hashRawPointer,
          parameters: [{ name: "pointer", type: optionalRawPointer }],
          returnType: { kind: "number" as const },
        };
    }
  })();
  return {
    id: exportName,
    name: exportName,
    kind: "function",
    signatures: [signature],
  };
}

function pointerOperationDeclaration(
  exportName: string,
  marker: Extract<SourceCallMarkerKind, "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer">,
  pointee: ProviderTypeExpression,
): ProviderExportDeclaration {
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
  if (marker === "project-pointer") {
    return pointerProjectionDeclaration(exportName, pointee);
  }
  const signature = (() => {
    switch (marker) {
      case "address-of":
        return {
          id: tsonicSourceMarkerSignatureIds.addressOf,
          parameters: [{
            name: "storage",
            type: { kind: "union" as const, types: [pointee, { kind: "undefined" as const }] },
          }],
          returnType: pointer,
        };
      case "allocate":
        return {
          id: tsonicSourceMarkerSignatureIds.allocatePointer,
          parameters: [{ name: "initial", type: pointee }],
          returnType: pointer,
        };
      case "load":
        return {
          id: tsonicSourceMarkerSignatureIds.loadPointer,
          parameters: [{ name: "pointer", type: pointer }],
          returnType: pointee,
        };
      case "store":
        return {
          id: tsonicSourceMarkerSignatureIds.storePointer,
          parameters: [
            { name: "pointer", type: pointer },
            { name: "value", type: pointee },
          ],
          returnType: { kind: "void" as const },
        };
      case "equal-pointer":
        return {
          id: tsonicSourceMarkerSignatureIds.equalPointer,
          parameters: [
            { name: "left", type: optionalPointer },
            { name: "right", type: optionalPointer },
          ],
          returnType: { kind: "boolean" as const },
        };
      case "hash-pointer":
        return {
          id: tsonicSourceMarkerSignatureIds.hashPointer,
          parameters: [{ name: "pointer", type: optionalPointer }],
          returnType: { kind: "number" as const },
        };
      case "bind-pointer":
        return {
          id: tsonicSourceMarkerSignatureIds.bindPointer,
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
  return {
    id: exportName,
    name: exportName,
    kind: "function",
    signatures: [{
      ...signature,
      typeParameters: [{ name: "T" }],
    }],
  };
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
        id: tsonicSourceMarkerSignatureIds.projectPointer,
        typeParameters,
        parameters: parameters(sourcePointer, "defined"),
        returnType: targetPointer,
      },
      {
        id: tsonicSourceMarkerSignatureIds.projectOptionalPointer,
        typeParameters,
        parameters: parameters(
          {
            kind: "union",
            types: [sourcePointer, { kind: "undefined" }],
          },
          "optional",
        ),
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

export function attributeBuilderDeclaration(): ProviderExportDeclaration {
  const ownerType: ProviderTypeExpression = { kind: "type-parameter", name: "TOwner" };
  const memberBuilder: ProviderTypeExpression = {
    kind: "provider-ref",
    moduleSpecifier: tsonicCoreLangModule,
    exportName: "__TsonicAttributeMemberBuilder",
    typeArguments: [ownerType],
  };
  return {
    id: "__TsonicAttributeBuilder",
    name: "__TsonicAttributeBuilder",
    kind: "interface",
    typeParameters: [{ name: "TOwner" }],
    members: [
      methodMember(tsonicAttributeBuilderMemberIds.add, "add", [
        { name: "attribute", type: { kind: "object" } },
        { name: "args", type: { kind: "array", elementType: { kind: "unknown" } }, rest: true },
      ], { kind: "void" }),
      memberSelector(tsonicAttributeBuilderMemberIds.property, "property", ownerType, memberBuilder),
      memberSelector(tsonicAttributeBuilderMemberIds.method, "method", ownerType, memberBuilder),
      callablePropertyMember(
        tsonicAttributeBuilderMemberIds.constructor,
        tsonicAttributeBuilderSignatureIds.constructor,
        "constructor",
        [],
        memberBuilder,
      ),
    ],
  };
}

export function attributeMemberBuilderDeclaration(): ProviderExportDeclaration {
  const ownerType: ProviderTypeExpression = { kind: "type-parameter", name: "TOwner" };
  const self: ProviderTypeExpression = {
    kind: "provider-ref",
    moduleSpecifier: tsonicCoreLangModule,
    exportName: "__TsonicAttributeMemberBuilder",
    typeArguments: [ownerType],
  };
  return {
    id: "__TsonicAttributeMemberBuilder",
    name: "__TsonicAttributeMemberBuilder",
    kind: "interface",
    typeParameters: [{ name: "TOwner" }],
    members: [
      methodMember(tsonicAttributeBuilderMemberIds.memberAdd, "add", [
        { name: "attribute", type: { kind: "object" } },
        { name: "args", type: { kind: "array", elementType: { kind: "unknown" } }, rest: true },
      ], { kind: "void" }),
      methodMember(tsonicAttributeBuilderMemberIds.parameter, "parameter", [
        { name: "name", type: { kind: "string" } },
      ], self),
      methodMember(tsonicAttributeBuilderMemberIds.target, "target", [
        { name: "specifier", type: { kind: "string" } },
      ], self),
    ],
  };
}

function memberSelector(
  id: string,
  name: string,
  ownerType: ProviderTypeExpression,
  returnType: ProviderTypeExpression,
) {
  return methodMember(id, name, [{
    name: "selector",
    type: {
      kind: "function",
      id: `${id}.selector`,
      parameters: [{ name: "target", type: ownerType }],
      returnType: { kind: "unknown" },
    },
  }], returnType);
}

function methodMember(
  id: string,
  name: string,
  parameters: readonly ProviderParameterDeclaration[],
  returnType: ProviderTypeExpression,
) {
  return {
    id,
    name,
    kind: "method" as const,
    signatures: [{
      id,
      name,
      parameters,
      returnType,
    }],
  };
}

function callablePropertyMember(
  id: string,
  signatureId: string,
  name: string,
  parameters: readonly ProviderParameterDeclaration[],
  returnType: ProviderTypeExpression,
) {
  return {
    id,
    name,
    kind: "property" as const,
    type: {
      kind: "function" as const,
      id: signatureId,
      parameters,
      returnType,
    },
  };
}
