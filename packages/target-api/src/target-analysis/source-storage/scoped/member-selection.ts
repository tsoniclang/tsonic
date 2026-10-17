import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { sourceMemberOwner } from "../../../source-navigation/class-members.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageClassValue } from "../model/construction.js";
import type { SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageReference } from "../graph/scoped-model.js";

type SourceStoragePhysicalMembers =
  | { readonly kind: "known"; readonly declarations: readonly Node[]; readonly absent: boolean }
  | { readonly kind: "pending" }
  | { readonly kind: "unresolved"; readonly reason: string };

export function createSourceStoragePhysicalMembers(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, queries: {
    read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
    lineages(value: SourceStorageReference): readonly {
      readonly classes: readonly SourceStorageClassValue<SourceStorageScope>[]; readonly complete: boolean;
    }[] | undefined;
  }) {
  return (receiver: SourceStorageReference, target: Node, receiverType: Type): SourceStoragePhysicalMembers | undefined => {
    const { ast, navigation, semantics } = source;
    const allocation = receiver.subject.node;
    const construction = ast.is.IsNewExpression(allocation) && [...transport.invocationImplementations(allocation)].some(candidate =>
      navigation.isProjectDeclaration(candidate) && (ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate) ||
        ast.is.IsConstructorDeclaration(candidate) && ast.body(candidate) !== undefined));
    if (!construction) {
      const declarations = transport.memberFlow.declarationsFor(receiver.subject, target, receiverType);
      return declarations === undefined ? { kind: "unresolved", reason: "Source storage members require exact checked correspondence." }
        : { kind: "known", declarations, absent: declarations.length === 0 };
    }
    const owner = sourceMemberOwner(ast, target);
    const selected = semantics.forNode(target);
    const contract = owner === undefined ? undefined : ast.is.IsTypeLiteralNode(owner) ? selected.types.authoredType(owner)
      : ast.is.IsObjectLiteralExpression(owner) ? selected.types.expressionType(owner) : selected.declarations.declaredType(owner);
    const operand = transport.invocationTargets.get(allocation);
    if (contract === undefined || operand === undefined) return { kind: "unresolved",
      reason: "Source storage members require their checked construction contract." };
    const values = queries.read(sourceStorageReference(operand, receiver.scope));
    if (values === undefined) return undefined;
    const members = new Set<Node>();
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
        const instance = transport.subject(root.subject.node, "receiver");
        const declarations = instance === undefined ? undefined : transport.memberFlow.declarationsFor(instance, target, contract);
        if (declarations === undefined) return { kind: "unresolved",
          reason: "Source storage members require exact checked correspondence." };
        completed = true;
        absent ||= declarations.length === 0;
        for (const member of declarations) {
          if (!budget.step()) return undefined;
          const declaredOwner = sourceMemberOwner(ast, member);
          if (ast.hasModifierKind(member, "static") || !lineage.classes.some(captured => captured.subject.node === declaredOwner))
            return { kind: "unresolved", reason: "A physical source member requires its actual class owner." };
          members.add(member);
        }
      }
    }
    return completed ? { kind: "known", declarations: Object.freeze([...members]), absent } : { kind: "pending" };
  };
}
