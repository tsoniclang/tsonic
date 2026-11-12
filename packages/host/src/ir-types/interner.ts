import type { TypeInterner, TypeTerm, Signature, CreateTypeInterner, SeedTypeInterner, InternType, InternSignature,
  ReadType, ReadSignature, ExportTypes } from "./contract.js";
import type { TyId, SigId } from "../ids/contract.js";
import type { PublicationWork } from "./work.js";
import { readTypeData, readSignatureRow } from "./publication-read.js";
import { TypeArena } from "./arena.js";
import { typeIdentifier, signatureIdentifier } from "./value.js";
import { canonicalTypes, partitionTypes, normalizeType, orderedSignature, remapSignature } from "./canonical.js";
import { copyType, copySignature } from "./copy.js";
import { normalizePublication } from "./normalize.js";
import { typeText, signatureText } from "./print.js";

export function storedType(storage: TypeInterner, type: TyId): TypeTerm {
  if (!Number.isSafeInteger(type) || type < 0 || Object.is(type, -0))
    throw new Error(`ir-types: type reference ${type} is outside this arena.`);
  const value = TypeArena.terms(storage)[type];
  if (value === undefined) throw new Error(`ir-types: type reference ${type} is outside this arena.`);
  return value;
}

export function storedSignature(storage: TypeInterner, signature: SigId): Signature {
  if (!Number.isSafeInteger(signature) || signature < 0 || Object.is(signature, -0))
    throw new Error(`ir-types: signature reference ${signature} is outside this arena.`);
  const value = TypeArena.signatures(storage)[signature];
  if (value === undefined) throw new Error(`ir-types: signature reference ${signature} is outside this arena.`);
  const selected = value;
  if (selected.id !== signature) throw new Error(`ir-types: signature row ${signature} is not a complete Signature with its own ID.`);
  return selected;
}

function publish(storage: TypeInterner, term: TypeTerm): TyId {
  const key = typeText(term);
  const previous = TypeArena.typeKeys(storage).get(key);
  if (previous !== undefined) {
    return previous;
  }
  const selected = typeIdentifier(TypeArena.terms(storage).length);
  TypeArena.terms(storage).push(copyType(term));
  TypeArena.typeKeys(storage).set(key, selected);
  return selected;
}

export const createTypeInterner: CreateTypeInterner = () => TypeArena.create();

export const seedTypeInterner: SeedTypeInterner = table => {
  const interner = createTypeInterner();
  const storage = interner;
  for (const [position, term] of table.terms.entries()) {
    const key = typeText(term);
    TypeArena.terms(storage).push(copyType(term));
    if (!TypeArena.typeKeys(storage).has(key)) TypeArena.typeKeys(storage).set(key, typeIdentifier(position));
  }
  for (const [position, value] of table.signatures.entries()) {
    const key = signatureText(remapSignature(value, type => type, signature => signature));
    TypeArena.signatures(storage).push(copySignature(value));
    if (!TypeArena.signatureKeys(storage).has(key)) TypeArena.signatureKeys(storage).set(key, signatureIdentifier(position));
  }
  return interner;
};

export const internType: InternType = (interner, term) => {
  const storage = interner;
  return normalizeType(term, type => storedType(storage, type), value => publish(storage, value), null);
};

export const internSignature: InternSignature = (interner, input) => {
  const storage = interner;
  const normalized = orderedSignature(remapSignature(input, type => type, signature => signature));
  const key = signatureText(normalized);
  const previous = TypeArena.signatureKeys(storage).get(key);
  if (previous !== undefined) {
    return previous;
  }
  const id = signatureIdentifier(TypeArena.signatures(storage).length);
  const value: Signature = { id, declaration: normalized.declaration, owner: normalized.owner, composition: normalized.composition,
    kind: normalized.kind, typeParameters: normalized.typeParameters, receiver: normalized.receiver, parameters: normalized.parameters, result: normalized.result };
  TypeArena.signatures(storage).push(copySignature(value));
  TypeArena.signatureKeys(storage).set(key, id);
  return id;
};

export const readType: ReadType = (interner, type) => storedType(interner, type);
export const readSignature: ReadSignature = (interner, signature) => storedSignature(interner, signature);

export const exportTypes: ExportTypes = (interner, limits) => {
  if (![limits.maximumWork, limits.maximumCreatedRecords].every(value => Number.isSafeInteger(value) && value >= 0))
    throw new TypeError("ir-types: publication maxima must be nonnegative safe integers.");
  const storage = interner;
  const work: PublicationWork = { ...limits, work: 0, createdRecords: 0 };
  const terms: TypeTerm[] = [];
  const signatures: Signature[] = [];
  for (const row of TypeArena.terms(storage)) {
    const selected = readTypeData(row, work, "read");
    if (selected.kind === "resource-limit") return selected;
    terms.push(selected.value);
  }
  for (const [position, row] of TypeArena.signatures(storage).entries()) {
    const selected = readSignatureRow(row, work, "read");
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
