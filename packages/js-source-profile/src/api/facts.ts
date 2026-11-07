// SourceJsApiFacts (D18): the JS profile's published Source facts, built once per program view by the Host program
// owner (createTargetSourceProgram's `profile` option). Declarations and descriptors only (I1). Every member reads the
// one JS API meaning table (api/table.ts) through the declaration's profile identity; the memo tables live in this
// closure, so their lifetime is the program view (I5).
import type { Node } from "@tsonic/tsts";
import type {
  SourceCallSelection, SourceJsApiFacts, SourceJsApiFactsInput, SourceJsApiIdentity, SourceJsApiMember,
  SourceJsCallbackEffect, SourceJsCallStorage, SourceJsCollectionFacts, SourceJsNativeConstructorStorage,
  SourceKeyCategory, SourceTypeDescriptor,
} from "@tsonic/target-api/source";
import { sourceTypeDescriptorStructure } from "@tsonic/target-api/source";
import { jsTypedArrayElementKinds } from "../declarations/typed-arrays.js";
import { jsSourceSemanticsIdentity } from "../identities/source.js";
import { jsSourceProfileIdentity, type JsSourceProfileIdentity } from "./identity.js";
import { jsSourceApiEntry, type JsSourceApiEntry } from "./table.js";

const typedArrayNames: ReadonlySet<string> = new Set(Object.keys(jsTypedArrayElementKinds));
const noParameters: readonly number[] = Object.freeze([]);

/** An operation of the table: the identity's entry under its operation name, with the identity's scope. */
interface JsSourceOperation {
  readonly scope: JsSourceProfileIdentity["scope"];
  readonly identity: SourceJsApiIdentity;
  readonly name: string;
  readonly entry: JsSourceApiEntry | undefined;
}

export function createJsSourceApiFacts(input: SourceJsApiFactsInput): SourceJsApiFacts {
  const identities = new WeakMap<Node, JsSourceProfileIdentity | null>();
  const members = new WeakMap<Node, SourceJsApiMember | null>();
  const collections = new WeakMap<SourceTypeDescriptor, SourceJsCollectionFacts | null>();

  const scoped = (declaration: Node): JsSourceProfileIdentity | undefined => {
    const known = identities.get(declaration);
    if (known !== undefined) return known ?? undefined;
    const selected = jsSourceProfileIdentity(input, declaration);
    identities.set(declaration, selected ?? null);
    return selected;
  };

  /** The JS-scope identity (a declaration of the JS source profile or its provider). */
  const identity = (declaration: Node): SourceJsApiIdentity | undefined => {
    const selected = scoped(declaration);
    return selected?.scope === "js" ? selected.identity : undefined;
  };

  /**
   * The table operation a declaration names: a member by name, a construct signature as `constructor`, and for the
   * storage facet an unnamed call signature as `call`. A declaration under another source profile (which includes the
   * shared base declarations) names a storage operation only for its constructor and call signatures and its native
   * operations, and a callback operation only for its native operations.
   */
  const operation = (declaration: Node, facet: "storage" | "callbacks"): JsSourceOperation | undefined => {
    const selected = scoped(declaration);
    const declared = selected?.identity;
    if (selected === undefined || declared === undefined || declared.declaringName === undefined) return undefined;
    const name = declared.kind === "member" ? declared.name
      : declared.kind === "construct" ? "constructor"
      : facet === "storage" && declared.kind === "call" && declared.name === undefined ? "call" : undefined;
    if (name === undefined) return undefined;
    const entry = jsSourceApiEntry(declared.declaringName, name);
    if (selected.scope === "profile" && entry?.callables?.native !== true &&
      (facet === "callbacks" || name !== "constructor" && name !== "call")) {
      return undefined;
    }
    return { scope: selected.scope, identity: declared, name, entry };
  };

  const member = (declaration: Node): SourceJsApiMember | undefined => {
    const known = members.get(declaration);
    if (known !== undefined) return known ?? undefined;
    const declared = identity(declaration);
    const named = declared === undefined || declared.declaringName === undefined ? undefined
      : declared.kind === "member" || declared.kind === "call" && declared.declaringName === "Global" ? declared.name
      : declared.kind === "construct" ? "constructor"
      : declared.kind === "call" ? "call" : undefined;
    const meaning = named === undefined || declared?.declaringName === undefined ? undefined
      : jsSourceApiEntry(declared.declaringName, named)?.meaning;
    const selected = meaning === undefined || named === undefined ? undefined : Object.freeze({
      declaration,
      owner: meaning.owner,
      name: named,
      receiver: meaning.receiver,
      parameters: meaning.parameters,
      result: meaning.result,
      effects: meaning.effects,
    });
    members.set(declaration, selected ?? null);
    return selected;
  };

  const collection = (type: SourceTypeDescriptor): SourceJsCollectionFacts | undefined => {
    const known = collections.get(type);
    if (known !== undefined) return known ?? undefined;
    const selected = ((): SourceJsCollectionFacts | undefined => {
      if (type.kind === "array") return Object.freeze({ kind: type.readonly ? "readonly-array" : "array", element: type.element });
      if (type.kind === "string") return Object.freeze({ kind: "string" });
      if (type.kind !== "declared") return undefined;
      const declared = identity(type.declaration);
      if (declared?.kind !== "type" || declared.name === undefined) return undefined;
      const [first, second] = type.typeArguments;
      switch (declared.name) {
        case "Array": return first === undefined ? undefined : Object.freeze({ kind: "array", element: first });
        case "ReadonlyArray": return first === undefined ? undefined : Object.freeze({ kind: "readonly-array", element: first });
        case "Set": case "ReadonlySet": return first === undefined ? undefined : Object.freeze({ kind: "set", element: first });
        case "WeakSet": return first === undefined ? undefined : Object.freeze({ kind: "weak-set", element: first });
        case "Map": case "ReadonlyMap": return first === undefined || second === undefined ? undefined
          : Object.freeze({ kind: "map", key: first, value: second });
        case "WeakMap": return first === undefined || second === undefined ? undefined
          : Object.freeze({ kind: "weak-map", key: first, value: second });
        default: {
          if (!typedArrayNames.has(declared.name)) return undefined;
          const element = jsTypedArrayElementKinds[declared.name as keyof typeof jsTypedArrayElementKinds];
          return Object.freeze({ kind: "typed-array", element: Object.freeze({ kind: "primitive", primitive: element }) });
        }
      }
    })();
    collections.set(type, selected ?? null);
    return selected;
  };

  /** The call refusal of a JS profile member (Generator / AsyncGenerator `throw`, `Object.isFrozen`). */
  const callRefusal = (declaration: Node): { readonly code: string; readonly message: string } | undefined => {
    const declared = identity(declaration);
    return declared?.kind !== "member" || declared.declaringName === undefined || declared.name === undefined ? undefined
      : jsSourceApiEntry(declared.declaringName, declared.name)?.refusal;
  };

  const callStorage = (call: SourceCallSelection): SourceJsCallStorage | undefined => {
    const selected = operation(call.signature, "storage");
    if (selected === undefined) return undefined;
    const { entry, identity: declared } = selected;
    if (entry?.callables?.resumeReceiver === true && call.receiver !== undefined) {
      return Object.freeze({ declaration: declared.declaration, form: "receiver", effect: Object.freeze({ resumeReceiver: true }) });
    }
    const storage = entry?.storage;
    if (storage === undefined) return undefined;
    let effect: SourceJsCallStorage["effect"] | undefined;
    if (storage.kind === "allocation") {
      effect = Object.freeze({ resultAllocation: call.use });
    } else {
      const bindings = call.arguments.filter(binding => binding.parameterIndex === 0);
      const binding = bindings.length === 1 ? bindings[0] : undefined;
      if (binding?.form !== "value" || binding.mode !== "positional") return undefined;
      effect = Object.freeze({ resultAlias: binding.argument });
    }
    const form = selected.name === "constructor" || selected.name === "call" ? "value" as const : "member" as const;
    return Object.freeze({ declaration: declared.declaration, form, effect,
      binding: Object.freeze({ name: storage.binding, providerId: jsSourceSemanticsIdentity.providerId }) });
  };

  const callbackEffects = (call: SourceCallSelection): readonly SourceJsCallbackEffect[] | undefined =>
    operation(call.signature, "callbacks")?.entry?.callables?.entries;

  const invocationOnlyParameters = (declaration: Node): readonly number[] => {
    const declared = identity(declaration);
    return declared?.kind !== "member" || declared.declaringName === undefined || declared.name === undefined ? noParameters
      : jsSourceApiEntry(declared.declaringName, declared.name)?.callables?.invocationOnly ?? noParameters;
  };

  const nativeConstructorStorage = (declaration: Node): SourceJsNativeConstructorStorage | undefined => {
    const declared = scoped(declaration)?.identity;
    if (declared?.kind !== "construct" || declared.declaringName === undefined) return undefined;
    const storage = jsSourceApiEntry(declared.declaringName, "constructor")?.storage;
    return storage?.kind !== "allocation" || !storage.nativeConstructor ? undefined : Object.freeze({
      declaration: declared.declaration,
      binding: Object.freeze({ name: storage.binding, providerId: jsSourceSemanticsIdentity.providerId }),
    });
  };

  // Q86: one key category per present arm of a union key type, authored order; the categories are the Host's (input).
  const keyCategories = (type: SourceTypeDescriptor): readonly SourceKeyCategory[] | undefined => {
    const structure = sourceTypeDescriptorStructure(type);
    const union = structure.kind === "optional" ? sourceTypeDescriptorStructure(structure.value) : structure;
    if (union.kind !== "union") return undefined;
    return Object.freeze(input.presentArms(type).map((arm): SourceKeyCategory => {
      const category = input.typeofCategory(arm);
      return category === undefined || category === "function" ? "object" : category;
    }));
  };

  return Object.freeze({
    identity, collection, member, callRefusal, callStorage, callbackEffects, invocationOnlyParameters, nativeConstructorStorage,
    keyCategories,
  });
}
