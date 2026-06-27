import type {
  ProviderExportDeclaration,
  ProviderParameterDeclaration,
  ProviderTypeExpression,
  SourceCallMarkerDeclaration,
  SourcePrimitiveKind,
  SourceSemanticsModule,
  SourceTypeMarkerDeclaration,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
} from "./identity.js";

export function providerExportDeclarationsForSourceModule(sourceModule: SourceSemanticsModule): readonly ProviderExportDeclaration[] {
  return [
    ...sourceSemanticsHelperDeclarations(sourceModule.moduleSpecifier),
    ...sourceModule.exports.map(providerExportDeclarationForSourceSemantics),
  ];
}

function sourceSemanticsHelperDeclarations(moduleSpecifier: string): readonly ProviderExportDeclaration[] {
  return moduleSpecifier === tsonicCoreLangModule
    ? [
        attributeBuilderDeclaration(),
        attributeMemberBuilderDeclaration(),
      ]
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

export function providerTypeMarkerDeclaration(exportName: string, marker: SourceTypeMarkerDeclaration["marker"]): ProviderExportDeclaration {
  const typeParameters = marker === "ptr"
    ? [{ name: "T" }]
    : [{ name: "TArgs" }, { name: "TReturn" }];
  return {
    id: exportName,
    name: exportName,
    kind: "type",
    typeParameters,
    type: { kind: "unknown" },
  };
}

export function providerCallMarkerDeclaration(exportName: string, marker: SourceCallMarkerDeclaration["marker"]): ProviderExportDeclaration {
  const typeParameter = { kind: "type-parameter" as const, name: "T" };
  switch (marker) {
    case "out":
    case "ref":
    case "inref":
    case "borrow":
    case "borrowMut":
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
    case "defaultof":
      return {
        id: exportName,
        name: exportName,
        kind: "function",
        signatures: [{
          id: `${exportName}<T>()`,
          typeParameters: [{ name: "T" }],
          parameters: [],
          returnType: typeParameter,
        }],
      };
    case "attribute":
      return {
        id: exportName,
        name: exportName,
        kind: "function",
        signatures: [{
          id: `${exportName}<T>(...args)`,
          typeParameters: [{ name: "T" }],
          parameters: [],
          returnType: {
            kind: "provider-ref",
            name: "__TsonicAttributeBuilder",
            typeArguments: [typeParameter],
          },
        }],
      };
  }
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
    name: "__TsonicAttributeMemberBuilder",
    typeArguments: [ownerType],
  };
  return {
    id: "__TsonicAttributeBuilder",
    name: "__TsonicAttributeBuilder",
    kind: "interface",
    typeParameters: [{ name: "TOwner" }],
    members: [
      methodMember("__TsonicAttributeBuilder.add", "add", [
        { name: "attribute", type: { kind: "object" } },
        { name: "args", type: { kind: "array", elementType: { kind: "unknown" } }, rest: true },
      ], { kind: "void" }),
      memberSelector("__TsonicAttributeBuilder.property", "property", ownerType, memberBuilder),
      memberSelector("__TsonicAttributeBuilder.method", "method", ownerType, memberBuilder),
      methodMember("__TsonicAttributeBuilder.constructor", "constructor", [], memberBuilder),
    ],
  };
}

export function attributeMemberBuilderDeclaration(): ProviderExportDeclaration {
  const ownerType: ProviderTypeExpression = { kind: "type-parameter", name: "TOwner" };
  const self: ProviderTypeExpression = {
    kind: "provider-ref",
    name: "__TsonicAttributeMemberBuilder",
    typeArguments: [ownerType],
  };
  return {
    id: "__TsonicAttributeMemberBuilder",
    name: "__TsonicAttributeMemberBuilder",
    kind: "interface",
    typeParameters: [{ name: "TOwner" }],
    members: [
      methodMember("__TsonicAttributeMemberBuilder.add", "add", [
        { name: "attribute", type: { kind: "object" } },
        { name: "args", type: { kind: "array", elementType: { kind: "unknown" } }, rest: true },
      ], { kind: "void" }),
      methodMember("__TsonicAttributeMemberBuilder.parameter", "parameter", [
        { name: "name", type: { kind: "string" } },
      ], self),
      methodMember("__TsonicAttributeMemberBuilder.target", "target", [
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
