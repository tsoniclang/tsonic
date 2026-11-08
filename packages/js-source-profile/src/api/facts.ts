import type { Node } from "@tsonic/tsts";
import type { SourceJsApiFactsInput } from "@tsonic/target-api/host";
import type { SourceApplication, SourceJsApiFacts, SourceJsApiMember, SourceJsCallStorage,
  SourceJsCollectionFacts, SourceResult, SourceTypeEvidence } from "@tsonic/target-api/source";
import { jsTypedArrayElementKinds } from "../declarations/typed-arrays.js";
import { jsSourceSemanticsIdentity } from "../identities/source.js";
import { createJsProfileIdentityQuery } from "./identity.js";
import { jsProfileMemberMeaning } from "./members.js";
import { jsProfileArrayEffect } from "./array-effects.js";
import { jsProfileCallbackEffects, jsProfileCallRefusal, jsProfileInvocationOnlyParameters,
  jsProfileNativeOperation, jsProfileReceiverResumeEffect } from "./callable-effects.js";

const typedArrays = new Set(Object.keys(jsTypedArrayElementKinds));
const errorBindings: ReadonlyMap<string, string> = new Map([
  ["ErrorConstructor", "Error"], ["RangeErrorConstructor", "RangeError"],
  ["TypeErrorConstructor", "TypeError"], ["URIErrorConstructor", "URIError"],
]);
const collectionNames: ReadonlyMap<string, "array" | "readonly-array" | "set" | "weak-set" | "map" | "weak-map"> = new Map([
  ["Array", "array"], ["ReadonlyArray", "readonly-array"], ["Set", "set"], ["ReadonlySet", "set"],
  ["WeakSet", "weak-set"], ["Map", "map"], ["ReadonlyMap", "map"], ["WeakMap", "weak-map"],
]);
const resolved = <Value>(value: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value });

export function createJsSourceApiFacts(input: SourceJsApiFactsInput): SourceJsApiFacts {
  const { view, assertApplication } = input;
  const scoped = createJsProfileIdentityQuery(input);
  const members = new WeakMap<Node, SourceJsApiMember | null>();
  const collections = new WeakMap<SourceTypeEvidence, SourceResult<SourceJsCollectionFacts | undefined>>();
  const storage = new WeakMap<SourceApplication, SourceJsCallStorage | null>();
  const identity: SourceJsApiFacts["identity"] = declaration => {
    const selected = scoped(declaration);
    return selected?.scope === "js" ? selected.identity : undefined;
  };
  const operation = (declaration: Node, facet: "member" | "storage" | "callbacks") => {
    const selected = scoped(declaration);
    const declared = selected?.identity;
    if (selected === undefined || declared?.declaringName === undefined) return undefined;
    const memberName = declared.kind === "member" || declared.declaringName === "Global" ? declared.name
      : declared.kind === "construct" ? "constructor" : declared.kind === "call" ? "call" : undefined;
    if (memberName === undefined) return undefined;
    const named = Object.freeze({ ownerName: declared.declaringName, memberName });
    if (selected.scope === "shared" && (facet === "member" || !jsProfileNativeOperation(named) &&
      (facet === "callbacks" || memberName !== "constructor" && memberName !== "call"))) return undefined;
    return Object.freeze({ identity: declared, named });
  };
  const member: SourceJsApiFacts["member"] = declaration => {
    const selected = operation(declaration, "member");
    const known = members.get(declaration);
    if (known !== undefined) return known ?? undefined;
    const meaning = selected === undefined ? undefined
      : jsProfileMemberMeaning(selected.named.ownerName, selected.named.memberName);
    const result = meaning === undefined || selected === undefined ? undefined
      : Object.freeze({ ...meaning, declaration, name: selected.named.memberName });
    members.set(declaration, result ?? null);
    return result;
  };
  const selectCollection = (value: SourceTypeEvidence): SourceResult<SourceJsCollectionFacts | undefined> => {
    const type = value.type;
    if (type.kind === "string") return resolved(Object.freeze({ kind: "string" }));
    if (type.kind === "array") {
      const element = view.component(value, { kind: "array-element" });
      return element.kind === "refused" ? element
        : resolved(Object.freeze({ kind: type.readonly ? "readonly-array" : "array", element: element.value }));
    }
    if (type.kind !== "declared") return resolved(undefined);
    const declared = identity(type.declaration);
    if (declared?.kind === "type" && declared.name !== undefined) {
      const kind = collectionNames.get(declared.name);
      if (kind !== undefined) {
        const first = view.component(value, { kind: "type-argument", declaration: type.declaration, index: 0 });
        if (first.kind === "refused") return first;
        if (kind !== "map" && kind !== "weak-map") return resolved(Object.freeze({ kind, element: first.value }));
        const second = view.component(value, { kind: "type-argument", declaration: type.declaration, index: 1 });
        return second.kind === "refused" ? second : resolved(Object.freeze({ kind, key: first.value, value: second.value }));
      }
      if (declared.name === "TypedArray" || typedArrays.has(declared.name)) {
        const definition = view.definition(value);
        if (definition.kind === "refused") return definition;
        if (definition.value.type.kind !== "shape") throw new Error("A typed-array declaration requires its published index structure.");
        const indexes = definition.value.type.indexes.filter(index => {
          const owner = identity(index.declaration);
          return owner?.kind === "indexer" && owner.declaringName === "TypedArray";
        });
        if (indexes.length !== 1) throw new Error("A typed-array declaration requires its one original element index signature.");
        const element = view.component(definition.value, { kind: "index-value", declaration: indexes[0]!.declaration });
        return element.kind === "refused" ? element : resolved(Object.freeze({ kind: "typed-array", element: element.value }));
      }
    }
    const definition = view.definition(value);
    if (definition.kind === "refused") return definition;
    return definition.value.type.kind === "array" || definition.value.type.kind === "string"
      ? selectCollection(definition.value) : resolved(undefined);
  };
  const collection: SourceJsApiFacts["collection"] = value => {
    view.assertEvidence(value);
    const existing = collections.get(value);
    if (existing !== undefined) return existing;
    const selected = selectCollection(value);
    collections.set(value, selected);
    return selected;
  };
  const selectedApplication = (application: SourceApplication, facet: "storage" | "callbacks") => {
    assertApplication(application);
    const declaration = application.identity.signature.declaration;
    return application.kind === "function-value" || declaration === undefined ? undefined : operation(declaration, facet);
  };
  const selectStorage = (application: SourceApplication): SourceJsCallStorage | undefined => {
    const selected = selectedApplication(application, "storage");
    if (selected === undefined) return undefined;
    const { identity: declared, named } = selected;
    if (jsProfileReceiverResumeEffect(named) === true && application.receiver.kind === "value")
      return Object.freeze({ declaration: declared.declaration, form: "receiver", effect: Object.freeze({ kind: "receiver-resume" }) });
    const binding = errorBindings.get(named.ownerName);
    if (binding !== undefined && (named.memberName === "constructor" || named.memberName === "call"))
      return Object.freeze({ declaration: declared.declaration, form: "value",
        binding: Object.freeze({ name: binding, providerId: jsSourceSemanticsIdentity.providerId }),
        effect: Object.freeze({ kind: "result-allocation", allocation: application.identity.invocation }) });
    if (named.ownerName !== "ObjectConstructor" || named.memberName !== "freeze") return undefined;
    const bindings = application.arguments.filter(argument => argument.parameter.index === 0);
    const argument = bindings.length === 1 ? bindings[0] : undefined;
    if (argument?.sourceForm !== "value" || argument.parameter.form !== "parameter" ||
      !Number.isInteger(argument.sourceArgumentIndex) || argument.sourceArgumentIndex < 0) return undefined;
    const authored = application.sourceArguments[argument.sourceArgumentIndex];
    if (authored?.form !== "value" || authored.occurrence !== argument.sourceArgument ||
      authored.operand.occurrence !== argument.effectiveArgument) return undefined;
    return Object.freeze({ declaration: declared.declaration, form: "member",
      binding: Object.freeze({ name: "Object", providerId: jsSourceSemanticsIdentity.providerId }),
      effect: Object.freeze({ kind: "result-alias", argument: authored.operand.occurrence }) });
  };
  const callStorage: SourceJsApiFacts["callStorage"] = application => {
    assertApplication(application);
    const existing = storage.get(application);
    if (existing !== undefined) return existing ?? undefined;
    const selected = selectStorage(application);
    storage.set(application, selected ?? null);
    return selected;
  };
  return Object.freeze({ identity, member, collection, callStorage,
    arrayMemberEffect: declaration => jsProfileArrayEffect(operation(declaration, "member")?.named),
    callbackEffects: application => jsProfileCallbackEffects(selectedApplication(application, "callbacks")?.named),
    invocationOnlyParameters: declaration => jsProfileInvocationOnlyParameters(operation(declaration, "member")?.named),
    callRefusal: declaration => jsProfileCallRefusal(operation(declaration, "callbacks")?.named),
    nativeConstructorStorage: declaration => {
      const selected = operation(declaration, "storage");
      const binding = selected?.identity.kind !== "construct" ? undefined : errorBindings.get(selected.named.ownerName);
      return binding === undefined || selected === undefined ? undefined : Object.freeze({ declaration,
        binding: Object.freeze({ name: binding, providerId: jsSourceSemanticsIdentity.providerId }) });
    },
  });
}
