import { sourceAnalysisValueType, type SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import { ElementAccessExpression_ArgumentExpression } from "../../../source-navigation/index.js";
import { sourceIndexedStorageProjection, sourceStorageAccessDeclarations, sourceStorageComponentType, sourceStorageSubjectType } from "../model/components.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection, SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageIsMemberProjection, sourceStorageMemberSubject } from "../model/subjects.js";
import type { SourceStorageScope, SourceStorageScopedSubject, SourceStorageProjectionReceiver } from "../graph/scoped-model.js";
import type { createSourceStorageTransport } from "./transport.js";

interface SourceStoragePublicationDemand extends SourceStorageScopedSubject {
  readonly type: SourceTypeDescriptor;
  readonly receiver: SourceStorageProjectionReceiver;
}

export function createSourceStoragePublicationDemands(source: SourceAnalysisProgram,
  transport: ReturnType<typeof createSourceStorageTransport>, budget: SourceStorageBudget,
  origins: (subject: SourceStorageSubject, bindings: SourceStorageScope) => ReadonlySet<SourceStorageScopedSubject> | undefined) {
  const demands = new Map<SourceStorageSubject, Map<SourceStorageScope, SourceStoragePublicationDemand[]>>();
  const rows = budget.createRows();
  let initialized = false;
  const retain = (receiver: SourceStorageSubject, type: SourceTypeDescriptor, components: readonly SourceStorageProjection[]): void => budget.withRows(temporary => {
    const selectedComponents: { readonly component: SourceStorageProjection; readonly type: SourceTypeDescriptor;
      readonly subject: SourceStorageSubject | undefined }[] = [];
    for (const component of components) {
      if (!budget.step()) return;
      const memberType = sourceStorageComponentType(source, type, component);
      if (memberType === undefined) continue;
      const member = sourceStorageIsMemberProjection(component);
      const subject = member ? sourceStorageMemberSubject(component.declaration, source.ast, transport.subject) : undefined;
      if (member && subject === undefined) continue;
      if (!temporary.add(1)) return;
      selectedComponents.push({ component, type: memberType, subject });
    }
    if (selectedComponents.length === 0) return;
    const scope = transport.substitutions.forLexicalOwner(receiver.node);
    if (scope === undefined) return;
    const selected = origins(receiver, scope);
    if (selected === undefined) return;
    const values: SourceStoragePublicationDemand[] = [];
    for (const current of selected) {
      if (!budget.step()) return;
      for (const selectedComponent of selectedComponents) {
        if (!budget.step()) return;
        const component = selectedComponent.component;
        const subject = selectedComponent.subject ??
          transport.subject(current.subject.node, current.subject.kind, [...current.subject.projection, component]);
        if (subject !== undefined) {
          if (!temporary.add(1)) return;
          values.push(Object.freeze({ subject, bindings: current.bindings, type: selectedComponent.type,
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
    const { ast, navigation } = source;
    for (const node of transport.visitedNodes) {
      if (!budget.step()) return;
      if (!ast.is.IsPropertyAccessExpression(node) && !ast.is.IsElementAccessExpression(node)) continue;
      const access = navigation.memberAccess(node);
      const receiver = access === undefined ? undefined : transport.subjectFor(access.receiver);
      const receiverType = access === undefined ? undefined : sourceAnalysisValueType(source, access.receiver);
      if (access === undefined || receiver === undefined || receiverType === undefined) continue;
      const declarations = new Set([...sourceStorageAccessDeclarations(source, node, "read") ?? [],
        ...sourceStorageAccessDeclarations(source, node, "write") ?? []]);
      const components: SourceStorageProjection[] = [...declarations].map(declaration => ({ kind: "member", declaration }));
      if (ast.is.IsElementAccessExpression(node)) {
        const component = sourceIndexedStorageProjection(source, receiverType,
          ElementAccessExpression_ArgumentExpression(ast, node));
        if (component !== undefined) components.push(component);
      }
      retain(receiver, receiverType, components);
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
