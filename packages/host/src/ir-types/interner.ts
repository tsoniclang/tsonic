import type { TypeInterner, TypeTerm, Signature, CreateTypeInterner, SeedTypeInterner, InternType, InternSignature,
  ReadType, ReadSignature, ExportTypes } from "./contract.js";
import type { TyId, SigId } from "../ids/contract.js";
import type { PublicationWork } from "./work.js";
import { readTypeData, readSignatureRow } from "./parse.js";
import { typeIdentifier, signatureIdentifier } from "./value.js";
import { immutableCopy, canonicalTypes, partitionTypes, normalizeType, orderedSignature, remapSignature } from "./canonical.js";
import { normalizePublication } from "./normalize.js";
import { typeText, signatureText } from "./print.js";

export interface InternerStorage extends TypeInterner {
  readonly terms: unknown[];
  readonly signatures: unknown[];
  readonly typeKeys: Map<unknown, unknown>;
  readonly signatureKeys: Map<unknown, unknown>;
  readonly substitutions: Map<string, Map<string, number>>;
}

function hasStorage(value: TypeInterner): value is InternerStorage {
  return "terms" in value && Array.isArray(value.terms)
    && "signatures" in value && Array.isArray(value.signatures)
    && "typeKeys" in value && value.typeKeys instanceof Map
    && "signatureKeys" in value && value.signatureKeys instanceof Map
    && "substitutions" in value && value.substitutions instanceof Map;
}

export function internerStorage(value: TypeInterner): InternerStorage {
  if (hasStorage(value)) return value;
  throw new Error("ir-types: the interner requires its private arena storage.");
}

export function storedType(storage: InternerStorage, type: TyId): TypeTerm {
  if (!Number.isSafeInteger(type) || type < 0 || Object.is(type, -0) || type >= storage.terms.length)
    throw new Error(`ir-types: type reference ${type} is outside this arena.`);
  const value = storage.terms[type];
  return readTypeData(value, null, "read", `ir-types: type row ${type} is not a complete TypeTerm.`).value;
}

export function storedSignature(storage: InternerStorage, signature: SigId): Signature {
  if (!Number.isSafeInteger(signature) || signature < 0 || Object.is(signature, -0) || signature >= storage.signatures.length)
    throw new Error(`ir-types: signature reference ${signature} is outside this arena.`);
  const value = storage.signatures[signature];
  const selected = readSignatureRow(value, null, "read", `ir-types: signature row ${signature} is not a complete Signature with its own ID.`).value;
  if (selected.id !== signature) throw new Error(`ir-types: signature row ${signature} is not a complete Signature with its own ID.`);
  return selected;
}

function publish(storage: InternerStorage, term: TypeTerm): TyId {
  const key = typeText(term);
  const previous = storage.typeKeys.get(key);
  if (previous !== undefined) {
    if (typeof previous === "number") return typeIdentifier(previous);
    throw new Error("ir-types: a type key must select a numeric type ID.");
  }
  const selected = typeIdentifier(storage.terms.length);
  storage.terms.push(immutableCopy(term));
  storage.typeKeys.set(key, selected);
  return selected;
}

export const createTypeInterner: CreateTypeInterner = () => {
  const value: InternerStorage = { identityKind: "type-interner", terms: [], signatures: [], typeKeys: new Map(), signatureKeys: new Map(), substitutions: new Map() };
  return Object.freeze(value);
};

export const seedTypeInterner: SeedTypeInterner = table => {
  const interner = createTypeInterner();
  const storage = internerStorage(interner);
  for (const [position, term] of table.terms.entries()) {
    const key = typeText(term);
    storage.terms.push(immutableCopy(term));
    if (!storage.typeKeys.has(key)) storage.typeKeys.set(key, typeIdentifier(position));
  }
  for (const [position, value] of table.signatures.entries()) {
    const key = signatureText(remapSignature(value, type => type, signature => signature));
    storage.signatures.push(immutableCopy(value));
    if (!storage.signatureKeys.has(key)) storage.signatureKeys.set(key, signatureIdentifier(position));
  }
  return interner;
};

export const internType: InternType = (interner, term) => {
  const storage = internerStorage(interner);
  return normalizeType(term, type => storedType(storage, type), value => publish(storage, value), null);
};

export const internSignature: InternSignature = (interner, input) => {
  const storage = internerStorage(interner);
  const normalized = orderedSignature(remapSignature(input, type => type, signature => signature));
  const key = signatureText(normalized);
  const previous = storage.signatureKeys.get(key);
  if (previous !== undefined) {
    if (typeof previous === "number") return signatureIdentifier(previous);
    throw new Error("ir-types: a signature key must select a numeric signature ID.");
  }
  const id = signatureIdentifier(storage.signatures.length);
  const value: Signature = { id, declaration: normalized.declaration, owner: normalized.owner, composition: normalized.composition,
    kind: normalized.kind, typeParameters: normalized.typeParameters, receiver: normalized.receiver, parameters: normalized.parameters, result: normalized.result };
  storage.signatures.push(immutableCopy(value));
  storage.signatureKeys.set(key, id);
  return id;
};

export const readType: ReadType = (interner, type) => storedType(internerStorage(interner), type);
export const readSignature: ReadSignature = (interner, signature) => storedSignature(internerStorage(interner), signature);

export const exportTypes: ExportTypes = (interner, limits) => {
  if (![limits.maximumWork, limits.maximumCreatedRecords].every(value => Number.isSafeInteger(value) && value >= 0))
    throw new TypeError("ir-types: publication maxima must be nonnegative safe integers.");
  const storage = internerStorage(interner);
  const work: PublicationWork = { ...limits, work: 0, createdRecords: 0 };
  const terms: TypeTerm[] = [];
  const signatures: Signature[] = [];
  for (const [position, row] of storage.terms.entries()) {
    const selected = readTypeData(row, work, "read", `ir-types: type row ${position} is not a complete TypeTerm.`);
    if (selected.kind === "resource-limit") return selected;
    terms.push(selected.value);
  }
  for (const [position, row] of storage.signatures.entries()) {
    const selected = readSignatureRow(row, work, "read", `ir-types: signature row ${position} is not a complete Signature with its own ID.`);
    if (selected.kind === "resource-limit") return selected;
    if (selected.value.id !== position) throw new Error(`ir-types: signature row ${position} is not a complete Signature with its own ID.`);
    signatures.push(selected.value);
  }
  const table = { terms, signatures };
  const partition = partitionTypes(table, work);
  if (partition.kind === "resource-limit") return partition;
  const normalized = normalizePublication(table, partition.value, work);
  if (normalized.kind === "resource-limit") return normalized;
  const publication = canonicalTypes(normalized.value, work);
  if (publication.kind === "resource-limit") return publication;
  return { ...publication, work: work.work, createdRecords: work.createdRecords };
};
