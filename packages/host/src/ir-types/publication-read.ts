import type { TypeTerm, Signature, SignatureInput } from "./data.js";
import type { LimitStop, TypePublicationWork, PublicationResult } from "./work.js";
import { chargeWork, chargeCreated, workLimit, createdLimit } from "./work.js";
import type { PublicationArray, PublicationNode, PublicationRecord, PublicationValue } from "./publication-fields.js";
import { isPublicationArray, publicationArrayElement, publicationReferences, publicationScalarField, publicationShape, publicationWork } from "./publication-fields.js";

type Phase = "read" | "emit" | "retain";
interface InlinePath { readonly parent: InlinePath | null; readonly part: string }
type Task = (PublicationValue | { readonly kind: "array"; readonly value: PublicationArray; readonly position: number })
  & { readonly path?: InlinePath }
  | { readonly kind: "leave"; readonly value: object };

type CountAdmission<Stop> = (count: number) => Stop | null;
type Malformed = { readonly kind: "malformed"; readonly field: string; readonly cycle?: true };
const borrowed = (): null => null;

function fieldPath(path: InlinePath, field = ""): string {
  const parts: string[] = [];
  for (let selected: InlinePath | null = path; selected !== null; selected = selected.parent) parts.push(selected.part);
  return "$" + parts.reverse().join("") + field;
}

function malformedField(path: InlinePath | undefined, field: string): Malformed {
  return { kind: "malformed", field: path === undefined ? field : fieldPath(path, "." + field) };
}

function shapeOrInvariant<Value extends { readonly kind: "complete" } | LimitStop>(value: Value | Malformed): Value {
  if (value.kind === "malformed")
    throw new TypeError(value.cycle === true ? "Inline cycle at " + value.field
      : "ir-types: a graph input contains an invalid field " + value.field);
  return value;
}

function readPublication<Value, Stop extends LimitStop>(value: Value, root: PublicationValue, work: CountAdmission<Stop>,
  retain: CountAdmission<Stop>, phase: Phase, trackPath: boolean):
  { readonly kind: "complete"; readonly value: Value } | Stop | Malformed {
  const start = work(1) ?? (phase === "retain" ? retain(1) : null);
  if (start !== null) return start;
  const tasks: Task[] = [root];
  const onPath = trackPath ? new Set<object>() : null;
  const push = (value: PublicationNode, parent: InlinePath | null): void => {
    const array = isPublicationArray(value);
    const next: Task = array ? { kind: "array", value, position: 0 } : value;
    const field = array ? value.field : value.kind === "scalar" ? value.kind : value.field ?? value.kind;
    tasks.push(onPath === null ? next : { ...next, path: { parent, part: "." + field } });
  };
  for (;;) {
    let task = tasks.pop();
    if (task === undefined) return { kind: "complete", value };
    if (task.kind === "leave") { onPath?.delete(task.value); continue; }
    let prepaid = false;
    if (task.kind === "array") {
      if (!Array.isArray(task.value.value)) return { kind: "malformed", field: task.value.field };
      if (task.position >= task.value.value.length) continue;
      const reference = task.value.kind === "type-id-array" || task.value.kind === "signature-id-array";
      const rowWork = reference ? Number(phase !== "read") : Number(task.value.kind !== "definition-id-array");
      const stop = work(rowWork) ?? (reference && phase === "retain" ? retain(1) : null);
      if (stop !== null) return stop;
      tasks.push({ ...task, position: task.position + 1 });
      const row = publicationArrayElement(task.value, task.position);
      if (row === undefined) return { kind: "malformed", field: task.value.field + "[" + task.position + "]" };
      task = onPath === null ? row : { ...row, path: { parent: task.path ?? null, part: "[" + task.position + "]" } };
      prepaid = true;
    }
    if (task.kind === "scalar") continue;
    const base = prepaid ? null : work(1);
    if (base !== null) return base;
    if (typeof task.value !== "object" || task.value === null) return { kind: "malformed", field: task.kind };
    if (onPath !== null) {
      if (onPath.has(task.value) && task.path !== undefined)
        return { kind: "malformed", field: fieldPath(task.path), cycle: true };
      onPath.add(task.value);
      tasks.push({ kind: "leave", value: task.value });
    }
    const size = publicationWork(task);
    if (size === undefined) return malformedField(task.path, "kind");
    const record = work(size - 1 + Number(task.kind === "selector"));
    if (record !== null) return record;
    const malformed = publicationScalarField(task);
    if (malformed !== null) return malformedField(task.path, malformed);
    const references = publicationReferences(task);
    const recordReferences = (phase !== "read" ? work(references) : null) ?? (phase === "retain" ? retain(references) : null);
    if (recordReferences !== null) return recordReferences;
    const shape = publicationShape(task);
    if (shape === undefined) return malformedField(task.path, "kind");
    for (const child of shape.children) push(child, task.path ?? null);
  }
}

export const readTypeData = (value: TypeTerm, budget: TypePublicationWork, phase: Phase, external = false): PublicationResult<TypeTerm> =>
  shapeOrInvariant(readPublication(value, { kind: "type", value }, count => chargeWork(budget, count) ? null : workLimit(budget),
    count => chargeCreated(budget, count) ? null : createdLimit(budget), phase,
    external && value.kind === "projection" && value.projection?.kind === "component"));

export const readSignatureData = (value: SignatureInput, budget: TypePublicationWork, phase: Phase): PublicationResult<SignatureInput> =>
  shapeOrInvariant(readPublication(value, { kind: "signature-input", value }, count => chargeWork(budget, count) ? null : workLimit(budget),
    count => chargeCreated(budget, count) ? null : createdLimit(budget), phase, false));

export const readSignatureRow = (value: Signature, budget: TypePublicationWork): PublicationResult<Signature> =>
  shapeOrInvariant(readPublication(value, { kind: "signature", value }, count => chargeWork(budget, count) ? null : workLimit(budget),
    borrowed, "read", false));

export function admitGraphType<Stop extends LimitStop>(value: TypeTerm, work: CountAdmission<Stop>,
  retain: CountAdmission<Stop>): Stop | null {
  const result = shapeOrInvariant(readPublication(value, { kind: "type", value }, work, retain, "retain", false));
  return result.kind === "complete" ? null : result;
}

export function admitGraphSignature<Stop extends LimitStop>(value: SignatureInput, work: CountAdmission<Stop>,
  retain: CountAdmission<Stop>): Stop | null {
  const result = shapeOrInvariant(readPublication(value, { kind: "signature-input", value }, work, retain, "retain", false));
  return result.kind === "complete" ? null : result;
}

export function readStagedGraph<Stop extends LimitStop>(work: CountAdmission<Stop>): {
  readonly type: (value: TypeTerm) => Stop | null;
  readonly signature: (value: SignatureInput) => Stop | null;
} {
  return { type: value => admitGraphType(value, work, borrowed), signature: value => admitGraphSignature(value, work, borrowed) };
}

export function admitForeignRow<Stop extends LimitStop>(row: Extract<PublicationRecord, { readonly kind: "type" | "signature" }>,
  work: CountAdmission<Stop>, retain: CountAdmission<Stop>): Stop | Malformed | null {
  const result = readPublication(row.value, row, work, retain, "retain", true);
  return result.kind === "complete" ? null : result;
}
