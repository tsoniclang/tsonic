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
  | { readonly kind: "known"; readonly members: readonly SourceStorageScopedSubject[]; readonly absent: boolean }
  | { readonly kind: "pending" }
  | { readonly kind: "unresolved"; readonly reason: string };

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
    const allocation = receiver.subject.node;
    const construction = ast.is.IsNewExpression(allocation) && [...transport.invocationImplementations(allocation)].some(candidate =>
      navigation.isProjectDeclaration(candidate) && (ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate) ||
        ast.is.IsConstructorDeclaration(candidate) && ast.body(candidate) !== undefined));
    if (!construction) {
      const symbolic = queries.symbolic(receiver);
      const selectedView = symbolic ? view : receiver.subject;
      const declarations = transport.memberFlow.declarationsFor(selectedView, target, receiverType);
      if (declarations === undefined) return { kind: "unresolved", reason: "Source storage members require exact checked correspondence." };
      const members: SourceStorageScopedSubject[] = [];
      for (const declaration of declarations) {
        if (!budget.step()) return undefined;
        if (!admits(declaration)) continue;
        const subject = sourceStorageMemberSubject(declaration, ast, transport.subject);
        if (subject === undefined) return undefined;
        members.push(Object.freeze({ subject, bindings: receiver.scope }));
      }
      if (declarations.length > 0 && members.length === 0) return { kind: "unresolved",
        reason: "Source storage correspondence does not provide the actual checked member operation mode." };
      const correspondence = symbolic ? transport.memberFlow.membersFor(selectedView, receiverType) : undefined;
      if (symbolic && correspondence === undefined) return { kind: "unresolved",
        reason: "A symbolic source member requires its exact checked presence correspondence." };
      const optional = correspondence?.some(member => member.kind === "present" &&
        member.destination.declarations.includes(target) && member.source.property.optional) === true;
      return { kind: "known", members: Object.freeze(members), absent: members.length === 0 || optional };
    }
    const owner = sourceMemberOwner(ast, target);
    const selected = semantics.forNode(allocation);
    const contract = owner === undefined ? undefined : ast.is.IsTypeLiteralNode(owner) ? selected.types.authoredType(owner)
      : ast.is.IsObjectLiteralExpression(owner) ? selected.types.expressionType(owner) : selected.declarations.declaredType(owner);
    const operand = transport.invocationTargets.get(allocation);
    if (contract === undefined || operand === undefined) return { kind: "unresolved",
      reason: "Source storage members require their checked construction contract." };
    const values = queries.read(sourceStorageReference(operand, receiver.scope));
    if (values === undefined) return undefined;
    const members: SourceStorageScopedSubject[] = [];
    let absent = false;
    let completed = false;
    for (const value of values) {
      if (!budget.step()) return undefined;
      if (value.kind === "unresolved") return { kind: "unresolved", reason: value.reason };
      if (value.kind !== "leaf") continue;
      const lineages = queries.lineages(value);
      if (lineages === undefined) return undefined;
      for (const lineage of lineages) {
        if (!budget.step()) return undefined;
        const root = lineage.classes[0];
        if (!lineage.complete || root === undefined) return { kind: "unresolved",
          reason: "Source storage members require their complete actual class lineage." };
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
          if (unknown) return { kind: "unresolved", reason: "A physical source member requires its complete actual override correspondence." };
          if (!physical.some(admits)) return { kind: "unresolved",
            reason: "A physical source member does not provide the actual checked member operation mode." };
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
        if (!found && (unknown || !knownAbsent)) return { kind: "unresolved",
          reason: "A physical source member requires its complete actual class correspondence." };
        completed = true;
        absent ||= !found;
      }
    }
    return completed ? { kind: "known", members: Object.freeze(members), absent } : { kind: "pending" };
  };
}
