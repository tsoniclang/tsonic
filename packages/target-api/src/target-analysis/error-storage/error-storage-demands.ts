import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import type { SourceStorageClosedOriginsSelection, SourceStorageQueries, SourceStorageSubjectSelection } from "../source-storage/model/types.js";
import { Node_Expression } from "../../source-navigation/index.js";
import { createSourceErrorInvalidationQuery } from "./error-invalidation.js";
import type { SourceErrorStorageProtocol } from "./protocol.js";

export type SourceErrorStorageDemand =
  | { readonly kind: "immutable" }
  | { readonly kind: "writable"; readonly writes: readonly Node[] }
  | { readonly kind: "unresolved"; readonly reason: string };

export interface SourceErrorStorageOrigin {
  readonly node: Node;
  readonly type: Type;
}

export interface SourceErrorStorageDemandQueries {
  readonly retainedBoundaries: readonly Node[];
  readonly nativeConstructors: readonly SourceStorageSubject[];
  readonly fieldWrites: readonly Node[];
  storageFor(subject: SourceStorageSubject): SourceErrorStorageDemand;
  isNativeConstructor(subject: Node): boolean;
  receivesWritableNative(subject: SourceStorageSubject): boolean;
  storageOriginsFor(subject: SourceStorageSubject): { readonly kind: "resolved"; readonly origins: readonly SourceErrorStorageOrigin[] }
    | { readonly kind: "unresolved"; readonly reason: string };
  closedStorageOriginsFor(subject: SourceStorageSubject): SourceStorageClosedOriginsSelection;
  invalidationFor(owner: Node, expression: Node, pureInvocations: ReadonlySet<Node>):
    { readonly kind: "preserved" | "invalidated" } | { readonly kind: "unresolved" | "unproven"; readonly reason: string };
}

const immutableDemand: SourceErrorStorageDemand = Object.freeze({ kind: "immutable" });
const maximumDemandRows = 1_048_576;
const maximumDemandSteps = 4_194_304;

export function createSourceErrorStorageDemandQuery(
  source: TargetSourceProgram,
  protocol: SourceErrorStorageProtocol,
  storage: SourceStorageQueries,
): SourceErrorStorageDemandQueries {
  const { ast, semantics } = source;
  const fields = new Set(protocol.fields);
  const constructors = new Set(protocol.constructors);
  const stackCaptures = new Set(protocol.stackCaptures);
  const capturedStackTargets = new Map<Node, SourceStorageSubject>();
  const writes = new Map<SourceStorageSubject, Map<Node, SourceStorageSubject>>();
  const unresolvedWrites = new Map<SourceStorageSubject, string>();
  const nativeSubjects = new Set<SourceStorageSubject>();
  const noBoundaries: readonly SourceStorageSubject[] = Object.freeze([]);
  const retainedBoundaries: Node[] = [];
  const fieldWrites: Node[] = [];
  let demandRows = 0;
  let steps = 0;
  let failure = storage.source === source ? storage.failureReason()
    : "Error storage demand requires the exact shared source transport owner.";
  const failureReason = (): string | undefined => failure ?? storage.failureReason();
  const reject = (reason: string): void => { failure ??= reason; };
  const step = (): boolean => {
    if (++steps > maximumDemandSteps) reject("Error storage demand exceeds its finite analysis-work budget.");
    return failureReason() === undefined;
  };
  const reserveRow = (label: string): boolean => {
    if (++demandRows > maximumDemandRows) reject(`Error storage demand exceeds its finite ${label} budget.`);
    return failureReason() === undefined;
  };
  const selectedSubject = (selection: SourceStorageSubjectSelection): SourceStorageSubject | undefined => {
    if (selection.kind === "resolved") return selection.subject;
    reject(selection.reason);
    return undefined;
  };
  const subjectFor = (node: Node | undefined): SourceStorageSubject | undefined =>
    node === undefined ? undefined : selectedSubject(storage.subjectFor(node));
  const storageMutators = new Map<Node, Set<number>>();
  let mutatorRows = 0;
  for (const mutator of protocol.storageMutators) {
    const file = ast.getSourceFile(mutator.signature);
    const indexes = storageMutators.get(mutator.signature) ?? new Set<number>();
    if (++mutatorRows > maximumDemandRows || file === undefined || !semantics.includes(file) ||
      !Number.isSafeInteger(mutator.sourceParameterIndex) || mutator.sourceParameterIndex < 0 || indexes.has(mutator.sourceParameterIndex)) {
      reject("An Error storage mutator requires a unique exact checked signature and finite selected parameter index.");
      break;
    }
    const parameterNode = ast.parameters(mutator.signature)[mutator.sourceParameterIndex];
    const parameter = parameterNode === undefined || !ast.is.IsParameterDeclaration(parameterNode)
      ? undefined : ast.as.AsParameterDeclaration(parameterNode);
    if (parameter === undefined || parameter.DotDotDotToken !== undefined) {
      reject("An Error storage mutator requires an exact scalar signature parameter.");
      break;
    }
    indexes.add(mutator.sourceParameterIndex);
    storageMutators.set(mutator.signature, indexes);
  }
  const recordStorageWrite = (subject: SourceStorageSubject, write: Node, receiver: SourceStorageSubject): void => {
    const selected = writes.get(subject) ?? new Map<Node, SourceStorageSubject>();
    if (selected.has(write) || !reserveRow("selected-write")) return;
    selected.set(write, receiver);
    writes.set(subject, selected);
  };
  const recordWrite = (subject: SourceStorageSubject | undefined, write: Node): void => {
    if (subject === undefined) { reject("An admitted Error write has no exact source storage subject."); return; }
    recordStorageWrite(subject, write, subject);
    const selected = storage.boundValueFrontierFor(subject, storage.emptyBindings, noBoundaries);
    if (selected.kind === "unresolved") {
      if (storage.failureReason() !== undefined) reject(storage.failureReason()!);
      else unresolvedWrites.set(subject, selected.reason);
      return;
    }
    for (const origin of selected.frontier) {
      if (!step()) break;
      recordStorageWrite(origin.subject, write, subject);
    }
  };
  for (const node of storage.nodes) {
    if (!step()) break;
    if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node) || ast.is.IsPropertyAccessExpression(node)) {
      const retention = protocol.retention(node);
      if (retention.kind === "unresolved") { reject(retention.reason); break; }
      if (retention.kind === "retained") retainedBoundaries.push(node);
    }
    if (ast.is.IsPropertyAccessExpression(node)) {
      const selected = semantics.forNode(node).operations.propertyAccess(node);
      const declaration = selected?.selectedWriteDeclaration ?? selected?.selectedDeclaration;
      if (selected !== undefined && selected.accessMode !== "read" && declaration !== undefined && fields.has(declaration)) {
        fieldWrites.push(node);
        recordWrite(subjectFor(selected.receiver.expression), node);
      }
    }
    if (!ast.is.IsCallExpression(node) && !ast.is.IsNewExpression(node)) continue;
    const selected = semantics.forNode(node).operations.call(node);
    const signature = selected === undefined ? undefined : semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
    if (selected === undefined || signature === undefined) continue;
    if (stackCaptures.has(signature) && selected.sourceArguments.length === 1) {
      const owner = subjectFor(selected.sourceArguments[0]!.expression);
      if (owner !== undefined) capturedStackTargets.set(node, owner);
    }
    for (const index of storageMutators.get(signature) ?? []) {
      const bindings = selected.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === index);
      const binding = bindings.length === 1 ? bindings[0] : undefined;
      const value = binding?.sourceForm === "value" && binding.sourceParameterForm === "parameter"
        ? selected.sourceArguments[binding.sourceArgumentIndex] : undefined;
      if (value === undefined) { reject("An Error storage mutation requires its exact selected scalar argument transport."); break; }
      recordWrite(subjectFor(value.expression), node);
    }
    if (constructors.has(signature) && ast.kindName(Node_Expression(ast, node)) !== "KindSuperKeyword") {
      const subject = selectedSubject(storage.subject(node));
      if (subject !== undefined) nativeSubjects.add(subject);
    }
  }
  const selections = new Map<SourceStorageSubject, SourceErrorStorageDemand>();
  const storageFor: SourceErrorStorageDemandQueries["storageFor"] = subject => {
    const failure = failureReason();
    if (failure !== undefined) return Object.freeze({ kind: "unresolved", reason: failure });
    if (unresolvedWrites.size !== 0) {
      const ancestors = storage.ancestorsFor(subject);
      if (ancestors.kind === "unresolved") return ancestors;
      for (const ancestor of ancestors.subjects) {
        const reason = unresolvedWrites.get(ancestor);
        if (reason !== undefined) return Object.freeze({ kind: "unresolved", reason });
      }
    }
    const cached = selections.get(subject);
    if (cached !== undefined) return cached;
    const frontier = storage.boundValueFrontierFor(subject, storage.emptyBindings, noBoundaries);
    if (frontier.kind === "unresolved") return Object.freeze({ kind: "unresolved", reason: frontier.reason });
    const selectedWrites = new Map(writes.get(subject));
    for (const origin of frontier.frontier) {
      if (!step()) return Object.freeze({ kind: "unresolved", reason: failureReason()! });
      const reason = unresolvedWrites.get(origin.subject);
      if (reason !== undefined) return Object.freeze({ kind: "unresolved", reason });
      for (const [write, receiver] of writes.get(origin.subject) ?? []) {
        if (!step()) return Object.freeze({ kind: "unresolved", reason: failureReason()! });
        if (selectedWrites.has(write)) continue;
        if (!reserveRow("physical-write-selection")) return Object.freeze({ kind: "unresolved", reason: failureReason()! });
        selectedWrites.set(write, receiver);
      }
    }
    const boundaries = Object.freeze([subject]);
    const physicalComponent = subject.projection.length !== 0;
    const demandedWrites: Node[] = [];
    for (const [write, receiver] of selectedWrites) {
      if (!step()) return Object.freeze({ kind: "unresolved", reason: failureReason()! });
      if (physicalComponent || receiver === subject) {
        demandedWrites.push(write);
        continue;
      }
      const selected = storage.boundValueFrontierFor(receiver, storage.emptyBindings, boundaries);
      if (selected.kind === "unresolved") return selected;
      for (const current of selected.frontier) {
        if (!step()) return Object.freeze({ kind: "unresolved", reason: failureReason()! });
        if (current.kind === "boundary" && current.subject === subject) {
          demandedWrites.push(write);
          break;
        }
      }
    }
    const demand = demandedWrites.length === 0 ? immutableDemand
      : Object.freeze({ kind: "writable" as const, writes: Object.freeze(demandedWrites) });
    selections.set(subject, demand);
    return demand;
  };
  const receivesWritableNative: SourceErrorStorageDemandQueries["receivesWritableNative"] = subject => {
    if (storageFor(subject).kind === "unresolved") return false;
    const ancestors = storage.ancestorsFor(subject);
    return ancestors.kind === "resolved" && ancestors.subjects.some(subject => nativeSubjects.has(subject) &&
      storageFor(subject).kind === "writable");
  };
  const storageOriginsFor: SourceErrorStorageDemandQueries["storageOriginsFor"] = subject => {
    const failure = failureReason();
    if (failure !== undefined) return Object.freeze({ kind: "unresolved", reason: failure });
    const origins = storage.originsFor(subject);
    return origins.kind === "unresolved" ? origins : Object.freeze({ kind: "resolved", origins: Object.freeze(origins.origins
      .map(origin => Object.freeze({ node: origin.subject.node, type: origin.type }))) });
  };
  const closedStorageOriginsFor: SourceErrorStorageDemandQueries["closedStorageOriginsFor"] = subject => {
    const failure = failureReason();
    if (failure !== undefined) return Object.freeze({ kind: "unresolved", reason: failure });
    return storage.closedOriginsFor(subject);
  };
  const invalidationFor = createSourceErrorInvalidationQuery(source, storage, storageFor, nativeSubjects, capturedStackTargets,
    step, failureReason);
  return Object.freeze({ retainedBoundaries: Object.freeze(retainedBoundaries), nativeConstructors: Object.freeze([...nativeSubjects]),
    fieldWrites: Object.freeze(fieldWrites), storageFor, isNativeConstructor: (node: Node) => {
      const selected = storage.subject(node);
      return selected.kind === "resolved" && nativeSubjects.has(selected.subject);
    }, receivesWritableNative, storageOriginsFor, closedStorageOriginsFor, invalidationFor });
}
