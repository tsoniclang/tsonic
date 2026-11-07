// SourceJsApiFacts (D18): the JS profile's published Source facts, built once per program view by the Host program
// owner (createTargetSourceProgram's `profile` option). Declarations and descriptors only (I1).
import type { Node } from "@tsonic/tsts";
import type {
  SourceJsApiFacts, SourceJsApiFactsInput, SourceJsApiMember, SourceJsCollectionFacts, SourceTypeDescriptor,
} from "@tsonic/target-api/source";
import { jsTypedArrayElementKinds } from "../declarations/typed-arrays.js";
import { jsSourceApiIdentity, type JsSourceApiIdentity } from "./identity.js";
import { jsSourceApiConstructionMeaning, jsSourceApiMemberMeaning } from "./members.js";

const typedArrayNames: ReadonlySet<string> = new Set(Object.keys(jsTypedArrayElementKinds));

export function createJsSourceApiFacts(input: SourceJsApiFactsInput): SourceJsApiFacts {
  const identities = new WeakMap<Node, JsSourceApiIdentity | null>();
  const members = new WeakMap<Node, SourceJsApiMember | null>();
  const collections = new WeakMap<SourceTypeDescriptor, SourceJsCollectionFacts | null>();

  const identity = (declaration: Node): JsSourceApiIdentity | undefined => {
    const known = identities.get(declaration);
    if (known !== undefined) return known ?? undefined;
    const selected = jsSourceApiIdentity(input, declaration);
    identities.set(declaration, selected ?? null);
    return selected;
  };

  const member = (declaration: Node): SourceJsApiMember | undefined => {
    const known = members.get(declaration);
    if (known !== undefined) return known ?? undefined;
    const selectedIdentity = identity(declaration);
    const meaning = selectedIdentity === undefined || selectedIdentity.declaringName === undefined ? undefined
      : selectedIdentity.kind === "member" && selectedIdentity.name !== undefined
        ? jsSourceApiMemberMeaning(selectedIdentity.declaringName, selectedIdentity.name)
        : selectedIdentity.kind === "call" && selectedIdentity.declaringName === "Global" && selectedIdentity.name !== undefined
          ? jsSourceApiMemberMeaning("Global", selectedIdentity.name)
          : selectedIdentity.kind === "construct" || selectedIdentity.kind === "call"
            ? jsSourceApiConstructionMeaning(selectedIdentity.declaringName) : undefined;
    const selected = meaning === undefined || selectedIdentity === undefined ? undefined : Object.freeze({
      declaration,
      owner: meaning.owner,
      name: selectedIdentity.kind === "member" || selectedIdentity.declaringName === "Global"
        ? selectedIdentity.name ?? "" : "constructor",
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

  return Object.freeze({ collection, member });
}
