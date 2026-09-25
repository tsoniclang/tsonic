import type {
  ProviderExportDeclaration,
  ProviderParameterDeclaration,
  ProviderTypeExpression,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
} from "../identity.js";

export const tsonicAttributeBuilderMemberIds = Object.freeze({
  module: "attribute.module",
  moduleAdd: "__TsonicModuleAttributeBuilder.add",
  add: "__TsonicAttributeBuilder.add",
  property: "__TsonicAttributeBuilder.property",
  method: "__TsonicAttributeBuilder.method",
  constructor: "__TsonicAttributeBuilder.constructor",
  memberAdd: "__TsonicAttributeMemberBuilder.add",
  parameter: "__TsonicAttributeMemberBuilder.parameter",
  target: "__TsonicAttributeMemberBuilder.target",
});

export const tsonicAttributeBuilderSignatureIds = Object.freeze({
  root: "attribute<T>()",
  module: "attribute.module()",
  moduleAdd: tsonicAttributeBuilderMemberIds.moduleAdd,
  add: tsonicAttributeBuilderMemberIds.add,
  property: tsonicAttributeBuilderMemberIds.property,
  method: tsonicAttributeBuilderMemberIds.method,
  constructor: "__TsonicAttributeBuilder.constructor()",
  memberAdd: tsonicAttributeBuilderMemberIds.memberAdd,
  parameter: tsonicAttributeBuilderMemberIds.parameter,
  target: tsonicAttributeBuilderMemberIds.target,
});

export function attributeCallMarkerDeclaration(
  exportName: string,
  typeParameter: ProviderTypeExpression,
): ProviderExportDeclaration {
  return {
    id: exportName,
    name: exportName,
    kind: "function",
    members: [{
      id: tsonicAttributeBuilderMemberIds.module,
      name: "module",
      kind: "method",
      signatures: [{
        id: tsonicAttributeBuilderSignatureIds.module,
        parameters: [],
        returnType: { kind: "provider-ref", moduleSpecifier: tsonicCoreLangModule, exportName: "__TsonicModuleAttributeBuilder" },
      }],
    }],
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

export function moduleAttributeBuilderDeclaration(): ProviderExportDeclaration {
  return {
    id: "__TsonicModuleAttributeBuilder",
    name: "__TsonicModuleAttributeBuilder",
    kind: "interface",
    members: [attributeApplicationMember(tsonicAttributeBuilderMemberIds.moduleAdd)],
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
      attributeApplicationMember(tsonicAttributeBuilderMemberIds.add),
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
      attributeApplicationMember(tsonicAttributeBuilderMemberIds.memberAdd),
      methodMember(tsonicAttributeBuilderMemberIds.parameter, "parameter", [
        { name: "name", type: { kind: "string" } },
      ], self),
      methodMember(tsonicAttributeBuilderMemberIds.target, "target", [
        { name: "specifier", type: { kind: "string" } },
      ], self),
    ],
  };
}

function attributeApplicationMember(id: string) {
  return methodMember(id, "add", [{
    name: "invocation",
    type: {
      kind: "function",
      id: `${id}.invocation`,
      parameters: [],
      returnType: { kind: "unknown" },
    },
  }], { kind: "void" });
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
