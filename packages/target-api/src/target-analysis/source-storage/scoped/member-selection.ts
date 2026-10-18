import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { sourceMemberOwner } from "../../../source-navigation/class-members.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageReference, SourceStorageScopedSubject } from "../graph/scoped-model.js";
import { sourceStorageMemberSubject } from "../model/subjects.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageClassValue } from "../model/construction.js";
import type { SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageReference } from "../graph/scoped-model.js";

type SourceStoragePhysicalMembers =
  | { readonly kind: "known"; readonly members: readonly SourceStorageScopedSubject[]; readonly absent: boolean;
      readonly reason?: string }
  | { readonly kind: "pending" };

export function createSourceStoragePhysicalMembers(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, queries: {
    read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
    symbolic(value: SourceStorageReference): boolean;
    lineages(value: SourceStorageReference): readonly {
      readonly classes: readonly SourceStorageClassValue<SourceStorageScope>[]; readonly complete: boolean;
    }[] | undefined;
  }) {
  return (receiver: SourceStorageReference, target: Node, receiverType: Type,
    mode: "read" | "write", view: SourceStorageSubject): SourceStoragePhysicalMembers | undefined => {
    const { ast, navigation, semantics } = source;
    const admits = (declaration: Node): boolean => mode === "read" ? !ast.is.IsSetAccessorDeclaration(declaration)
      : !ast.is.IsGetAccessorDeclaration(declaration);
    const unresolved = (reason: string): SourceStoragePhysicalMembers =>
      ({ kind: "known", members: Object.freeze([]), absent: false, reason });
    const allocation = receiver.subject.node;
    const construction = ast.is.IsNewExpression(allocation) && [...transport.invocationImplementations(allocation)].some(candidate =>
      navigation.isProjectDeclaration(candidate) && (ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate) ||
        ast.is.IsConstructorDeclaration(candidate) && ast.body(candidate) !== undefined));
    if (!construction) {
      const symbolic = queries.symbolic(receiver);
      const selectedView = symbolic ? view : receiver.subject;
      const declarations = transport.memberFlow.declarationsFor(selectedView, target, receiverType);
      const correspondence = symbolic || declarations === undefined
        ? transport.memberFlow.membersFor(selectedView, receiverType) : undefined;
      if (declarations === undefined) return correspondence?.some(member => member.kind === "absent" &&
        member.destination.declarations.includes(target)) === true ? { kind: "known", members: Object.freeze([]), absent: true }
        : unresolved("Source storage members require exact checked correspondence.");
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
      if (symbolic && correspondence === undefined)
        return unresolved("Source storage members require exact checked correspondence.");
      const optional = correspondence?.some(member => member.kind === "present" &&
        member.destination.declarations.includes(target) && member.source.property.optional) === true;
      return { kind: "known", members: Object.freeze(members), absent: members.length === 0 || optional };
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
        let found = false;
        let knownAbsent = false;
        let unknown = false;
        for (const captured of lineage.classes) {
          if (!budget.step()) return undefined;
          const instance = transport.subject(captured.subject.node, "receiver");
          const declarations = instance === undefined ? undefined : transport.memberFlow.declarationsFor(instance, target, contract);
          if (declarations === undefined) { unknown = true; continue; }
          knownAbsent ||= declarations.length === 0;
          const physical = declarations.filter(member => !ast.hasModifierKind(member, "static") &&
            sourceMemberOwner(ast, member) === captured.subject.node);
          if (physical.length === 0) continue;
          if (unknown) { reason ??= "Source storage members require exact checked correspondence."; break; }
          if (!physical.some(admits)) {
            reason ??= "A physical source member does not provide the actual checked member operation mode.";
            unknown = true;
            break;
          }
          for (const member of physical) {
            if (!budget.step()) return undefined;
            if (!admits(member)) continue;
            const subject = sourceStorageMemberSubject(member, ast, transport.subject);
            if (subject === undefined) return undefined;
            if (!members.some(previous => previous.subject === subject && previous.bindings === captured.bindings))
              members.push(Object.freeze({ subject, bindings: captured.bindings }));
          }
          found = true;
          break;
        }
        if (!found && (unknown || !knownAbsent)) {
          reason ??= "Source storage members require exact checked correspondence.";
          continue;
        }
        completed = true;
        absent ||= !found;
      }
    }
    return completed || reason !== undefined ? { kind: "known", members: Object.freeze(members), absent, reason } : { kind: "pending" };
  };
}
