import type { TypeTerm, Signature, SignatureInput } from "./data.js";
import type { PublicationWork, PublicationResult } from "./work.js";
import { chargeWork, workLimit } from "./work.js";
import type { PublicationArray, PublicationNode, PublicationValue } from "./publication-fields.js";
import { isPublicationArray, publicationArrayElement, publicationShape } from "./publication-fields.js";

type Phase = "read" | "emit";
type Task = PublicationValue | { readonly kind: "array"; readonly value: PublicationArray; readonly position: number };

function readPublication<Value>(value: Value, root: PublicationValue, budget: PublicationWork,
  phase: Phase): PublicationResult<Value> {
  if (!chargeWork(budget, 1)) return workLimit(budget);
  const tasks: Task[] = [root];
  const push = (value: PublicationNode): void => {
    if (isPublicationArray(value)) tasks.push({ kind: "array", value, position: 0 });
    else tasks.push(value);
  };
  for (;;) {
    const task = tasks.pop();
    if (task === undefined) return { kind: "complete", value };
    if (task.kind === "array") {
      if (task.position < task.value.value.length) {
        tasks.push({ ...task, position: task.position + 1 });
        tasks.push(publicationArrayElement(task.value, task.position));
      }
      continue;
    }
    if (task.kind === "scalar") continue;
    if (task.kind === "reference") {
      if (phase === "emit" && !chargeWork(budget, 1)) return workLimit(budget);
      continue;
    }
    const shape = publicationShape(task);
    if (!chargeWork(budget, shape.work + (phase === "emit" ? shape.references : 0) + (task.kind === "selector" ? 1 : 0)))
      return workLimit(budget);
    for (const child of shape.children) push(child);
  }
}

export const readTypeData = (value: TypeTerm, budget: PublicationWork, phase: Phase): PublicationResult<TypeTerm> =>
  readPublication(value, { kind: "type", value }, budget, phase);

export const readSignatureData = (value: SignatureInput, budget: PublicationWork, phase: Phase): PublicationResult<SignatureInput> =>
  readPublication(value, { kind: "signature-input", value }, budget, phase);

export const readSignatureRow = (value: Signature, budget: PublicationWork, phase: Phase): PublicationResult<Signature> =>
  readPublication(value, { kind: "signature", value }, budget, phase);
