import type { Node, ResolvedSourceCallInfo } from "@tsonic/tsts";
import { jsSourceSemanticsIdentity } from "./source.js";

export interface JsSourceStorageOperationIdentity {
  readonly ownerName: string;
  readonly memberName: string;
  readonly declaration: Node;
}

export interface JsSourceCallStorageEffect {
  readonly resultAlias?: Node;
  readonly resultAllocation?: Node;
  readonly preservedInputs: readonly Node[];
}

const nativeErrorConstructorOwners = new Set([
  "ErrorConstructor", "RangeErrorConstructor", "TypeErrorConstructor", "URIErrorConstructor",
]);

const nativeOperationBindings = new Map([
  ["ObjectConstructor", "Object"],
  ["ErrorConstructor", "Error"],
  ["RangeErrorConstructor", "RangeError"],
  ["TypeErrorConstructor", "TypeError"],
  ["URIErrorConstructor", "URIError"],
]);

export function selectJsSourceCallStorageEffect(
  identity: JsSourceStorageOperationIdentity | undefined,
  call: ResolvedSourceCallInfo,
) {
  const effect = jsSourceCallStorageEffect(identity, call);
  const name = identity === undefined ? undefined : nativeOperationBindings.get(identity.ownerName);
  if (identity === undefined || name === undefined || effect === undefined) return undefined;
  const form: "member" | "value" = identity.memberName === "constructor" || identity.memberName === "call"
    ? "value" : "member";
  return Object.freeze({ declaration: identity.declaration, form, effect,
    binding: Object.freeze({ name, providerId: jsSourceSemanticsIdentity.providerId }) });
}

export function jsSourceCallStorageEffect(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined, call: ResolvedSourceCallInfo): JsSourceCallStorageEffect | undefined {
  if (call.sourceSelectedSignatureKind !== "resolved") return undefined;
  if (identity !== undefined && nativeErrorConstructorOwners.has(identity.ownerName) &&
    (identity.memberName === "constructor" || identity.memberName === "call")) {
    return Object.freeze({ resultAllocation: call.call, preservedInputs: Object.freeze([]) });
  }
  if (identity?.ownerName !== "ObjectConstructor" ||
    identity.memberName !== "freeze" && identity.memberName !== "isFrozen") return undefined;
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
