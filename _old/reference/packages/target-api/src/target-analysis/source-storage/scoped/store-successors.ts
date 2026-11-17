import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../../../source-model/storage.js";
import type { SourceStorageActivation, SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageVariable } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageSymbolicMemberAlias } from "./member-selection.js";
import type { SourceStorageChildContext, SourceStoragePendingReduction } from "./child-reduction.js";

interface SourceStorageStoreSuccessorContext {
  readonly budget: SourceStorageBudget;
  readonly transport: SourceStorageScopedTransport;
  readonly absent: Extract<SourceStorageReduction, { readonly kind: "replace" }>;
  birth(subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageActivation | undefined;
  symbolicInput(subject: SourceStorageSubject, scope: SourceStorageScope): boolean;
  replaceChild(child: SourceStorageTerm, replace: (child: SourceStorageTerm) => SourceStorageTerm,
    context?: SourceStorageChildContext): SourceStoragePendingReduction | undefined;
}

export function createSourceStorageStoreSuccessors(context: SourceStorageStoreSuccessorContext) {
  const { budget, transport, absent, birth, symbolicInput, replaceChild } = context;
  return (term: Extract<SourceStorageTerm, { readonly kind: "store" }>): SourceStoragePendingReduction | undefined => {
    if ((term.destination.kind === "leaf" || term.destination.kind === "input-frontier") &&
      (term.receiver.kind === "leaf" || term.receiver.kind === "input-frontier")) {
      const frontier = term.destination.kind === "input-frontier" ? term.destination
        : term.receiver.kind === "input-frontier" ? Object.freeze({ ...term.receiver, subject: term.destination.subject,
          scope: term.destination.scope, preservesInput: false }) : undefined;
      if (frontier !== undefined) {
        const sameLocation = term.destination.subject === term.receiver.subject && term.destination.scope === term.receiver.scope;
        const sameInput = term.destination.kind === "input-frontier" && term.receiver.kind === "input-frontier" &&
          term.destination.input.subject === term.receiver.input.subject && term.destination.input.scope === term.receiver.input.scope;
        return term.destination.kind === "leaf" && !sameLocation && !sameInput ? absent : { kind: "replace", terms: sameLocation || sameInput ? [frontier, term.value] : [frontier] };
      }
    }
    if (term.destination.kind !== "leaf") return replaceChild(term.destination, destination =>
      destination === term.destination ? term : Object.freeze({ ...term, destination }), { contributes: false });
    if (term.receiver.kind !== "leaf") return replaceChild(term.receiver, receiver =>
      receiver === term.receiver ? term : Object.freeze({ ...term, receiver }));
    if (term.receiver.subject !== term.destination.subject) return sourceStorageSymbolicMemberAlias(transport, symbolicInput,
      term.receiver, term.destination) ? { kind: "replace", terms: [term.value] } : absent;
    const receiver = birth(term.receiver.subject, term.receiver.scope);
    const destination = birth(term.destination.subject, term.destination.scope);
    if (receiver === undefined || destination === undefined) return undefined;
    return budget.withRows((rows): SourceStorageReduction | undefined => {
      const pending: (readonly [SourceStorageActivation, SourceStorageActivation])[] = [[receiver, destination]];
      const visited = new Map<SourceStorageActivation, Set<SourceStorageActivation>>();
      let expansion: SourceStorageVariable | undefined;
      while (pending.length !== 0) {
        if (!budget.step()) return undefined;
        const [receiver, destination] = pending.pop()!;
        if (receiver.key === destination.key || visited.get(receiver)?.has(destination)) continue;
        if (!rows.add(2)) return undefined;
        const targets = visited.get(receiver) ?? new Set<SourceStorageActivation>();
        targets.add(destination);
        visited.set(receiver, targets);
        if (receiver.variable !== undefined || destination.variable !== undefined) {
          for (const variable of [receiver.variable, destination.variable]) {
            if (variable !== undefined && (expansion === undefined ||
              expansion.capture !== undefined && variable.capture === undefined)) expansion = variable;
          }
          continue;
        }
        if (receiver.invocation !== destination.invocation || receiver.owner !== destination.owner ||
          receiver.nativeEntry !== destination.nativeEntry) return absent;
        if (receiver.invocation !== undefined && destination.invocation !== undefined)
          pending.push([receiver.parent, destination.parent]);
        if (receiver.creation.length !== destination.creation.length) return absent;
        for (const [index, creation] of receiver.creation.entries()) {
          if (!budget.step() || !rows.add(1)) return undefined;
          pending.push([creation, destination.creation[index]!]);
        }
      }
      return expansion === undefined ? { kind: "replace", terms: [term.value] } : { kind: "expand", variable: expansion };
    });
  };
}
