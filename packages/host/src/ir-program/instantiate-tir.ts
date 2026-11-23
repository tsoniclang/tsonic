import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { TirBody } from "../ir-tir/contract.js";
import type { ArtifactBindings } from "../ir-types/contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { ProjectionInventory } from "./program-values.js";
import type { InstantiationStop } from "./work.js";
import {
  drainProjectionInventory, inventoryFields, inventoryRecord, inventorySignature, inventoryType,
  prepareBindingsProjection, prepareEvidenceProjection, prepareProjectionRows,
} from "./program-values.js";

export interface AdmittedTirSyntax {
  readonly root: TirBody["root"];
  readonly params: TirBody["params"][number][];
}

export interface PreparedTirBody {
  readonly roots: AdmittedTirSyntax;
  readonly project: (rewrite: TypeReferenceRewrite, root: TirBody["root"], params: TirBody["params"], bindings: ArtifactBindings) => TirBody;
}

const missingParameter: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "TIR must retain its actual dense formal inventory." };

export function inventoryTirBody(scan: ProjectionInventory, value: TirBody):
  { readonly kind: "complete"; readonly value: PreparedTirBody } | InstantiationStop {
  const header = inventoryRecord(scan, 18);
  if (header !== null) return header;
  const params: AdmittedTirSyntax["params"] = [];
  scan.pending.push(() => {
    const original = value.params;
    const length = original.length;
    for (let index = 0; index < length; index += 1) {
      const stop = inventoryFields(scan, 1);
      if (stop !== null) return stop;
      params.push(requirePresent(original[index], missingParameter));
    }
    return null;
  });
  const locals = prepareProjectionRows(scan, value.locals, read => {
    const localHeader = inventoryRecord(scan, 7);
    if (localHeader !== null) return { kind: "refused", stop: localHeader };
    const local = read();
    const storage = local.storage;
    const stop = inventoryType(scan, storage);
    if (stop !== null) return { kind: "refused", stop };
    const { id, declaration, name, role, capturedFrom, mutable } = local;
    return { kind: "copied", value: rewrite => ({ id, declaration, name, role, capturedFrom, mutable, storage: rewrite.type(storage) }) };
  });
  const evidence = prepareProjectionRows(scan, value.evidence, read => prepareEvidenceProjection(scan, read));
  const lexical = prepareBindingsProjection(scan, value.lexicalBindings);
  if (lexical.kind === "refused") return lexical.stop;
  const signature = value.signature;
  const signatureStop = inventorySignature(scan, signature);
  if (signatureStop !== null) return signatureStop;
  const completion = value.completion;
  const completionStop = inventoryType(scan, completion);
  if (completionStop !== null) return completionStop;
  const yielded = value.yielded;
  const yieldedStop = inventoryType(scan, yielded);
  if (yieldedStop !== null) return yieldedStop;
  const sent = value.sent;
  const stop = inventoryType(scan, sent) ?? drainProjectionInventory(scan);
  if (stop !== null) return stop;
  const { root, body, owner, dependence, nestedBodies, captures, scopes, asynchronous, generator } = value;
  return { kind: "complete", value: {
    roots: { root, params },
    project: (rewrite, root, params, bindings) => ({
      root, params, bindings, body, owner, dependence, nestedBodies, captures, scopes, asynchronous, generator,
      lexicalBindings: lexical.value(rewrite), signature: rewrite.signature(signature), completion: rewrite.type(completion),
      yielded: yielded === null ? null : rewrite.type(yielded), sent: sent === null ? null : rewrite.type(sent),
      locals: locals(rewrite), evidence: evidence(rewrite),
    }),
  } };
}
