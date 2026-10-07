import type { Node, ResolvedSourceCallInfo } from "@tsonic/tsts";

export interface JsSourceCallStorageEffect {
  readonly resultAlias?: Node;
  readonly preservedInputs: readonly Node[];
}

export function jsSourceCallStorageEffect(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined, call: ResolvedSourceCallInfo): JsSourceCallStorageEffect | undefined {
  if (identity?.ownerName !== "ObjectConstructor" ||
    identity.memberName !== "freeze" && identity.memberName !== "isFrozen" ||
    call.sourceSelectedSignatureKind !== "resolved") return undefined;
  const bindings = call.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === 0);
  const binding = bindings.length === 1 ? bindings[0] : undefined;
  if (binding?.sourceForm !== "value" || binding.sourceParameterForm !== "parameter" ||
    !Number.isInteger(binding.sourceArgumentIndex) || binding.sourceArgumentIndex < 0) return undefined;
  const argument = call.sourceArguments[binding.sourceArgumentIndex]?.expression;
  if (argument === undefined) return undefined;
  return Object.freeze({
    ...(identity.memberName === "freeze" ? { resultAlias: argument } : {}),
    preservedInputs: Object.freeze([argument]),
  });
}
