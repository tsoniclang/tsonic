import type { Node, ResolvedSourceCallInfo } from "@tsonic/tsts";
import { jsSourceSemanticsIdentity } from "./source.js";
import { jsSourceReceiverResumeEffect } from "./callable-effects.js";

export interface JsSourceStorageOperationIdentity {
  readonly ownerName: string;
  readonly memberName: string;
  readonly declaration: Node;
}

export interface JsSourceCallStorageEffect {
  readonly resultAlias?: Node;
  readonly resultAllocation?: Node;
  readonly preservedInputs: readonly Node[];
  readonly resumeReceiver?: true;
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

function operationBinding(identity: JsSourceStorageOperationIdentity) {
  const name = nativeOperationBindings.get(identity.ownerName);
  return name === undefined ? undefined : Object.freeze({ name, providerId: jsSourceSemanticsIdentity.providerId });
}

export function jsSourceNativeConstructorStorage(identity: JsSourceStorageOperationIdentity | undefined) {
  if (identity === undefined || identity.memberName !== "constructor" || !nativeErrorConstructorOwners.has(identity.ownerName))
    return undefined;
  const binding = operationBinding(identity);
  return binding === undefined ? undefined : Object.freeze({ declaration: identity.declaration, binding });
}

export function selectJsSourceCallStorageEffect(
  identity: JsSourceStorageOperationIdentity | undefined,
  call: ResolvedSourceCallInfo,
) {
  const effect = jsSourceCallStorageEffect(identity, call);
  if (identity === undefined || effect === undefined) return undefined;
  if (effect.resumeReceiver === true)
    return Object.freeze({ declaration: identity.declaration, form: "receiver" as const, effect });
  const binding = operationBinding(identity);
  if (binding === undefined) return undefined;
  const form: "member" | "value" = identity.memberName === "constructor" || identity.memberName === "call"
    ? "value" : "member";
  return Object.freeze({ declaration: identity.declaration, form, effect, binding });
}

export function jsSourceCallStorageEffect(identity: {
  readonly ownerName: string;
  readonly memberName: string;
} | undefined, call: ResolvedSourceCallInfo): JsSourceCallStorageEffect | undefined {
  if (call.sourceSelectedSignatureKind !== "resolved") return undefined;
  if (jsSourceReceiverResumeEffect(identity) === true && call.sourceReceiver !== undefined)
    return Object.freeze({ resumeReceiver: true, preservedInputs: Object.freeze([call.sourceReceiver.expression]) });
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
