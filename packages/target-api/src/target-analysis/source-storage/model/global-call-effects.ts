import type { Node } from "@tsonic/tsts";
import type { SourceApplication, SourceSignatureIdentity } from "../../../public/source/contracts.js";
import { createSourceCallableValueQuery } from "../../../source-navigation/callable-values.js";
import type { SourceJsCallStorage } from "../../../source-model/profile.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageNativeConstructorPremise } from "../../../source-model/storage.js";
import type { SourceStorageProgram } from "./program.js";
import { sourceStorageValue } from "./program.js";

export function createSourceStorageProfileEffects(source: SourceStorageProgram, budget: SourceStorageBudget,
  premises: readonly SourceStorageNativeConstructorPremise[]) {
  const { ast } = source;
  const { navigation, values, descriptors, profile } = source.facts;
  const selectValue = createSourceCallableValueQuery(source);
  const native = new Map<Node, readonly SourceSignatureIdentity[]>();
  for (const premise of premises) {
    navigation.callableRoles(premise.binding);
    if (native.has(premise.binding)) throw new Error("Native constructor premises require one exact binding owner.");
    const slot = sourceStorageValue(values.declaredSlot(premise.binding));
    const definition = sourceStorageValue(descriptors.definition(slot.type));
    const type = definition.type;
    const signatures = type.kind === "callable" || type.kind === "shape" ? type.constructs : [];
    if (premise.constructors.length === 0 || premise.constructors.some(identity =>
      identity.kind !== "construct" || !signatures.some(signature => signature.identity === identity)))
      throw new Error("Native constructor premises require every identical original Source constructor signature.");
    native.set(premise.binding, Object.freeze([...premise.constructors]));
  }
  const matchesBinding = (binding: Node | undefined, operation:
    { readonly declaration: Node; readonly binding: { readonly name: string; readonly providerId: string } }): boolean => {
    if (binding === undefined || !ast.is.IsVariableDeclaration(binding) ||
      ast.as.AsVariableDeclaration(binding)?.Initializer !== undefined ||
      navigation.declarationUseSummary(binding).bindingWritten) return false;
    const declared = navigation.providerDeclaration(operation.declaration);
    const actual = navigation.providerDeclaration(binding);
    if (declared.kind === "present") {
      if (actual.kind !== "present") return false;
      const expected = declared.value, selected = actual.value;
      return selected.providerId === operation.binding.providerId && selected.providerId === expected.providerId &&
        selected.providerVersion === expected.providerVersion && selected.providerModuleId === expected.providerModuleId &&
        selected.moduleSpecifier === expected.moduleSpecifier && selected.artifactFileName === expected.artifactFileName &&
        selected.exportName === operation.binding.name && selected.memberName === undefined && selected.memberKey === undefined &&
        selected.memberId === undefined && selected.signatureId === undefined;
    }
    if (actual.kind === "present" || ast.getSourceFile(binding) !== ast.getSourceFile(operation.declaration) ||
      ast.text(ast.name(binding)) !== operation.binding.name) return false;
    const selected = sourceStorageValue(values.declaredSlot(binding));
    const original = sourceStorageValue(descriptors.definition(selected.type));
    const type = original.type;
    if ((type.kind === "callable" || type.kind === "shape") &&
      [...type.calls, ...type.constructs].some(signature => signature.identity.declaration === operation.declaration)) return true;
    const rows = sourceStorageValue(source.analysis.settle(source.analysis.inventory.members(selected.type)));
    return rows.kind === "complete" && rows.members.some(row => row.declarations.includes(operation.declaration));
  };
  const select = (application: SourceApplication): SourceJsCallStorage | undefined => {
    if (profile.kind === "none" || application.argumentDisposition === "skip") return undefined;
    const operation = profile.value.callStorage(application);
    if (operation === undefined) return undefined;
    if (operation.declaration !== application.identity.signature.declaration)
      throw new Error("Profile storage effects require the identical selected Source signature declaration.");
    if (operation.form === "receiver") return application.receiver.kind === "value" ? operation : undefined;
    const selected = sourceStorageValue(selectValue(application.callee.occurrence));
    if (selected.kind === "none") return undefined;
    const value = selected.value;
    if ((value.member.kind === "none") !== (operation.form === "value")) return undefined;
    const binding = value.member.kind === "none" ? value.selectedDeclaration : value.receiverDeclaration;
    if (!matchesBinding(binding, operation)) return undefined;
    if (value.member.kind === "present" && !value.member.value.selectedDeclarations.includes(operation.declaration)) return undefined;
    return operation;
  };
  return Object.freeze({
    call(application: SourceApplication) {
      return select(application)?.effect;
    },
    callbacks(application: SourceApplication) {
      return profile.kind === "none" || application.argumentDisposition === "skip"
        ? undefined : profile.value.callbackEffects(application);
    },
    constructors(binding: Node): readonly SourceSignatureIdentity[] | undefined {
      navigation.callableRoles(binding);
      const supplied = native.get(binding);
      if (supplied !== undefined) return supplied;
      if (profile.kind === "none" || !ast.is.IsVariableDeclaration(binding) ||
        ast.as.AsVariableDeclaration(binding)?.Initializer !== undefined ||
        navigation.declarationUseSummary(binding).bindingWritten) return undefined;
      const slot = sourceStorageValue(values.declaredSlot(binding));
      const definition = sourceStorageValue(descriptors.definition(slot.type));
      const type = definition.type;
      if (type.kind !== "callable" && type.kind !== "shape" || type.constructs.length === 0) return undefined;
      const selected: SourceSignatureIdentity[] = [];
      for (const signature of type.constructs) {
        if (!budget.step()) return undefined;
        const declaration = signature.identity.declaration;
        const operation = declaration === undefined ? undefined : profile.value.nativeConstructorStorage(declaration);
        if (operation === undefined || !matchesBinding(binding, operation)) return undefined;
        selected.push(signature.identity);
      }
      return Object.freeze(selected);
    },
  });
}
