import type {
  ProviderExportDeclaration,
  ProviderMemberDeclaration,
  ProviderParameterDeclaration,
  ProviderTypeExpression,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
} from "../identity.js";

export interface SourceSafetyProviderNames {
  readonly moduleSpecifier: string;
  readonly unsafeContextExport: string;
  readonly safetyExport: string;
  readonly safetyBuilderExport: string;
  readonly safetyMemberBuilderExport: string;
}

export const sourceSafetySignatureIds = Object.freeze({
  unsafeContextBlock: "unsafeContext()",
  unsafeContextExpression: "unsafeContext<T>(expression)",
  safetyTypeRoot: "safety<T>()",
  safetyValueRoot: "safety(target)",
  requiresUnsafe: "__TsonicSafetyBuilder.requiresUnsafe",
  safe: "__TsonicSafetyBuilder.safe",
  method: "__TsonicSafetyBuilder.method",
  property: "__TsonicSafetyBuilder.property",
  indexer: "__TsonicSafetyBuilder.indexer",
  constructor: "__TsonicSafetyBuilder.constructor",
  memberRequiresUnsafe: "__TsonicSafetyMemberBuilder.requiresUnsafe",
  memberSafe: "__TsonicSafetyMemberBuilder.safe",
  getter: "__TsonicSafetyMemberBuilder.getter",
  setter: "__TsonicSafetyMemberBuilder.setter",
});

export const tsonicCoreSafetyProviderNames: SourceSafetyProviderNames = Object.freeze({
  moduleSpecifier: tsonicCoreLangModule,
  unsafeContextExport: "unsafeContext",
  safetyExport: "safety",
  safetyBuilderExport: "__TsonicSafetyBuilder",
  safetyMemberBuilderExport: "__TsonicSafetyMemberBuilder",
});

export function unsafeContextProviderDeclaration(
  names: SourceSafetyProviderNames,
): ProviderExportDeclaration {
  const value = { kind: "type-parameter" as const, name: "T" };
  return {
    id: names.unsafeContextExport,
    name: names.unsafeContextExport,
    kind: "function",
    signatures: [
      {
        id: sourceSafetySignatureIds.unsafeContextBlock,
        parameters: [],
        returnType: { kind: "void" },
      },
      {
        id: sourceSafetySignatureIds.unsafeContextExpression,
        typeParameters: [{ name: "T" }],
        parameters: [{ name: "expression", type: value }],
        returnType: value,
      },
    ],
  };
}

export function safetyProviderDeclarations(
  names: SourceSafetyProviderNames,
): readonly ProviderExportDeclaration[] {
  return [
    safetyRootDeclaration(names),
    safetyBuilderDeclaration(names),
    safetyMemberBuilderDeclaration(names),
  ];
}

function safetyRootDeclaration(
  names: SourceSafetyProviderNames,
): ProviderExportDeclaration {
  const owner = { kind: "type-parameter" as const, name: "TOwner" };
  const builder = providerReference(
    names.moduleSpecifier,
    names.safetyBuilderExport,
    [owner],
  );
  return {
    id: names.safetyExport,
    name: names.safetyExport,
    kind: "function",
    signatures: [
      {
        id: sourceSafetySignatureIds.safetyValueRoot,
        typeParameters: [{ name: "TOwner" }],
        parameters: [{ name: "target", type: owner }],
        returnType: builder,
      },
      {
        id: sourceSafetySignatureIds.safetyTypeRoot,
        typeParameters: [{ name: "TOwner" }],
        parameters: [],
        returnType: builder,
      },
    ],
  };
}

function safetyBuilderDeclaration(
  names: SourceSafetyProviderNames,
): ProviderExportDeclaration {
  const owner = { kind: "type-parameter" as const, name: "TOwner" };
  const memberBuilder = providerReference(
    names.moduleSpecifier,
    names.safetyMemberBuilderExport,
    [owner],
  );
  return {
    id: names.safetyBuilderExport,
    name: names.safetyBuilderExport,
    kind: "interface",
    typeParameters: [{ name: "TOwner" }],
    members: [
      terminalMember("requiresUnsafe", sourceSafetySignatureIds.requiresUnsafe),
      terminalMember("safe", sourceSafetySignatureIds.safe),
      selectorMember("method", sourceSafetySignatureIds.method, owner, memberBuilder),
      selectorMember("property", sourceSafetySignatureIds.property, owner, memberBuilder),
      selectorMember("indexer", sourceSafetySignatureIds.indexer, owner, memberBuilder),
      callablePropertyMember(
        "constructor",
        sourceSafetySignatureIds.constructor,
        [],
        memberBuilder,
      ),
    ],
  };
}

function safetyMemberBuilderDeclaration(
  names: SourceSafetyProviderNames,
): ProviderExportDeclaration {
  const owner = { kind: "type-parameter" as const, name: "TOwner" };
  const self = providerReference(
    names.moduleSpecifier,
    names.safetyMemberBuilderExport,
    [owner],
  );
  return {
    id: names.safetyMemberBuilderExport,
    name: names.safetyMemberBuilderExport,
    kind: "interface",
    typeParameters: [{ name: "TOwner" }],
    members: [
      terminalMember("requiresUnsafe", sourceSafetySignatureIds.memberRequiresUnsafe),
      terminalMember("safe", sourceSafetySignatureIds.memberSafe),
      methodMember("getter", sourceSafetySignatureIds.getter, [], self),
      methodMember("setter", sourceSafetySignatureIds.setter, [], self),
    ],
  };
}

function selectorMember(
  name: string,
  id: string,
  owner: ProviderTypeExpression,
  result: ProviderTypeExpression,
): ProviderMemberDeclaration {
  return methodMember(name, id, [{
    name: "selector",
    type: {
      kind: "function",
      id: `${id}.selector`,
      parameters: [{ name: "target", type: owner }],
      returnType: { kind: "unknown" },
    },
  }], result);
}

function terminalMember(name: string, id: string) {
  return methodMember(name, id, [], { kind: "void" });
}

function callablePropertyMember(
  name: string,
  id: string,
  parameters: readonly ProviderParameterDeclaration[],
  returnType: ProviderTypeExpression,
) {
  return {
    id,
    name,
    kind: "property" as const,
    readonly: true,
    type: {
      kind: "function" as const,
      id,
      parameters,
      returnType,
    },
  };
}

function methodMember(
  name: string,
  id: string,
  parameters: readonly ProviderParameterDeclaration[],
  returnType: ProviderTypeExpression,
) {
  return {
    id,
    name,
    kind: "method" as const,
    signatures: [{ id, name, parameters, returnType }],
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
