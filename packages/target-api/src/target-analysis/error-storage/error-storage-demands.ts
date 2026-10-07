import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageProjection, SourceStorageSubject } from "../source-storage/subjects.js";
import type { SourceStorageQueries, SourceStorageSubjectSelection } from "../source-storage/types.js";
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
  readonly nativeConstructors: readonly Node[];
  readonly fieldWrites: readonly Node[];
  storageFor(subject: Node, projection?: readonly SourceStorageProjection[]): SourceErrorStorageDemand;
  isNativeConstructor(subject: Node): boolean;
  receivesWritableNative(subject: Node, projection?: readonly SourceStorageProjection[]): boolean;
  storageOriginsFor(subject: Node, projection?: readonly SourceStorageProjection[]): { readonly kind: "resolved"; readonly origins: readonly SourceErrorStorageOrigin[] }
    | { readonly kind: "unresolved"; readonly reason: string };
  invalidationFor(owner: Node, expression: Node, pureInvocations: ReadonlySet<Node>):
    { readonly kind: "preserved" | "invalidated" } | { readonly kind: "unresolved"; readonly reason: string };
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
  const writes = new Map<SourceStorageSubject, Set<Node>>();
  const unresolvedWrites = new Map<SourceStorageSubject, string>();
  const nativeConstructors: Node[] = [];
  const nativeSubjects = new Set<SourceStorageSubject>();
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
  const recordWrite = (subject: SourceStorageSubject | undefined, write: Node): void => {
    if (subject === undefined) { reject("An admitted Error write has no exact source storage subject."); return; }
    const selected = writes.get(subject) ?? new Set<Node>();
    if (selected.has(write) || !reserveRow("selected-write")) return;
    selected.add(write);
    writes.set(subject, selected);
    if (subject.projection.length === 0 && (ast.is.IsElementAccessExpression(subject.node) || ast.is.IsBindingElement(subject.node)))
      unresolvedWrites.set(subject, "An admitted Error write has no exact selected scalar storage transport.");
    const reason = storage.unresolvedFor(subject);
    if (reason !== undefined) reject(reason);
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
      nativeConstructors.push(node);
      const subject = selectedSubject(storage.subject(node));
      if (subject !== undefined) nativeSubjects.add(subject);
    }
  }
  const pending = [...writes.keys()];
  const queued = new Set(pending);
  for (let index = 0; index < pending.length && failureReason() === undefined; index += 1) {
    const destination = pending[index]!;
    queued.delete(destination);
    const destinationWrites = writes.get(destination)!;
    const incoming = storage.incomingFor(destination);
    if (incoming.kind === "unresolved") { reject(incoming.reason); break; }
    for (const origin of incoming.subjects) {
      const originWrites = writes.get(origin) ?? new Set<Node>();
      const previous = originWrites.size;
      for (const write of destinationWrites) {
        if (!step()) break;
        if (originWrites.has(write)) continue;
        if (!reserveRow("transported-write")) break;
        originWrites.add(write);
      }
      writes.set(origin, originWrites);
      if (originWrites.size !== previous && !queued.has(origin)) { queued.add(origin); pending.push(origin); }
    }
  }
  const selections = new Map<SourceStorageSubject, SourceErrorStorageDemand>();
  const storageFor: SourceErrorStorageDemandQueries["storageFor"] = (node, projection) => {
    const failure = failureReason();
    if (failure !== undefined) return Object.freeze({ kind: "unresolved", reason: failure });
    const selected = storage.storageSubjectFor(node, projection);
    if (selected.kind === "unresolved") return selected;
    const reason = storage.unresolvedFor(selected.subject);
    if (reason !== undefined) return Object.freeze({ kind: "unresolved", reason });
    if (unresolvedWrites.size !== 0) {
      const ancestors = storage.ancestorsFor(selected.subject);
      if (ancestors.kind === "unresolved") return ancestors;
      for (const ancestor of ancestors.subjects) {
        const reason = unresolvedWrites.get(ancestor);
        if (reason !== undefined) return Object.freeze({ kind: "unresolved", reason });
      }
    }
    const cached = selections.get(selected.subject);
    if (cached !== undefined) return cached;
    const selectedWrites = writes.get(selected.subject);
    const demand = selectedWrites === undefined || selectedWrites.size === 0 ? immutableDemand
      : Object.freeze({ kind: "writable" as const, writes: Object.freeze([...selectedWrites]) });
    selections.set(selected.subject, demand);
    return demand;
  };
  const receivesWritableNative: SourceErrorStorageDemandQueries["receivesWritableNative"] = (node, projection) => {
    if (storageFor(node, projection).kind === "unresolved") return false;
    const selected = storage.storageSubjectFor(node, projection);
    if (selected.kind === "unresolved") return false;
    const ancestors = storage.ancestorsFor(selected.subject);
    return ancestors.kind === "resolved" && ancestors.subjects.some(subject => nativeSubjects.has(subject) &&
      storageFor(subject.node, subject.projection).kind === "writable");
  };
  const storageOriginsFor: SourceErrorStorageDemandQueries["storageOriginsFor"] = (node, projection) => {
    const demand = storageFor(node, projection);
    if (demand.kind === "unresolved") return demand;
    const selected = storage.storageSubjectFor(node, projection);
    if (selected.kind === "unresolved") return selected;
    const origins = storage.originsFor(selected.subject);
    return origins.kind === "unresolved" ? origins : Object.freeze({ kind: "resolved", origins: Object.freeze(origins.origins
      .map(origin => Object.freeze({ node: origin.subject.node, type: origin.type }))) });
  };
  const invalidationFor = createSourceErrorInvalidationQuery(source, storage, storageFor, nativeSubjects, capturedStackTargets,
    step, failureReason);
  return Object.freeze({ retainedBoundaries: Object.freeze(retainedBoundaries), nativeConstructors: Object.freeze(nativeConstructors),
    fieldWrites: Object.freeze(fieldWrites), storageFor, isNativeConstructor: (node: Node) => {
      const selected = storage.subject(node);
      return selected.kind === "resolved" && nativeSubjects.has(selected.subject);
    }, receivesWritableNative, storageOriginsFor, invalidationFor });
}
