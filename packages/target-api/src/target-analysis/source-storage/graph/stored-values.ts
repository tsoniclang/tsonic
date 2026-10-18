import type { AstReader, Node } from "@tsonic/tsts";
import { sourceBindingWriteAtReference } from "../../../source-navigation/references-usage.js";
import { sourceClassFieldHasStorage, sourceParameterIsProperty } from "../../../source-navigation/class-members.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageWriteOccurrence, SourceStorageWrittenValue } from "../model/types.js";
import type { SourceBindingWriteValue } from "../../../source-navigation/types.js";

export interface SourceStorageWrite {
  readonly reference: Node;
  readonly operation: Node;
  readonly kind: "initialization" | "mutation";
  readonly value?: SourceStorageSubject;
  readonly values: readonly SourceStorageWrittenValue[];
  readonly reason?: string;
}

export interface SourceStorageStore extends SourceStorageWrite {
  readonly storage: SourceStorageSubject;
  readonly region: Node;
  readonly receiver?: SourceStorageSubject;
  readonly destination: "binding" | "member" | "element";
}

export function createSourceStorageStoredValues(
  ast: AstReader,
  budget: SourceStorageBudget,
  regionFor: (node: Node) => Node | undefined,
  receiverFor: (node: Node) => SourceStorageSubject | undefined,
) {
  const locations = new Map<SourceStorageSubject, Map<Node, SourceStorageStore>>();
  const regions = new Map<Node, Set<SourceStorageStore>>();
  const occurrences = new Map<Node, {
    readonly store: SourceStorageStore;
    readonly destinations: Set<SourceStorageSubject>;
    published: SourceStorageWriteOccurrence | undefined;
  }>();
  const rows = budget.createRows();
  let published = false;
  const record = (storage: SourceStorageSubject | undefined, write: SourceStorageWrite): void => {
    const kind = write.kind;
    if (storage === undefined || storage.kind !== "value" && storage.kind !== "member" || !budget.step()) return;
    if (published) throw new Error("Source store occurrences cannot change after their final publication.");
    let selected = locations.get(storage);
    if (kind === "initialization") {
      const declaration = storage.node;
      if (storage.projection.length !== 0) return;
      if (ast.getSourceFile(declaration)?.IsDeclarationFile) return;
      if (!ast.is.IsVariableDeclaration(declaration) && !ast.is.IsBindingElement(declaration) && !sourceClassFieldHasStorage(ast, declaration) &&
        !ast.is.IsPropertyAssignment(declaration) && !ast.is.IsShorthandPropertyAssignment(declaration) &&
        !sourceParameterIsProperty(ast, declaration)) return;
      let lexical: Node | undefined = ast.is.IsVariableDeclaration(declaration) ? ast.parent(declaration) : declaration;
      if (lexical !== undefined && ast.is.IsVariableDeclarationList(lexical)) lexical = ast.parent(lexical);
      for (let owner: Node | undefined = lexical; owner !== undefined && !ast.is.IsSourceFile(owner); owner = ast.parent(owner)) {
        if (!budget.step()) return;
        if (ast.hasModifierKind(owner, "ambient")) return;
      }
    }
    const previous = occurrences.get(write.reference);
    if (previous !== undefined) {
      if (previous.store.storage !== storage || previous.store.operation !== write.operation || previous.store.kind !== kind ||
        previous.store.value !== write.value || previous.store.reason !== write.reason || previous.store.values.length !== write.values.length ||
        previous.store.values.some((value, index) => {
          const selected = write.values[index]!;
          return value.reason !== selected.reason || value.subjects.length !== selected.subjects.length ||
            value.subjects.some((subject, position) => subject !== selected.subjects[position]) ||
            value.source?.kind !== selected.source?.kind || value.source?.expression !== selected.source?.expression ||
            value.source?.projection.length !== selected.source?.projection.length ||
            value.source?.projection.some((part, position) => part !== selected.source?.projection[position]);
        }))
        budget.reject("Source storage stores require one exact checked occurrence owner.");
      return;
    }
    const region = regionFor(write.reference);
    if (region === undefined) {
      budget.reject("Source storage stores require their exact checked execution region.");
      return;
    }
    const receiver = kind === "mutation" ? receiverFor(write.reference) : undefined;
    if (budget.failure() !== undefined) return;
    const regional = regions.get(region);
    const declarationName = kind === "initialization" ? ast.name(storage.node) : undefined;
    const alias = declarationName !== undefined && ast.is.IsIdentifier(declarationName) && declarationName !== write.reference
      ? declarationName : undefined;
    if (!rows.add(6 + write.values.reduce((total, value) => total + 1 + value.subjects.length, 0) +
      (selected === undefined ? 1 : 0) + (regional === undefined ? 1 : 0) + (alias === undefined ? 0 : 1))) return;
    const destination = kind === "initialization"
      ? ast.is.IsVariableDeclaration(storage.node) || ast.is.IsBindingElement(storage.node) ? "binding" : "member"
      : receiver === undefined ? "binding" : storage.projection.length === 0 ? "member" : "element";
    const store = Object.freeze({ ...write, storage, region, receiver, kind, destination });
    selected ??= new Map<Node, SourceStorageStore>();
    const retained = regional ?? new Set<SourceStorageStore>();
    retained.add(store);
    regions.set(region, retained);
    selected.set(write.reference, store);
    locations.set(storage, selected);
    const occurrence = { store, destinations: new Set([storage]), published: undefined };
    occurrences.set(write.reference, occurrence);
    if (alias !== undefined) occurrences.set(alias, occurrence);
  };
  const writeFor = (reference: Node, valueFor: (input: SourceBindingWriteValue) => readonly SourceStorageSubject[] | undefined,
    aggregate: (values: readonly SourceStorageSubject[]) => SourceStorageSubject | undefined): SourceStorageWrite | undefined => {
    const write = sourceBindingWriteAtReference(ast, reference);
    if (write === undefined) return undefined;
    const declaration = ast.parent(reference);
    const initialization = write.kind === "initialization" || write.kind === "iteration" && declaration !== undefined &&
      ast.name(declaration) === reference && (ast.is.IsVariableDeclaration(declaration) || ast.is.IsBindingElement(declaration));
    const values = write.values.map(source => {
      const subjects = valueFor(source);
      return Object.freeze({ source, subjects: Object.freeze([...(subjects ?? [])]), reason: subjects === undefined
        ? "Source storage writes require their exact checked original value producer, iteration element and component projection." : undefined });
    });
    return Object.freeze({ reference, operation: write.operation,
      kind: initialization ? "initialization" : "mutation",
      value: aggregate(values.flatMap(value => value.subjects)), values: Object.freeze(values),
      reason: values.find(value => value.reason !== undefined)?.reason });
  };
  const recordWrite = (storage: SourceStorageSubject | undefined, write: ReturnType<typeof writeFor>): void => {
    if (write !== undefined) record(storage, write);
  };
  const storesFor = (storage: SourceStorageSubject): Iterable<SourceStorageStore> | undefined => locations.get(storage)?.values();
  const physicalStoresFor = (storage: SourceStorageSubject): Iterable<SourceStorageStore> | undefined => {
    const stores = locations.get(storage);
    if (stores === undefined) return undefined;
    let destination: SourceStorageStore["destination"] | undefined = storage.kind === "value" && storage.projection.length === 0 &&
      (ast.is.IsVariableDeclaration(storage.node) || ast.is.IsBindingElement(storage.node)) ? "binding" : undefined;
    for (const store of stores.values()) {
      if (!budget.step()) return undefined;
      if (destination !== undefined) break;
      if (store.kind === "initialization" && store.storage === storage) { destination = store.destination; break; }
    }
    if (destination === undefined) return undefined;
    return { *[Symbol.iterator]() {
      for (const store of stores.values()) {
        if (!budget.step()) return;
        if (store.destination === destination) yield store;
      }
    } };
  };
  const inputsFor = (storage: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined => {
    const stores = physicalStoresFor(storage);
    if (stores === undefined) return undefined;
    return { *[Symbol.iterator]() {
      for (const store of stores) if (store.value !== undefined) yield store.value;
    } };
  };
  return Object.freeze({
    initialize(storage: SourceStorageSubject | undefined, occurrence: Node, value?: SourceStorageSubject): void {
      const source: SourceBindingWriteValue | undefined = value === undefined || value.kind === "input" ? undefined
        : Object.freeze({ kind: "value", expression: occurrence, projection: Object.freeze([]) });
      if (storage !== undefined) record(storage, { reference: occurrence, operation: storage.node, value, kind: "initialization",
        values: Object.freeze(value === undefined ? [] : [Object.freeze({ source, subjects: Object.freeze([value]), reason: undefined })]) });
    },
    recordWrite, writeFor, storesFor, inputsFor,
    bind(storage: SourceStorageSubject | undefined, occurrence: Node): void {
      if (storage === undefined || !budget.step()) return;
      if (published) throw new Error("Source store destinations cannot change after their final publication.");
      const selectedOccurrence = occurrences.get(occurrence);
      if (selectedOccurrence === undefined) {
        budget.reject("Source storage physical locations require their original checked store occurrence.");
        return;
      }
      const selected = locations.get(storage);
      if (selected?.has(occurrence)) return;
      if (!rows.add(selected === undefined ? 3 : 2)) return;
      const retained = selected ?? new Map<Node, SourceStorageStore>();
      retained.set(occurrence, selectedOccurrence.store);
      locations.set(storage, retained);
      selectedOccurrence.destinations.add(storage);
    },
    publish(): void {
      if (published) throw new Error("Source store occurrences publish exactly once.");
      let cost = 0;
      for (const [reference, occurrence] of occurrences) {
        if (!budget.step()) { published = true; return; }
        if (reference !== occurrence.store.reference) continue;
        cost += 1 + occurrence.destinations.size;
      }
      if (cost > 0 && !rows.add(cost)) { published = true; return; }
      for (const [reference, occurrence] of occurrences) {
        if (reference !== occurrence.store.reference) continue;
        const store = occurrence.store;
        occurrence.published = Object.freeze({ reference: store.reference, operation: store.operation, region: store.region,
          kind: store.kind, destination: store.destination, receiver: store.receiver, value: store.value, values: store.values, reason: store.reason,
          destinations: Object.freeze([...occurrence.destinations]) });
      }
      published = true;
    },
    writeAt(reference: Node): SourceStorageWriteOccurrence | undefined {
      if (!published) throw new Error("Source store occurrence lookup requires completed publication.");
      return budget.failure() === undefined ? occurrences.get(reference)?.published : undefined;
    },
    storesIn: (region: Node): Iterable<SourceStorageStore> | undefined => regions.get(region)?.values(),
    unresolvedFor(storage: SourceStorageSubject): string | undefined {
      for (const store of physicalStoresFor(storage) ?? []) {
        if (!budget.step()) return budget.failure();
        if (store.reason !== undefined) return store.reason;
      }
      return undefined;
    },
  });
}
