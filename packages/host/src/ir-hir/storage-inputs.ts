import type { BodyId, LocalId, LocalRef } from "../ids/contract.js";
import type { PassingMode, Signature } from "../ir-types/contract.js";
import type { CheckedPhase, CollectInferredStorageSources, Expression, InferredStorageCandidate } from "./contract.js";
import { writableRootStorageOf } from "./storage.js";
import { unparenthesizedExpression } from "./walk.js";

interface StorageDraft {
  readonly candidate: InferredStorageCandidate;
  readonly incoming: Set<LocalId>;
  writes: number;
  open: boolean;
}

function inputLocal(expression: Expression<CheckedPhase>, candidate: InferredStorageCandidate): LocalId | null {
  const input = unparenthesizedExpression<CheckedPhase>(expression);
  if (input.kind !== "Identifier" || input.tsonic.role !== "value" || input.tsonic.resolution.kind !== "local"
    || input.tsonic.resolution.local.body !== candidate.local.body || input.tsonic.value.views.read.kind !== "available"
    || input.tsonic.value.views.read.value !== candidate.type) return null;
  return input.tsonic.resolution.local.local;
}

function canReplace(mode: PassingMode | undefined): boolean {
  return mode !== "by-value" && mode !== "byref-readonly" && mode !== "borrow-shared";
}

export const collectInferredStorageSources: CollectInferredStorageSources = (candidates, nodes, nodeCount, bodies, signatureOf, admit) => {
  if (candidates.length === 0) return [];
  const byBody = new Map<BodyId, Map<LocalId, StorageDraft>>();
  const drafts: StorageDraft[] = [];
  const draftOf = (local: LocalRef): StorageDraft | undefined => byBody.get(local.body)?.get(local.local);
  for (let index = 0; index < candidates.length; index += 1) {
    if (!admit(1)) return null;
    const candidate = candidates[index];
    if (candidate === undefined) throw new TypeError("Inferred storage candidates must be dense.");
    const initial = inputLocal(candidate.initializer, candidate);
    const draft: StorageDraft = { candidate, incoming: new Set(), writes: 0,
      open: initial === null || initial >= candidate.local.local };
    if (initial !== null) draft.incoming.add(initial);
    const locals = byBody.get(candidate.local.body) ?? new Map<LocalId, StorageDraft>();
    if (locals.has(candidate.local.local)) throw new TypeError("An inferred storage candidate must name one local slot.");
    locals.set(candidate.local.local, draft);
    byBody.set(candidate.local.body, locals);
    drafts.push(draft);
  }
  for (let index = 0; index < bodies.length; index += 1) {
    if (!admit(1)) return null;
    const body = bodies[index];
    if (body === undefined) throw new TypeError("Inferred storage bodies must be dense.");
    for (let position = 0; position < body.captures.length; position += 1) {
      if (!admit(1)) return null;
      const capture = body.captures[position];
      if (capture === undefined) throw new TypeError("Inferred storage captures must be dense.");
      const draft = draftOf(capture);
      if (draft !== undefined) draft.open = true;
    }
  }
  const cursor = nodes[Symbol.iterator]();
  for (let index = 0; index < nodeCount; index += 1) {
    if (!admit(1)) return null;
    const next = cursor.next();
    if (next.done) throw new TypeError("Inferred storage requires its complete owned syntax inventory.");
    const node = next.value;
    if (node.kind === "Identifier" && node.tsonic.role === "assignment-target" && node.tsonic.resolution.kind === "local") {
      const draft = draftOf(node.tsonic.resolution.local);
      if (draft !== undefined) draft.writes += 1;
    } else if (node.kind === "BinaryExpression" && node.operatorToken.kind === "EqualsToken") {
      const target = unparenthesizedExpression<CheckedPhase>(node.left);
      if (target.kind !== "Identifier" || target.tsonic.role !== "assignment-target" || target.tsonic.resolution.kind !== "local") continue;
      const draft = draftOf(target.tsonic.resolution.local);
      if (draft === undefined || draft.open) continue;
      if (writableRootStorageOf(target.tsonic.place, target.tsonic.resolution) !== draft.candidate.type) {
        draft.open = true;
        continue;
      }
      const source = inputLocal(node.right, draft.candidate);
      if (source === null) draft.open = true;
      else {
        draft.incoming.add(source);
        draft.writes -= 1;
      }
    } else if (node.kind === "CallExpression" || node.kind === "NewExpression") {
      const args = node.arguments?.nodes ?? [];
      let spread = false;
      let signature: Signature | null | undefined;
      for (let position = 0; position < args.length; position += 1) {
        if (!admit(1)) return null;
        const argument = args[position];
        if (argument === undefined) throw new TypeError("Inferred storage arguments must be dense.");
        const value = unparenthesizedExpression<CheckedPhase>(argument);
        if (value.kind === "SpreadElement") {
          spread = true;
          continue;
        }
        if (value.kind !== "Identifier" || value.tsonic.role !== "value" || value.tsonic.resolution.kind !== "local") continue;
        const draft = draftOf(value.tsonic.resolution.local);
        if (draft === undefined || draft.open) continue;
        if (signature === undefined) {
          if (!admit(1)) return null;
          const application = node.tsonic.application;
          const selected = application.kind === "available" ? application.value.resolvedSignature : null;
          signature = selected?.kind === "available" && selected.value !== null ? signatureOf(selected.value) : null;
        }
        const tail = signature?.parameters.at(-1);
        const parameter = signature?.parameters[position] ?? (tail?.kind === "rest" ? tail : undefined);
        if (spread || canReplace(parameter?.passing)) draft.open = true;
      }
    }
  }
  const result: (readonly LocalId[] | null)[] = [];
  for (const { open, writes, incoming } of drafts) {
    if (open || writes !== 0) result.push(null);
    else {
      if (!admit(incoming.size * (1 + Math.ceil(Math.log2(incoming.size + 1))))) return null;
      result.push([...incoming].sort((left, right) => left - right));
    }
  }
  return result;
};
