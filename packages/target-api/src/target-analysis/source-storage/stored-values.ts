import type { AstReader, Node } from "@tsonic/tsts";
import { sourceBindingWriteAtReference } from "../../source-navigation/references-usage.js";
import { sourceClassFieldHasStorage, sourceParameterIsProperty } from "../../source-navigation/class-members.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";

export interface SourceStorageWrite {
  readonly reference: Node;
  readonly operation: Node;
  readonly value?: SourceStorageSubject;
  readonly reason?: string;
}

export interface SourceStorageStore extends SourceStorageWrite {
  readonly storage: SourceStorageSubject;
  readonly region: Node;
  readonly receiver?: SourceStorageSubject;
  readonly kind: "initialization" | "mutation";
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
  const occurrences = new Map<Node, SourceStorageStore>();
  const rows = budget.createRows();
  const record = (storage: SourceStorageSubject | undefined, write: SourceStorageWrite,
    kind: SourceStorageStore["kind"]): void => {
    if (storage === undefined || storage.kind !== "value" || !budget.step()) return;
    let selected = locations.get(storage);
    if (kind === "initialization") {
      const declaration = storage.node;
      if (storage.projection.length !== 0) return;
      if (ast.getSourceFile(declaration)?.IsDeclarationFile) return;
      if (!ast.is.IsVariableDeclaration(declaration) && !sourceClassFieldHasStorage(ast, declaration) &&
        !ast.is.IsPropertyAssignment(declaration) && !ast.is.IsShorthandPropertyAssignment(declaration) &&
        !sourceParameterIsProperty(ast, declaration)) return;
      for (let owner: Node | undefined = declaration; owner !== undefined && budget.step(); owner = ast.parent(owner)) {
        if (ast.hasModifierKind(owner, "ambient")) return;
        if (ast.is.IsSourceFile(owner)) break;
      }
    }
    const previous = occurrences.get(write.reference);
    if (previous !== undefined) {
      if (previous.storage !== storage || previous.operation !== write.operation || previous.kind !== kind)
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
    if (!rows.add(4 + (selected === undefined ? 1 : 0) + (regional === undefined ? 1 : 0))) return;
    const destination = kind === "initialization"
      ? ast.is.IsVariableDeclaration(storage.node) ? "binding" : "member"
      : receiver === undefined ? "binding" : storage.projection.length === 0 ? "member" : "element";
    const store = Object.freeze({ ...write, storage, region, receiver, kind, destination });
    selected ??= new Map<Node, SourceStorageStore>();
    const retained = regional ?? new Set<SourceStorageStore>();
    retained.add(store);
    regions.set(region, retained);
    selected.set(write.reference, store);
    locations.set(storage, selected);
    occurrences.set(write.reference, store);
  };
  const writeFor = (reference: Node, subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined): SourceStorageWrite | undefined => {
    const write = sourceBindingWriteAtReference(ast, reference);
    if (write === undefined) return undefined;
    const owner = { reference, operation: write.operation };
    if (write.kind === "update") return { ...owner, value: subjectFor(write.operation) };
    if (write.kind !== "assignment") return { ...owner, reason: "Source storage iteration writes require their exact selected element producer." };
    if (!ast.is.IsBinaryExpression(write.operation)) return { ...owner, reason: "Source storage assignment writes require their exact binary producer." };
    const binary = ast.as.AsBinaryExpression(write.operation);
    if (binary === undefined || subjectFor(binary.Left) !== subjectFor(reference))
      return { ...owner, reason: "Source storage destructuring writes require their exact selected component producer." };
    const operator = ast.operatorKindName(write.operation);
    return { ...owner, value: subjectFor(operator === "KindEqualsToken" || operator === "KindBarBarEqualsToken" ||
      operator === "KindAmpersandAmpersandEqualsToken" || operator === "KindQuestionQuestionEqualsToken"
      ? binary.Right : write.operation) };
  };
  const recordWrite = (storage: SourceStorageSubject | undefined, write: ReturnType<typeof writeFor>): void => {
    if (write !== undefined) record(storage, write, "mutation");
  };
  const storesFor = (storage: SourceStorageSubject): Iterable<SourceStorageStore> | undefined => locations.get(storage)?.values();
  const physicalStoresFor = (storage: SourceStorageSubject): Iterable<SourceStorageStore> | undefined => {
    const stores = locations.get(storage);
    if (stores === undefined) return undefined;
    let destination: SourceStorageStore["destination"] | undefined;
    for (const store of stores.values()) {
      if (!budget.step()) return undefined;
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
      if (storage !== undefined) record(storage, { reference: occurrence, operation: storage.node, value }, "initialization");
    },
    recordWrite, writeFor, storesFor, inputsFor,
    bind(storage: SourceStorageSubject | undefined, occurrence: Node): void {
      if (storage === undefined || !budget.step()) return;
      const store = occurrences.get(occurrence);
      if (store === undefined) {
        budget.reject("Source storage physical locations require their original checked store occurrence.");
        return;
      }
      const selected = locations.get(storage);
      if (selected?.has(occurrence)) return;
      if (!rows.add(selected === undefined ? 2 : 1)) return;
      const retained = selected ?? new Map<Node, SourceStorageStore>();
      retained.set(occurrence, store);
      locations.set(storage, retained);
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
