// The JS API meaning table (D18, R2 #6): one table, keyed by the JS API identity `declaringName.name` (`constructor`
// for a construct signature, `call` for an unnamed call signature). Every JS API fact the profile publishes reads one
// entry of it: the member meaning, the callback facet, the storage facet and the call refusal. The row modules supply
// data only; a row whose key has no other facet still gets its entry, so the facets of one identity cannot drift apart.
import { jsSourceApiMeaningRows, type JsSourceApiMemberMeaning } from "./members.js";
import { jsSourceCallableEffectRows, jsSourceCallRefusalRows, type JsSourceCallableEffects }
  from "../identities/callable-effects.js";
import { jsSourceStorageRows, type JsSourceStorageOperation } from "../identities/storage-effects.js";

export interface JsSourceApiEntry {
  /** The member meaning (published as facts.profile.member). */
  readonly meaning?: JsSourceApiMemberMeaning;
  /** Callback parameters; undefined = the operation has no callback classification. */
  readonly callables?: JsSourceCallableEffects;
  readonly storage?: JsSourceStorageOperation;
  readonly refusal?: { readonly code: string; readonly message: string };
}

type Facets = { -readonly [Key in keyof JsSourceApiEntry]: JsSourceApiEntry[Key] };

const entries = new Map<string, Facets>();

function facet<Key extends keyof Facets>(key: string, name: Key, value: NonNullable<Facets[Key]>): void {
  const entry = entries.get(key) ?? {};
  if (entry[name] !== undefined) throw new Error(`The JS API entry '${key}' has more than one ${name} row.`);
  entry[name] = value;
  entries.set(key, entry);
}

const nested = <T>(rows: Readonly<Record<string, Readonly<Record<string, T>>>>, add: (key: string, value: T) => void): void => {
  for (const [declaringName, members] of Object.entries(rows)) {
    for (const [name, value] of Object.entries(members)) add(`${declaringName}.${name}`, value);
  }
};

for (const [key, meaning] of jsSourceApiMeaningRows) facet(key, "meaning", meaning);
nested(jsSourceCallableEffectRows, (key, value) => facet(key, "callables", value));
nested(jsSourceStorageRows, (key, value) => facet(key, "storage", value));
nested(jsSourceCallRefusalRows, (key, value) => facet(key, "refusal", value));

const table: ReadonlyMap<string, JsSourceApiEntry> = new Map([...entries].map(([key, entry]) => [key, Object.freeze(entry)]));

/** The table entry of a JS API identity (`name`: member name, `constructor` or `call`). */
export function jsSourceApiEntry(declaringName: string, name: string): JsSourceApiEntry | undefined {
  return table.get(`${declaringName}.${name}`);
}
