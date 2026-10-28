import type { Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { ElementAccessExpression_ArgumentExpression } from "../../../source-navigation/index.js";
import { sourceIndexedStorageProjection, sourceStorageAccessDeclarations, sourceStorageComponentType,
  sourceStorageSubjectType } from "../model/components.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection, SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageIsMemberProjection, sourceStorageMemberSubject } from "../model/subjects.js";
import type { SourceStorageScope, SourceStorageScopedSubject, SourceStorageProjectionReceiver } from "../graph/scoped-model.js";
import type { createSourceStorageTransport } from "./transport.js";

interface SourceStoragePublicationDemand extends SourceStorageScopedSubject {
  readonly type: Type;
  readonly receiver: SourceStorageProjectionReceiver;
}

export function createSourceStoragePublicationDemands(source: TargetSourceProgram,
  transport: ReturnType<typeof createSourceStorageTransport>, budget: SourceStorageBudget,
  origins: (subject: SourceStorageSubject, bindings: SourceStorageScope) => ReadonlySet<SourceStorageScopedSubject> | undefined) {
  const demands = new Map<SourceStorageSubject, Map<SourceStorageScope, SourceStoragePublicationDemand[]>>();
  const rows = budget.createRows();
  let initialized = false;
  const retain = (receiver: SourceStorageSubject, type: Type, components: readonly SourceStorageProjection[]): void => budget.withRows(temporary => {
    const scope = transport.substitutions.forLexicalOwner(receiver.node);
    if (scope === undefined) return;
    const selected = origins(receiver, scope);
    if (selected === undefined) return;
    const values: SourceStoragePublicationDemand[] = [];
    for (const current of selected) {
      if (!budget.step()) return;
      const semantics = source.semantics.forNode(receiver.node);
      for (const component of components) {
        if (!budget.step()) return;
        const memberType = sourceStorageComponentType(type, component, semantics, source.ast);
        const subject = sourceStorageIsMemberProjection(component)
          ? sourceStorageMemberSubject(component.declaration, source.ast, transport.subject)
          : transport.subject(current.subject.node, current.subject.kind, [...current.subject.projection, component]);
        if (subject !== undefined && memberType !== undefined) {
          if (!temporary.add(1)) return;
          values.push(Object.freeze({ subject, bindings: current.bindings, type: memberType,
            receiver: Object.freeze({ ...current, type, view: receiver, component }) }));
        }
      }
    }
    for (const current of selected) {
      if (!budget.step()) return;
      for (const value of values) {
        if (!budget.step()) return;
        const contexts = demands.get(current.subject);
        const known = contexts?.get(current.bindings);
        if (known?.some(previous => previous.subject === value.subject && previous.bindings === value.bindings &&
          previous.receiver.subject === value.receiver.subject && previous.receiver.view === value.receiver.view &&
          previous.receiver.type === value.receiver.type)) continue;
        if (!rows.add(1 + (contexts === undefined ? 1 : 0) + (known === undefined ? 1 : 0))) return;
        const retained = known ?? [];
        retained.push(value);
        const retainedContexts = contexts ?? new Map<SourceStorageScope, SourceStoragePublicationDemand[]>();
        retainedContexts.set(current.bindings, retained);
        demands.set(current.subject, retainedContexts);
      }
    }
  });
  const initialize = (): void => {
    if (initialized) return;
    initialized = true;
    const projected: SourceStorageSubject[] = [];
    for (const subject of transport.identities) {
      if (!budget.step()) return;
      if (subject.projection.length === 0) continue;
      if (!rows.add(1)) return;
      projected.push(subject);
    }
    const { ast, semantics } = source;
    for (const node of transport.visitedNodes) {
      if (!budget.step()) return;
      if (!ast.is.IsPropertyAccessExpression(node) && !ast.is.IsElementAccessExpression(node)) continue;
      const context = semantics.forNode(node);
      const access = ast.is.IsPropertyAccessExpression(node)
        ? context.operations.propertyAccess(node) : context.operations.elementAccess(node);
      const receiver = access === undefined ? undefined : transport.subjectFor(access.receiver.expression);
      if (access === undefined || receiver === undefined) continue;
      const declarations = new Set([...sourceStorageAccessDeclarations(source, node, "read") ?? [],
        ...sourceStorageAccessDeclarations(source, node, "write") ?? []]);
      const components: SourceStorageProjection[] = [...declarations].map(declaration => ({ kind: "member", declaration }));
      if (ast.is.IsElementAccessExpression(node)) {
        const component = sourceIndexedStorageProjection(access.receiver.type,
          ElementAccessExpression_ArgumentExpression(ast, node), context, ast);
        if (component !== undefined) components.push(component);
      }
      retain(receiver, access.receiver.type, components);
    }
    for (const subject of projected) {
      if (!budget.step()) return;
      const component = subject.projection[subject.projection.length - 1];
      const receiver = transport.subject(subject.node, subject.kind, subject.projection.slice(0, -1));
      const type = receiver === undefined ? undefined : sourceStorageSubjectType(source, receiver);
      if (receiver !== undefined && type !== undefined && component !== undefined) retain(receiver, type, [component]);
    }
  };
  return Object.freeze({
    *values(receiver: SourceStorageSubject, bindings: SourceStorageScope): Iterable<SourceStoragePublicationDemand> {
      initialize();
      for (const [scope, values] of demands.get(receiver) ?? []) {
        if (!budget.step()) return;
        if (scope === bindings) { yield* values; continue; }
        const expected = transport.substitutions.creationKeyFor(receiver, scope);
        const actual = transport.substitutions.creationKeyFor(receiver, bindings);
        if (expected !== undefined && actual === expected) yield* values;
      }
    },
    finish(): void { demands.clear(); rows.release(); },
  });
}
