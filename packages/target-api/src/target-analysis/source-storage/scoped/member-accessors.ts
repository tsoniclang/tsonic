import { sourceStorageSelectedInputSlots, type SourceStorageInvocationInputSelectionQuery } from "../graph/invocation-inputs.js";
import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { createSourceStorageAncestorQuery } from "../graph/ancestors.js";
import type { SourceStorageIncomingQuery } from "../graph/edges.js";
import type { createSourceStorageGraphQueries, SourceStorageReconciliation } from "../graph/graph-queries.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { sourceStorageMemberSubject, sourceStorageObjectRestOwner } from "../model/subjects.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { createSourceStorageMemberFlow, createSourceStorageMemberImplementations } from "../graph/member-flow.js";
import { Node_Initializer, SpreadAssignment_Expression } from "../../../source-navigation/index.js";
import { sourceStorageAccessDeclarations } from "../model/components.js";
import type { SourceStorageAccessorInvocation } from "../graph/scoped-model.js";

interface SourceStorageAccessorQueries {
  readonly subject: SourceStorageSubjectQuery;
  readonly incomingFor: SourceStorageIncomingQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  implementationsFor(declaration: Node, invocation: Node, receiver: Node): ReturnType<ReturnType<typeof createSourceStorageMemberImplementations>>;
  readonly spreadMembersFor: ReturnType<typeof createSourceStorageMemberFlow>["spreadMembersFor"];
  connect(origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined): void;
  recordInvocation(invocation: Node): void;
  readonly inputSlotsFor: SourceStorageInvocationInputSelectionQuery;
}

export function createSourceStorageMemberAccessors(source: TargetSourceProgram, budget: SourceStorageBudget,
  queries: SourceStorageAccessorQueries, graph: ReturnType<typeof createSourceStorageGraphQueries>) {
  const { ast, semantics } = source;
  const noInputs: ReadonlySet<SourceStorageSubject> = new Set();
  const ancestors = createSourceStorageAncestorQuery(budget, subject =>
    subject.kind === "member" ? queries.incomingFor(subject) : noInputs);
  const declarationsFor = graph.query((declaration: Node): ReadonlySet<Node> | undefined => {
    const subject = sourceStorageMemberSubject(declaration, ast, queries.subject);
    if (subject === undefined) return undefined;
    return budget.withRows(rows => {
      const selected = new Set<Node>();
      for (const original of ancestors(subject)) {
        if (!budget.step()) return undefined;
        if (!ast.is.IsGetAccessorDeclaration(original.node) && !ast.is.IsSetAccessorDeclaration(original.node)) continue;
        if (!selected.has(original.node) && !rows.add(1)) return undefined;
        selected.add(original.node);
      }
      return budget.failure() === undefined ? selected : undefined;
    });
  });
  const sites = new Set<Node>();
  const targets = new Map<Node, readonly SourceStorageAccessorInvocation[]>();
  const record = (access: Node): void => {
    if (sites.has(access) || !budget.row()) return;
    sites.add(access);
  };
  const accessorsFor = function* (declaration: Node, read: boolean): IterableIterator<Node> {
    for (const accessor of declarationsFor(declaration) ?? []) {
      if (!budget.step()) return;
      if (read ? ast.is.IsGetAccessorDeclaration(accessor) : ast.is.IsSetAccessorDeclaration(accessor)) {
        yield accessor;
        continue;
      }
      if (read || !ast.is.IsGetAccessorDeclaration(accessor)) continue;
      const file = ast.getSourceFile(accessor);
      if (file === undefined || !semantics.includes(file)) continue;
      const symbol = source.navigation.declarationSymbol(accessor, file);
      if (symbol === undefined) continue;
      for (const candidate of semantics.forFile(file).declarations.symbolDeclarations(symbol)) {
        if (!budget.step()) return;
        if (ast.is.IsSetAccessorDeclaration(candidate)) yield candidate;
      }
    }
  };
  const operations = function* (): Generator<SourceStorageReconciliation> {
    for (const access of sites) yield once => {
      const property = ast.is.IsPropertyAccessExpression(access) ? semantics.forNode(access).operations.propertyAccess(access) : undefined;
      const operation = property ?? (ast.is.IsElementAccessExpression(access) ? semantics.forNode(access).operations.elementAccess(access) : undefined);
      const restOwner = sourceStorageObjectRestOwner(access, ast);
      const bindingPattern = ast.is.IsBindingElement(access) ? ast.parent(access) : undefined;
      const bindingOwner = bindingPattern === undefined || !ast.is.IsObjectBindingPattern(bindingPattern) ? undefined : ast.parent(bindingPattern);
      const copying = ast.is.IsSpreadAssignment(access) || restOwner !== undefined;
      const receiver = ast.is.IsSpreadAssignment(access) ? SpreadAssignment_Expression(ast, access)
        : bindingOwner === undefined ? operation?.receiver.expression : Node_Initializer(ast, bindingOwner) ?? bindingOwner;
      if (receiver === undefined) return;
      const selected: { readonly declaration: Node; readonly read: boolean }[] = [];
      if (copying || bindingOwner !== undefined) {
        const members = queries.spreadMembersFor(receiver, access);
        if (members === undefined) return;
        for (const member of members) for (const declaration of member.declarations) selected.push({ declaration, read: true });
      } else if (operation !== undefined) {
        for (const declaration of sourceStorageAccessDeclarations(source, access, "read") ?? []) selected.push({ declaration, read: true });
        for (const declaration of sourceStorageAccessDeclarations(source, access, "write") ?? []) selected.push({ declaration, read: false });
      }
      for (const { declaration, read: readAccess } of selected) {
        for (const accessor of accessorsFor(declaration, readAccess)) {
          const implementations = queries.implementationsFor(accessor, access, receiver);
          if (readAccess && implementations.exact && !copying)
            for (const slot of implementations.slots ?? []) queries.connect(slot, queries.subjectFor(access));
          for (const candidate of implementations.nodes) {
            const known = targets.get(access);
            if (!known?.some(target => target.declaration === candidate && target.receiver === receiver)) {
              if (!budget.row()) return;
              targets.set(access, Object.freeze([...known ?? [], Object.freeze({ kind: "source-storage-accessor-entry" as const,
                invocation: access, declaration: candidate, receiver })]));
              graph.invalidate({ node: access, kind: targets });
              queries.recordInvocation(access);
            }
            if (!once(candidate)) continue;
            queries.connect(queries.subjectFor(receiver), queries.subject(candidate, "receiver"));
            if (readAccess && copying) {
              const object = restOwner === undefined ? ast.parent(access) : access;
              if (object === undefined || restOwner === undefined && !ast.is.IsObjectLiteralExpression(object)) {
                budget.reject("A spread accessor requires its original checked object literal evaluation."); return;
              }
              queries.connect(queries.subject(candidate, "return"), queries.subject(object, "value", [{ kind: "member", declaration: accessor }]));
            } else if (readAccess) queries.connect(queries.subject(candidate, "return"), queries.subjectFor(access));
            else {
              const input = queries.inputSlotsFor(candidate, access);
              const slots = sourceStorageSelectedInputSlots(input, candidate);
              if (input?.kind === "setter" && input.value !== undefined) {
                if (slots?.length !== 1) {
                  budget.reject("A setter write requires its exact checked value parameter."); return;
                }
                queries.connect(queries.subjectFor(input.value), queries.subject(slots[0]!.parameter, "input"));
              }
            }
          }
        }
      }
    };
  };
  return Object.freeze({ record, sites, declarationsFor, operations, targets });
}
