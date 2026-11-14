const parameterBindingKey = value => value.kind === "rigid"
  ? [value.kind, value.parameter.owner, value.parameter.index]
  : [value.kind, value.parameter.owner, value.parameter.index, value.type];

export const bindingVectorKey = value => [value.classBindings.map(parameterBindingKey),
  value.methodBindings.map(parameterBindingKey), value.capturedBindings.map(parameterBindingKey),
  value.selfBindings.map(binding => binding.kind === "rigid" ? [binding.kind, binding.owner]
    : [binding.kind, binding.owner, binding.type])];

export const artifactBindingsKey = value => value.kind === "parametric" ? [value.kind]
  : [value.kind, bindingVectorKey(value.bindings)];

export const bodyInstanceKey = value => [value.body, artifactBindingsKey(value.bindings)];
export const declarationInstanceKey = value => [value.definition, artifactBindingsKey(value.bindings)];
export const relationalOwnerKey = value => value.kind === "body"
  ? [value.kind, bodyInstanceKey(value.instance)] : [value.kind, declarationInstanceKey(value)];

export function bindingTargetKey(value) {
  switch (value.kind) {
    case "observations": case "body": return [value.kind, bodyInstanceKey(value.instance)];
    case "summary": return [value.kind, declarationInstanceKey(value.summary)];
    case "metadata": return [value.kind, declarationInstanceKey(value.metadata)];
  }
  throw new Error("Unlisted native binding target fixture");
}

export const sourceReferenceKey = value => [value.kind,
  value.kind === "body" ? value.value.body : value.value.owner, value.value.node];

export const libraryExportKey = value => [[value.module.providerId, value.module.providerVersion,
  value.module.packageName, value.module.moduleSpecifier, value.module.providerModuleId],
value.exportId, value.memberId, value.signatureId];
