import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { sourceMemberOwner } from "../../../source-navigation/class-members.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageReference, SourceStorageInputFrontier, SourceStorageScopedSubject } from "../graph/scoped-model.js";
import { sourceStorageIsMemberProjection, sourceStorageMemberSubject } from "../model/subjects.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageClassLineage } from "../model/construction.js";
import type { SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageReference } from "../graph/scoped-model.js";

type SourceStoragePhysicalMembers =
  | { readonly kind: "known"; readonly members: readonly SourceStorageScopedSubject[]; readonly absent: boolean;
      readonly excluded: boolean; readonly reason?: string }
  | { readonly kind: "pending" };

export function createSourceStoragePhysicalMembers(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, queries: {
    read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
    symbolic(value: SourceStorageReference | SourceStorageInputFrontier): boolean;
    lineages(value: SourceStorageReference): readonly SourceStorageClassLineage<SourceStorageScope>[] | undefined;
  }) {
  return (receiver: SourceStorageReference | SourceStorageInputFrontier, target: Node, receiverType: Type,
    mode: "read" | "write", view: SourceStorageSubject): SourceStoragePhysicalMembers | undefined => {
    const { ast, navigation, semantics } = source;
    const admits = (declaration: Node): boolean => mode === "read" ? !ast.is.IsSetAccessorDeclaration(declaration)
      : !ast.is.IsGetAccessorDeclaration(declaration);
    const unresolved = (reason: string): SourceStoragePhysicalMembers =>
      ({ kind: "known", members: Object.freeze([]), absent: false, excluded: false, reason });
    const allocation = receiver.subject.node;
    const construction = receiver.kind !== "input-frontier" && ast.is.IsNewExpression(allocation) && [...transport.invocationImplementations(allocation)].some(candidate =>
      navigation.isProjectDeclaration(candidate) && (ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate) ||
        ast.is.IsConstructorDeclaration(candidate) && ast.body(candidate) !== undefined));
    if (!construction) {
      const symbolic = queries.symbolic(receiver);
      const selectedView = symbolic ? view : receiver.subject;
      // The correspondence of a union receiver is the one of the union member that declares the target.
      const declaring = (): Type => {
        const { types, declarations: selected } = semantics.forNode(selectedView.node);
        const members = types.isUnion(receiverType) ? types.unionOrIntersectionTypes(receiverType).filter(member =>
          types.propertyInfos(member).some(property => [property.symbol, ...property.rootSymbols]
            .some(symbol => selected.symbolDeclarations(symbol).includes(target)))) : [];
        return members.length === 1 ? members[0]! : receiverType;
      };
      const declared = declaring();
      if (transport.memberFlow.excludes(selectedView, declared))
        return { kind: "known", members: Object.freeze([]), absent: false, excluded: true };
      const correspondence = transport.memberFlow.memberFor(selectedView, target, declared);
      if (correspondence === undefined) return unresolved("Source storage members require exact checked correspondence.");
      if (correspondence.kind === "absent") {
        if (!correspondence.destination.property.optional) return unresolved("Source storage members require exact checked correspondence.");
        const subject = sourceStorageMemberSubject(target, ast, transport.subject);
        const written = subject !== undefined && (transport.storedValuesFor(subject)?.length ?? 0) !== 0;
        return { kind: "known", members: Object.freeze(written ? [{ subject: subject!, bindings: receiver.scope }] : []),
          absent: true, excluded: false };
      }
      const declarations = correspondence.source.declarations;
      const members: SourceStorageScopedSubject[] = [];
      for (const declaration of declarations) {
        if (!budget.step()) return undefined;
        if (!admits(declaration)) continue;
        const subject = sourceStorageMemberSubject(declaration, ast, transport.subject);
        if (subject === undefined) return undefined;
        members.push(Object.freeze({ subject, bindings: receiver.scope }));
      }
      if (declarations.length > 0 && members.length === 0)
        return unresolved("Source storage correspondence does not provide the actual checked member operation mode.");
      const optional = correspondence.source.property.optional;
      return { kind: "known", members: Object.freeze(members), absent: members.length === 0 || optional, excluded: false };
    }
    const owner = sourceMemberOwner(ast, target);
    const selected = semantics.forNode(allocation);
    const contract = owner === undefined ? undefined : ast.is.IsTypeLiteralNode(owner) ? selected.types.authoredType(owner)
      : ast.is.IsObjectLiteralExpression(owner) ? selected.types.expressionType(owner) : selected.declarations.declaredType(owner);
    const operand = transport.invocationTargets.get(allocation);
    if (contract === undefined || operand === undefined)
      return unresolved("Source storage members require their checked construction contract.");
    const values = queries.read(sourceStorageReference(operand, receiver.scope));
    if (values === undefined) return undefined;
    const members: SourceStorageScopedSubject[] = [];
    let absent = false;
    let excluded = false;
    let completed = false;
    let reason: string | undefined;
    for (const value of values) {
      if (!budget.step()) return undefined;
      if (value.kind === "unresolved") { reason ??= value.reason; continue; }
      if (value.kind !== "leaf") continue;
      const lineages = queries.lineages(value);
      if (lineages === undefined) return undefined;
      for (const lineage of lineages) {
        if (!budget.step()) return undefined;
        const root = lineage.classes[0];
        if (!lineage.complete || root === undefined) {
          reason ??= "Source storage members require exact checked correspondence.";
          continue;
        }
        const selected = transport.memberFlow.membersInLineage(lineage, target, contract);
        if (selected === undefined) {
          reason ??= "Source storage members require exact checked correspondence.";
          continue;
        }
        if (selected.members.length !== 0 && !selected.members.some(member => admits(member.declaration))) {
          reason ??= "A physical source member does not provide the actual checked member operation mode.";
          continue;
        }
        for (const member of selected.members) {
          if (!budget.step()) return undefined;
          if (!admits(member.declaration)) continue;
          const subject = sourceStorageMemberSubject(member.declaration, ast, transport.subject);
          if (subject === undefined) return undefined;
          if (!members.some(previous => previous.subject === subject && previous.bindings === member.bindings))
            members.push(Object.freeze({ subject, bindings: member.bindings }));
        }
        completed = true;
        absent ||= selected.absent;
        excluded ||= selected.members.length === 0 && !selected.absent;
      }
    }
    return completed || reason !== undefined ? { kind: "known", members: Object.freeze(members), absent, excluded, reason } : { kind: "pending" };
  };
}

// A member read through an unbound or symbolic input or receiver yields the member's own subject (scoped successors). The
// same member reached as a projection of that input is the same symbolic location, so a store recorded on one is a store
// of the other.
export function sourceStorageSymbolicMemberAlias(transport: SourceStorageScopedTransport,
  symbolic: (subject: SourceStorageSubject, scope: SourceStorageScope) => boolean,
  left: SourceStorageReference, right: SourceStorageReference): boolean {
  for (const [projected, member] of [[left, right], [right, left]] as const) {
    const last = projected.subject.projection[projected.subject.projection.length - 1];
    if ((projected.subject.kind !== "input" && projected.subject.kind !== "receiver") || last === undefined ||
      !sourceStorageIsMemberProjection(last) || member.subject.projection.length !== 0 || member.subject.node !== last.declaration) continue;
    const base = transport.subject(projected.subject.node, projected.subject.kind, projected.subject.projection.slice(0, -1));
    if (base !== undefined && symbolic(base, projected.scope)) return true;
  }
  return false;
}
