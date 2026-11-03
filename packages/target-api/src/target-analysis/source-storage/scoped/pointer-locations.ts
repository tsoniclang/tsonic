import { pointerOperationFactKey } from "@tsonic/tsts";
import type { Node, PointerOperationFact } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { sourceIndexedStorageProjection, sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import type { SourceStorageReference, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";

interface SourceStoragePointerLocationQueries {
  read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
  creatorScope(node: Node, scope: SourceStorageScope): SourceStorageScope;
}

type SourceStoragePointerLocation = SourceStorageReference | Extract<SourceStorageTerm, { readonly kind: "empty" | "unresolved" }>;

export function createSourceStoragePointerLocations(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, queries: SourceStoragePointerLocationQueries) {
  const address = (operation: Extract<PointerOperationFact, { readonly operation: "address-of" }>,
    scope: SourceStorageScope): readonly SourceStoragePointerLocation[] | undefined => budget.withRows(rows => {
    const { ast, semantics } = source;
    const context = semantics.forNode(operation.storageExpression);
    const property = ast.is.IsPropertyAccessExpression(operation.storageExpression)
      ? context.operations.propertyAccess(operation.storageExpression) : undefined;
    const selected = property ?? (ast.is.IsElementAccessExpression(operation.storageExpression)
      ? context.operations.elementAccess(operation.storageExpression) : undefined);
    if (selected === undefined) {
      const subject = transport.locationFor(operation.storageExpression);
      return subject === undefined ? undefined : [Object.freeze({ kind: "leaf", subject,
        scope: queries.creatorScope(subject.node, scope) })];
    }
    const receiver = transport.subjectFor(selected.receiver.expression);
    const component = ast.is.IsElementAccessExpression(operation.storageExpression)
      ? sourceIndexedStorageProjection(selected.receiver.type,
        context.operations.elementAccess(operation.storageExpression)?.argument.expression, context, ast) : undefined;
    const declaration = property?.selectedWriteDeclaration ?? selected.selectedDeclaration;
    if (receiver === undefined || component === undefined && declaration === undefined) return undefined;
    const originals = queries.read(sourceStorageReference(receiver, scope));
    if (originals === undefined) return undefined;
    const result: SourceStoragePointerLocation[] = [];
    for (const original of originals) {
      if (!budget.step()) return undefined;
      if (original.kind === "empty" || original.kind === "unresolved") {
        if (!rows.add(1)) return undefined;
        result.push(original);
        continue;
      }
      if (original.kind !== "leaf") return undefined;
      const type = sourceStorageSubjectType(source, original.subject);
      if (type === undefined) return undefined;
      sourceStorageProjectComponents(original.subject.projection, type, selected.receiver.type,
        component === undefined ? [{ kind: "member", declaration: declaration! }] : [component], context, ast, budget, projection => {
          const subject = transport.subject(original.subject.node, original.subject.kind, projection);
          if (subject !== undefined && rows.add(1)) result.push(Object.freeze({ kind: "leaf", subject, scope: original.scope }));
        });
    }
    return budget.failure() === undefined ? result : undefined;
  });
  const identities = (pointer: SourceStorageReference): readonly SourceStoragePointerLocation[] | undefined => budget.withRows(rows => {
    const pending: SourceStoragePointerLocation[] = [pointer];
    const seen = new Map<SourceStorageScope, Set<SourceStorageReference["subject"]>>();
    const result: SourceStoragePointerLocation[] = [];
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const original = pending.pop()!;
      if (original.kind === "empty" || original.kind === "unresolved") { result.push(original); continue; }
      const visited = seen.get(original.scope);
      if (visited?.has(original.subject)) continue;
      if (!rows.add(visited === undefined ? 3 : 2)) return undefined;
      const entries = visited ?? new Set();
      entries.add(original.subject); seen.set(original.scope, entries);
      const operation = original.subject.kind === "value" && original.subject.projection.length === 0
        ? source.sourceFacts.getFact(original.subject.node, pointerOperationFactKey) : undefined;
      if (operation?.operation === "allocate") { result.push(original); continue; }
      if (operation?.operation === "address-of") {
        const selected = address(operation, original.scope);
        if (selected === undefined) return undefined;
        result.push(...selected); continue;
      }
      const expression = operation?.operation === "bind-pointer" ? operation.identityExpression
        : operation?.operation === "project-pointer" ? operation.pointerExpression : undefined;
      const subject = transport.subjectFor(expression);
      if (subject === undefined) return undefined;
      const selected = queries.read(sourceStorageReference(subject, original.scope));
      if (selected === undefined) return undefined;
      for (const value of selected) {
        if (!budget.step() || !rows.add(1)) return undefined;
        if (value.kind === "empty" || value.kind === "unresolved") { result.push(value); continue; }
        if (value.kind !== "leaf") return undefined;
        if (operation?.operation === "bind-pointer") result.push(value);
        else pending.push(value);
      }
    }
    return result;
  });
  return Object.freeze({ address, identities });
}
