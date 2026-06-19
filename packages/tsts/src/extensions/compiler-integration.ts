import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import { Node_Symbol, SourceFile_FileName } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import {
  canonicalIdentityFactKey,
  providerVirtualDeclarationFactKey,
  targetBindingFactKey,
} from "./facts.js";
import type {
  ArgumentPassingMode,
  ProviderVirtualDeclarationFact,
  SourcePrimitiveKind,
  TargetBindingFact,
  TargetConstraint,
  TargetMember,
  TargetParameter,
  TargetTypeParameter,
  TargetTypeRef,
} from "./facts.js";
import { ExtensionLifecycleEvent, getExtensionHost } from "./host.js";
import type {
  ExtensionEvidence,
  ExtensionHost,
  ProviderExportDeclaration,
  ProviderMemberDeclaration,
  ProviderParameterDeclaration,
  ProviderResolvedModule,
  ProviderSignatureDeclaration,
  ProviderTypeParameterDeclaration,
  ProviderTypeExpression,
} from "./host.js";

export function recordBoundSourceFileExtensionFacts(program: object, file: GoPtr<SourceFile>): void {
  const extensionHost = getExtensionHost(program);
  if (extensionHost === undefined || file === undefined) {
    return;
  }

  const fileName = SourceFile_FileName(file);
  const virtualModule = extensionHost.providers.getVirtualModuleByFileName(fileName);
  if (virtualModule !== undefined) {
    recordProviderVirtualModuleFacts(extensionHost, file, virtualModule);
  }
  extensionHost.runLifecycle(ExtensionLifecycleEvent.afterSourceFileBound, {
    sourceFile: file,
    fileName,
    ...(virtualModule !== undefined ? { providerVirtualModule: virtualModule } : {}),
  });
}

export function finalizeExtensionSemantics(program: object): ExtensionHost | undefined {
  const extensionHost = getExtensionHost(program);
  if (extensionHost === undefined) {
    return undefined;
  }
  extensionHost.finalizeSemantics();
  return extensionHost;
}

function recordProviderVirtualModuleFacts(extensionHost: ExtensionHost, file: SourceFile, virtualModule: ProviderResolvedModule): void {
  const evidence = getProviderVirtualModuleEvidence(virtualModule);
  extensionHost.facts.set(file, canonicalIdentityFactKey, {
    kind: "module",
    id: virtualModule.declarationModel.providerModuleId,
    ...(virtualModule.resolution.packageName !== undefined ? { packageName: virtualModule.resolution.packageName } : {}),
    ...(virtualModule.resolution.packageVersion !== undefined ? { packageVersion: virtualModule.resolution.packageVersion } : {}),
    subpath: virtualModule.resolution.moduleSpecifier,
  }, evidence);
  extensionHost.facts.set(file, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule), evidence);

  const fileSymbol = Node_Symbol(file as GoPtr<Node>);
  if (fileSymbol === undefined) {
    return;
  }

  extensionHost.facts.set(fileSymbol, canonicalIdentityFactKey, {
    kind: "module",
    id: virtualModule.declarationModel.providerModuleId,
    ...(virtualModule.resolution.packageName !== undefined ? { packageName: virtualModule.resolution.packageName } : {}),
    ...(virtualModule.resolution.packageVersion !== undefined ? { packageVersion: virtualModule.resolution.packageVersion } : {}),
    subpath: virtualModule.resolution.moduleSpecifier,
    canonicalSymbolId: getSymbolFactId(fileSymbol),
  }, evidence);
  extensionHost.facts.set(fileSymbol, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule), evidence);

  for (const declaration of virtualModule.declarationModel.exports) {
    const symbol = fileSymbol.Exports?.get(declaration.name);
    if (symbol === undefined) {
      continue;
    }
    extensionHost.facts.set(symbol, canonicalIdentityFactKey, {
      kind: "export",
      id: `${virtualModule.declarationModel.providerModuleId}::${declaration.name}`,
      ...(virtualModule.resolution.packageName !== undefined ? { packageName: virtualModule.resolution.packageName } : {}),
      ...(virtualModule.resolution.packageVersion !== undefined ? { packageVersion: virtualModule.resolution.packageVersion } : {}),
      subpath: virtualModule.resolution.moduleSpecifier,
      exportName: declaration.name,
      canonicalSymbolId: getSymbolFactId(symbol),
    }, evidence);
    extensionHost.facts.set(symbol, providerVirtualDeclarationFactKey, getProviderVirtualDeclarationFact(virtualModule, declaration), evidence);

    const targetBinding = getTargetBindingFact(virtualModule, declaration);
    if (targetBinding !== undefined) {
      extensionHost.facts.set(symbol, targetBindingFactKey, targetBinding, evidence);
    }
  }
}

function getProviderVirtualModuleEvidence(virtualModule: ProviderResolvedModule): readonly ExtensionEvidence[] {
  return [{
    message: "provider virtual module",
    details: {
      provider: virtualModule.provider.identity,
      moduleSpecifier: virtualModule.resolution.moduleSpecifier,
      providerModuleId: virtualModule.resolution.providerModuleId,
      virtualFileName: virtualModule.resolution.virtualFileName,
    },
  }];
}

function getSymbolFactId(symbol: Symbol): string {
  return `${symbol.Name}:${String(symbol.id)}`;
}

function getTargetBindingFact(virtualModule: ProviderResolvedModule, declaration: ProviderExportDeclaration): TargetBindingFact | undefined {
  if (declaration.targetIdentity === undefined) {
    return undefined;
  }
  return {
    id: declaration.targetIdentity.id,
    sourceName: declaration.name,
    targetName: declaration.targetIdentity.displayName ?? declaration.targetIdentity.id,
    target: declaration.targetIdentity.target,
    kind: getTargetBindingKind(declaration.kind),
    ...(declaration.typeParameters !== undefined
      ? {
        typeParameters: declaration.typeParameters.map(getTargetTypeParameter),
      }
      : {}),
    ...(declaration.members !== undefined ? { members: declaration.members.flatMap(getTargetMembers) } : {}),
  };
}

function getTargetTypeParameter(parameter: ProviderTypeParameterDeclaration): TargetTypeParameter {
  const constraints = (parameter.constraints ?? []).flatMap(getTargetConstraint);
  return {
    name: parameter.name,
    ...(constraints.length > 0 ? { constraints } : {}),
    ...(parameter.variance !== undefined ? { variance: parameter.variance } : {}),
  };
}

function getTargetMembers(member: ProviderMemberDeclaration): readonly TargetMember[] {
  if (member.signatures !== undefined && member.signatures.length > 0) {
    return member.signatures.map((signature) => getTargetMemberFromSignature(member.name, member.kind, signature, member));
  }
  return [{
    id: member.id,
    sourceName: member.name,
    targetName: member.name,
    kind: member.kind,
    parameters: [],
    ...(member.static !== undefined ? { static: member.static } : {}),
    ...(member.type !== undefined ? { returnType: getTargetTypeRef(member.type) } : {}),
  }];
}

function getTargetMemberFromSignature(sourceName: string, kind: TargetMember["kind"], signature: ProviderSignatureDeclaration, member?: ProviderMemberDeclaration): TargetMember {
  const typeParameters = (signature.typeParameters ?? []).map(getTargetTypeParameter);
  return {
    id: signature.id,
    sourceName,
    targetName: signature.name ?? member?.name ?? sourceName,
    kind,
    parameters: signature.parameters.map(getTargetParameter),
    ...(member?.static !== undefined ? { static: member.static } : {}),
    ...(signature.returnType !== undefined ? { returnType: getTargetTypeRef(signature.returnType) } : {}),
    ...(typeParameters.length > 0 ? { typeParameters } : {}),
    overloadGroup: member?.id ?? sourceName,
  };
}

function getTargetParameter(parameter: ProviderParameterDeclaration): TargetParameter {
  return {
    name: parameter.name,
    type: getTargetTypeRef(parameter.type),
    passingMode: getArgumentPassingMode(parameter),
    ...(parameter.optional === true ? { optional: true } : {}),
    ...(parameter.rest === true ? { paramsArray: true } : {}),
  };
}

function getArgumentPassingMode(parameter: ProviderParameterDeclaration): ArgumentPassingMode {
  return "by-value";
}

function getTargetConstraint(type: ProviderTypeExpression): readonly TargetConstraint[] {
  switch (type.kind) {
    case "target-named":
      return [{
        kind: "implements",
        contract: type.id,
        ...(type.typeArguments !== undefined ? { typeArguments: type.typeArguments.map(getTargetTypeRef) } : {}),
      }];
    default:
      return [];
  }
}

function getTargetTypeRef(type: ProviderTypeExpression): TargetTypeRef {
  switch (type.kind) {
    case "boolean":
      return { kind: "source-primitive", name: "bool" };
    case "bigint":
      return { kind: "source-primitive", name: "int64" };
    case "source-primitive":
      return { kind: "source-primitive", name: getSourcePrimitiveKind(type.name) };
    case "type-parameter":
      return { kind: "type-parameter", name: type.name };
    case "target-named":
      return {
        kind: "target-named",
        id: type.id,
        ...(type.typeArguments !== undefined ? { typeArguments: type.typeArguments.map(getTargetTypeRef) } : {}),
      };
    case "array":
      return { kind: "array", element: getTargetTypeRef(type.elementType) };
    case "tuple":
      return { kind: "tuple", elements: type.elementTypes.map(getTargetTypeRef) };
    case "function":
      return {
        kind: "function-pointer",
        args: type.parameters.map((parameter) => getTargetTypeRef(parameter.type)),
        result: getTargetTypeRef(type.returnType),
      };
    case "opaque":
      return { kind: "opaque", id: type.id };
    case "string":
    case "number":
    case "any":
    case "unknown":
    case "void":
    case "never":
    case "object":
    case "union":
    case "intersection":
    case "literal":
      return { kind: "opaque", id: type.kind };
  }
}

function getSourcePrimitiveKind(name: string): SourcePrimitiveKind {
  switch (name) {
    case "bool":
    case "boolean":
      return "bool";
    case "char":
      return "char";
    case "sbyte":
    case "int8":
      return "int8";
    case "byte":
    case "uint8":
      return "uint8";
    case "short":
    case "int16":
      return "int16";
    case "ushort":
    case "uint16":
      return "uint16";
    case "int":
    case "int32":
      return "int32";
    case "uint":
    case "uint32":
      return "uint32";
    case "long":
    case "int64":
      return "int64";
    case "ulong":
    case "uint64":
      return "uint64";
    case "nint":
    case "native-int":
      return "native-int";
    case "nuint":
    case "native-uint":
      return "native-uint";
    case "half":
    case "float16":
      return "float16";
    case "float":
    case "float32":
      return "float32";
    case "double":
    case "float64":
      return "float64";
    case "decimal":
      return "decimal";
    case "int128":
      return "int128";
    case "uint128":
      return "uint128";
    default:
      throw new Error(`Unknown source primitive '${name}'.`);
  }
}

function getProviderVirtualDeclarationFact(virtualModule: ProviderResolvedModule, declaration?: ProviderExportDeclaration): ProviderVirtualDeclarationFact {
  return {
    providerId: virtualModule.provider.identity.id,
    providerVersion: virtualModule.provider.identity.version,
    providerModuleId: virtualModule.resolution.providerModuleId,
    moduleSpecifier: virtualModule.resolution.moduleSpecifier,
    virtualFileName: virtualModule.resolution.virtualFileName,
    ...(declaration !== undefined ? { exportName: declaration.name } : {}),
    ...(declaration?.targetIdentity !== undefined
      ? {
        targetIdentity: {
          kind: "target-named",
          id: declaration.targetIdentity.id,
        } satisfies TargetTypeRef,
      }
      : {}),
  };
}

function getTargetBindingKind(kind: ProviderExportDeclaration["kind"]): TargetBindingFact["kind"] {
  switch (kind) {
    case "class":
      return "class";
    case "interface":
      return "interface";
    case "enum":
      return "enum";
    case "function":
      return "function";
    case "opaque":
      return "opaque";
    case "type":
    case "value":
    case "namespace":
      return "opaque";
  }
}
