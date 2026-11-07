import {
  sourceAnalysisCallSignatures, sourceAnalysisConstructSignatures, sourceAnalysisIncludesFile, sourceAnalysisValueType,
  type SourceAnalysisProgram,
} from "../../analysis-program.js";
import { sourcePresentStorageArms, sourceStorageMembers } from "./components.js";
import { sourceStorageCallReceiver } from "../graph/invocation-inputs.js";
import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { createSourceCallableValueQuery } from "../../../source-navigation/callable-values.js";
import type { SourceCallSelection } from "../../../public/source/selections.js";
import type { SourceStorageCallEffect, SourceStorageEffects } from "./types.js";

export interface SourceGlobalStorageBinding {
  readonly name: string;
  readonly providerId: string;
}

export type SourceGlobalCallStorageEffect = {
  readonly declaration: Node;
  readonly effect: SourceStorageCallEffect;
} & ({ readonly form: "member" | "value"; readonly binding: SourceGlobalStorageBinding }
  | { readonly form: "receiver" });

export function createSourceGlobalCallStorageEffects(
  source: SourceAnalysisProgram,
  select: (node: Node, call: SourceCallSelection) => SourceGlobalCallStorageEffect | undefined,
  selectConstructor: (declaration: Node) =>
    { readonly declaration: Node; readonly binding: SourceGlobalStorageBinding } | undefined,
): SourceStorageEffects {
  const selectValue = createSourceCallableValueQuery(source);
  const matchesBinding = (binding: Node | undefined,
    operation: { readonly declaration: Node; readonly binding: SourceGlobalStorageBinding }): boolean => {
    const file = binding === undefined ? undefined : source.ast.getSourceFile(binding);
    if (binding === undefined || file === undefined || !source.ast.is.IsVariableDeclaration(binding) ||
      source.ast.as.AsVariableDeclaration(binding)?.Initializer !== undefined ||
      source.navigation.declarationUseSummary(binding).bindingWritten) return false;
    const declaration = source.sourceFacts.getFact(operation.declaration, providerVirtualDeclarationFactKey);
    if (declaration === undefined) {
      // Without provider facts, only the global the operation names in its own declaring file is that operation's receiver;
      // another binding of the same type is an unknown receiver.
      if (file !== source.ast.getSourceFile(operation.declaration) ||
        source.ast.text(source.ast.name(binding)) !== operation.binding.name) return false;
      const type = sourceAnalysisValueType(source, binding);
      if (type === undefined) return false;
      const arms = sourcePresentStorageArms(type);
      if (arms.flatMap(arm => [...sourceAnalysisCallSignatures(arm), ...sourceAnalysisConstructSignatures(arm)])
        .some(signature => signature.declaration === operation.declaration)) return true;
      return sourceStorageMembers(source, type)?.some(member => member.declarations.includes(operation.declaration)) === true;
    }
    const global = source.sourceFacts.getFact(binding, providerVirtualDeclarationFactKey);
    return global?.providerId === operation.binding.providerId && global.providerId === declaration.providerId &&
      global.providerVersion === declaration.providerVersion && global.providerModuleId === declaration.providerModuleId &&
      global.moduleSpecifier === declaration.moduleSpecifier && global.artifactFileName === declaration.artifactFileName &&
      global.exportName === operation.binding.name && global.memberName === undefined && global.memberKey === undefined &&
      global.memberId === undefined && global.signatureId === undefined;
  };
  return Object.freeze({
    nativeConstructorsFor(binding) {
      if (!sourceAnalysisIncludesFile(source, source.ast.getSourceFile(binding)) || !source.ast.is.IsVariableDeclaration(binding) ||
        source.ast.as.AsVariableDeclaration(binding)?.Initializer !== undefined ||
        source.navigation.declarationUseSummary(binding).bindingWritten) return undefined;
      const type = sourceAnalysisValueType(source, binding);
      const signatures = type === undefined ? [] : sourcePresentStorageArms(type).flatMap(arm => sourceAnalysisConstructSignatures(arm));
      if (signatures.length === 0) return undefined;
      const declarations = new Set<Node>();
      for (const signature of signatures) {
        const declaration = signature.declaration;
        if (declaration === undefined || !source.ast.is.IsConstructSignatureDeclaration(declaration)) return undefined;
        const operation = selectConstructor(declaration);
        if (operation === undefined || operation.declaration !== declaration || !matchesBinding(binding, operation)) return undefined;
        declarations.add(declaration);
      }
      return Object.freeze([...declarations]);
    },
    call(node, published) {
      const call = source.navigation.call(node);
      if (call === undefined || call.selection !== "resolved") return undefined;
      const operation = select(node, published);
      if (operation === undefined) return undefined;
      if (call.signature !== operation.declaration) return undefined;
      if (operation.form === "receiver")
        return sourceStorageCallReceiver(source, call) === undefined ? undefined : operation.effect;
      const value = selectValue(call.callee);
      if (value === undefined) return undefined;
      const access = value.access;
      if ((access === undefined) !== (operation.form === "value")) return undefined;
      const binding = access === undefined ? value.selectedDeclaration : value.receiverDeclaration;
      if (!matchesBinding(binding, operation)) return undefined;
      if (access !== undefined) {
        const declarations = access.declarations.length === 0 ? [value.selectedDeclaration]
          : access.declarations.flatMap(declaration => source.navigation.mergedDeclarations(declaration));
        if (!declarations.includes(operation.declaration)) return undefined;
      }
      return operation.effect;
    },
  } satisfies SourceStorageEffects);
}
