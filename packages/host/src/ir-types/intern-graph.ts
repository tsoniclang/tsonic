import type { InternTypeGraph, TypePublicationStop, TypeTerm, SignatureInput } from "./contract.js";
import type { TyId, SigId } from "../ids/contract.js";
import { TypeArena } from "./arena.js";
import { stageGraph } from "./graph-stage.js";
import { fixedTypeTerm, remapTerm, remapSignature } from "./canonical.js";
import { copyType, copySignature } from "./copy.js";
import { readTypeData, readSignatureData } from "./publication-read.js";
import { chargeWork, chargeCreated, workLimit, createdLimit } from "./work.js";
import { signatureIdentifier, required } from "./value.js";
import { typeText } from "./print.js";

export const internTypeGraph: InternTypeGraph = (deps, input) => {
  const { work, types } = deps;
  if (!chargeWork(work, 1)) return workLimit(work);
  if (!chargeWork(work, 4)) return workLimit(work);
  const { typeBase, signatureBase, terms, signatures } = input;
  if (!Number.isSafeInteger(typeBase) || Object.is(typeBase, -0) || typeBase !== TypeArena.terms(types).length
    || !Number.isSafeInteger(signatureBase) || Object.is(signatureBase, -0) || signatureBase !== TypeArena.signatures(types).length)
    throw new TypeError("ir-types: a graph input must retain the actual arena snapshot bases.");
  if (!chargeWork(work, 2)) return workLimit(work);
  const typeCount = terms.length;
  const signatureCount = signatures.length;
  if (!Number.isSafeInteger(typeCount) || typeCount < 0 || !Number.isSafeInteger(signatureCount) || signatureCount < 0
    || !Number.isSafeInteger(typeBase + typeCount) || !Number.isSafeInteger(signatureBase + signatureCount))
    throw new TypeError("ir-types: a graph input must have finite safe reference domains.");
  if (!chargeWork(work, 4 + typeCount + signatureCount)) return workLimit(work);
  if (!chargeCreated(work, 2 + typeCount + signatureCount)) return createdLimit(work);
  const mappedTypes: TyId[] = new Array(typeCount);
  const mappedSignatures: SigId[] = new Array(signatureCount);
  const typeRows = new Map<number, TypeTerm>();
  const signatureRows = new Map<number, SignatureInput>();
  const typeOf = (type: TyId): TyId => {
    if (!Number.isSafeInteger(type) || type < 0 || Object.is(type, -0) || type >= typeBase + typeCount)
      throw new TypeError("ir-types: a graph type reference is outside its snapshot and input domain.");
    return type;
  };
  const signatureOf = (signature: SigId): SigId => {
    if (!Number.isSafeInteger(signature) || signature < 0 || Object.is(signature, -0) || signature >= signatureBase + signatureCount)
      throw new TypeError("ir-types: a graph signature reference is outside its snapshot and input domain.");
    return signature;
  };
  for (let position = 0; position < typeCount; position++) {
    if (!chargeWork(work, 1)) return workLimit(work);
    const value = terms[position];
    if (value === undefined) throw new TypeError("ir-types: a graph type vector must be dense.");
    const admitted = readTypeData(value, work, "retain", true);
    if (admitted.kind === "resource-limit") return admitted;
    const row = copyType(remapTerm(admitted.value, typeOf, signatureOf));
    if (typeCount === 1 && signatureCount === 0 && fixedTypeTerm(row)) {
      if (!chargeWork(work, 2)) return workLimit(work);
      const previous = TypeArena.typeKeys(types).get(typeText(row));
      if (previous !== undefined) {
        mappedTypes[position] = previous;
        return { kind: "complete", value: { types: mappedTypes, signatures: mappedSignatures } };
      }
    }
    typeRows.set(typeBase + position, row);
  }
  for (let position = 0; position < signatureCount; position++) {
    if (!chargeWork(work, 1)) return workLimit(work);
    const value = signatures[position];
    if (value === undefined) throw new TypeError("ir-types: a graph signature vector must be dense.");
    const admitted = readSignatureData(value, work, "retain");
    if (admitted.kind === "resource-limit") return admitted;
    signatureRows.set(signatureBase + position, remapSignature(copySignature({ id: signatureIdentifier(signatureBase + position),
      ...admitted.value }), typeOf, signatureOf));
  }
  const grow = (count: number): TypePublicationStop | null => chargeWork(work, count) ? null : workLimit(work);
  const staged = stageGraph(types, typeRows, signatureRows, {
    phase: "construction",
    step: (count = 1) => grow(count),
    growth: grow,
    type: value => {
      const admitted = readTypeData(value, work, "retain");
      return admitted.kind === "resource-limit" ? admitted : null;
    },
    signature: value => {
      const admitted = readSignatureData(value, work, "retain");
      return admitted.kind === "resource-limit" ? admitted : null;
    },
    beforeMember: null,
  });
  if (staged.kind === "resource-limit") return staged;
  for (let position = 0; position < typeCount; position++) mappedTypes[position] = required(staged.value.types, typeBase + position);
  for (let position = 0; position < signatureCount; position++) mappedSignatures[position] = required(staged.value.signatures, signatureBase + position);
  return { kind: "complete", value: { types: mappedTypes, signatures: mappedSignatures } };
};
