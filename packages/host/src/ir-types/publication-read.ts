import type { TypeTerm, Signature, SignatureInput } from "./data.js";
import type { TypePublicationWork, PublicationResult } from "./work.js";
import { chargeWork, chargeCreated, workLimit, createdLimit } from "./work.js";
import type { PublicationArray, PublicationNode, PublicationValue } from "./publication-fields.js";
import { isPublicationArray, publicationArrayElement, publicationReferences, publicationShape, publicationWork } from "./publication-fields.js";

type Phase = "read" | "emit" | "retain";
type Task = PublicationValue | { readonly kind: "array"; readonly value: PublicationArray; readonly position: number };

function readPublication<Value>(value: Value, root: PublicationValue, budget: TypePublicationWork,
  phase: Phase): PublicationResult<Value> {
  if (!chargeWork(budget, 1)) return workLimit(budget);
  if (phase === "retain" && !chargeCreated(budget, 1)) return createdLimit(budget);
  const tasks: Task[] = [root];
  const push = (value: PublicationNode): void => {
    if (isPublicationArray(value)) tasks.push({ kind: "array", value, position: 0 });
    else tasks.push(value);
  };
  for (;;) {
    let task = tasks.pop();
    if (task === undefined) return { kind: "complete", value };
    let prepaid = false;
    if (task.kind === "array") {
      if (task.position >= task.value.value.length) continue;
      const reference = task.value.kind === "type-id-array" || task.value.kind === "signature-id-array";
      const work = reference ? Number(phase !== "read") : Number(task.value.kind !== "definition-id-array");
      if (!chargeWork(budget, work)) return workLimit(budget);
      if (reference && phase === "retain" && !chargeCreated(budget, 1)) return createdLimit(budget);
      tasks.push({ ...task, position: task.position + 1 });
      task = publicationArrayElement(task.value, task.position);
      prepaid = true;
    }
    if (task.kind === "scalar") continue;
    if (!prepaid && !chargeWork(budget, 1)) return workLimit(budget);
    if (!chargeWork(budget, publicationWork(task) - 1 + Number(task.kind === "selector")))
      return workLimit(budget);
    const references = publicationReferences(task);
    if (phase !== "read" && !chargeWork(budget, references)) return workLimit(budget);
    if (phase === "retain" && !chargeCreated(budget, references)) return createdLimit(budget);
    const shape = publicationShape(task);
    for (const child of shape.children) push(child);
  }
}

export const readTypeData = (value: TypeTerm, budget: TypePublicationWork, phase: Phase): PublicationResult<TypeTerm> =>
  readPublication(value, { kind: "type", value }, budget, phase);

export const readSignatureData = (value: SignatureInput, budget: TypePublicationWork, phase: Phase): PublicationResult<SignatureInput> =>
  readPublication(value, { kind: "signature-input", value }, budget, phase);

export const readSignatureRow = (value: Signature, budget: TypePublicationWork, phase: Phase): PublicationResult<Signature> =>
  readPublication(value, { kind: "signature", value }, budget, phase);
