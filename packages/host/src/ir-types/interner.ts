import type { TypeInterner, TypeTerm, Signature, CreateTypeInterner, AdmitTypeTable, InternType,
  ReadType, ReadSignature, ViewTypes, ExportTypes, TypeRule, TypeTableAdmissionSite } from "./contract.js";
import type { Violation } from "../diag/contract.js";
import type { TyId, SigId } from "../ids/contract.js";
import { createTypePublicationWork, usedPublicationWork, usedPublicationRecords } from "./work.js";
import { admitForeignRow, admitGraphSignature, admitGraphType, readTypeData, readSignatureRow } from "./publication-read.js";
import { TypeArena } from "./arena.js";
import { typeIdentifier, signatureIdentifier } from "./value.js";
import { canonicalTypes, fixedTypeTerm, remapSignature } from "./canonical.js";
import { copyType, copySignature } from "./copy.js";
import { typeText, signatureText } from "./print.js";
import { stageGraph } from "./graph-stage.js";
import { verifyTypeRows } from "./verify.js";

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
  TypeArena.addCandidate(storage, "type:" + key, { kind: "type", identity: selected });
  return selected;
}

export const createTypeInterner: CreateTypeInterner = () => TypeArena.create();

export const admitTypeTable: AdmitTypeTable = (table, admission) => {
  const setup = admission.work(5) ?? admission.retain(5);
  if (setup !== null) return setup;
  const invalid = (site: TypeTableAdmissionSite, rule: TypeRule, field: string): {
    readonly kind: "invalid"; readonly violations: readonly Violation<TypeRule, TypeTableAdmissionSite>[];
  } => ({ kind: "invalid", violations: [{ rule, site, detail: [{ kind: "text", value: field }] }] });
  const typeRows = table.terms;
  if (!Array.isArray(typeRows)) return invalid({ kind: "table" }, "type-reference", "terms");
  const signatureRows = table.signatures;
  if (!Array.isArray(signatureRows)) return invalid({ kind: "table" }, "signature-reference", "signatures");
  const storage = createTypeInterner();
  const terms = new Map<number, TypeTerm>();
  const signatures = new Map<number, Signature>();
  const ownedTerms: TypeTerm[] = [];
  const ownedSignatures: Signature[] = [];
  for (let position = 0; position < typeRows.length; position++) {
    const before = admission.work(1);
    if (before !== null) return before;
    const row = typeRows[position];
    if (row === undefined) return invalid({ kind: "type", type: typeIdentifier(position) }, "type-reference", "terms");
    const selected = admitForeignRow({ kind: "type", value: row }, admission.work, admission.retain);
    if (selected?.kind === "malformed") return invalid({ kind: "type", type: typeIdentifier(position) }, "type-reference", selected.field);
    if (selected !== null) return selected;
    const owned = copyType(row);
    terms.set(position, owned);
    ownedTerms.push(owned);
  }
  for (let position = 0; position < signatureRows.length; position++) {
    const before = admission.work(1);
    if (before !== null) return before;
    const row = signatureRows[position];
    if (row === undefined || row === null || !Object.is(row.id, position))
      return invalid({ kind: "signature", signature: signatureIdentifier(position) }, "signature-order", "id");
    const selected = admitForeignRow({ kind: "signature", value: row }, admission.work, admission.retain);
    if (selected?.kind === "malformed")
      return invalid({ kind: "signature", signature: signatureIdentifier(position) }, "signature-reference", selected.field);
    if (selected !== null) return selected;
    const owned = copySignature(row);
    signatures.set(position, owned);
    ownedSignatures.push(owned);
  }
  for (const row of ownedTerms) {
    const work = admitGraphType(row, admission.work, () => null);
    if (work !== null) return work;
  }
  for (const row of ownedSignatures) {
    const work = admitGraphSignature(row, admission.work, () => null);
    if (work !== null) return work;
  }
  const violations = verifyTypeRows({ terms: ownedTerms, signatures: ownedSignatures }, null);
  if (violations.length !== 0) return { kind: "invalid", violations };
  const result = stageGraph(storage, terms, signatures, {
    phase: "construction",
    step: (count = 1) => admission.work(count),
    growth: count => admission.work(count) ?? admission.retain(count),
    type: value => admitGraphType(value, admission.work, admission.retain),
    signature: value => admitGraphSignature(value, admission.work, admission.retain),
    beforeMember: null,
  });
  if (result.kind !== "complete") return result;
  for (const [position, row] of terms) {
    const work = admission.work(1) ?? admitGraphType(row, admission.work, admission.retain);
    if (work !== null) return work;
    if (result.value.types.get(position) !== position || TypeArena.typeKeys(storage).get(typeText(row)) !== position)
      return invalid({ kind: "type", type: typeIdentifier(position) }, "canonical-representative", "terms");
  }
  for (const [position, row] of signatures) {
    const work = admission.work(1) ?? admitGraphSignature(row, admission.work, admission.retain);
    if (work !== null) return work;
    if (result.value.signatures.get(position) !== position
      || TypeArena.signatureKeys(storage).get(signatureText(remapSignature(row, type => type, signature => signature))) !== position)
      return invalid({ kind: "signature", signature: signatureIdentifier(position) }, "canonical-representative", "signatures");
  }
  return { kind: "complete", types: storage };
};

export const internType: InternType = (interner, term) => {
  if (!fixedTypeTerm(term)) throw new TypeError("ir-types: a nonleaf type requires one paid closed graph admission.");
  return publish(interner, term);
};

export const readType: ReadType = (interner, type) => storedType(interner, type);
export const readSignature: ReadSignature = (interner, signature) => storedSignature(interner, signature);
export const viewTypes: ViewTypes = interner => TypeArena.view(interner);

export const exportTypes: ExportTypes = (interner, limits) => {
  const storage = interner;
  const work = createTypePublicationWork(limits);
  const terms: TypeTerm[] = [];
  const signatures: Signature[] = [];
  for (const row of TypeArena.terms(storage)) {
    const selected = readTypeData(row, work, "read");
    if (selected.kind === "resource-limit") return selected;
    terms.push(selected.value);
  }
  for (const [position, row] of TypeArena.signatures(storage).entries()) {
    const selected = readSignatureRow(row, work);
    if (selected.kind === "resource-limit") return selected;
    if (selected.value.id !== position) throw new Error(`ir-types: signature row ${position} is not a complete Signature with its own ID.`);
    signatures.push(selected.value);
  }
  const table = { terms, signatures };
  const publication = canonicalTypes({ table, types: terms.map((_, position) => typeIdentifier(position)),
    signatures: signatures.map((_, position) => signatureIdentifier(position)) }, work);
  if (publication.kind === "resource-limit") return publication;
  return { ...publication, work: usedPublicationWork(work), createdRecords: usedPublicationRecords(work) };
};
