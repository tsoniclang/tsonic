import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { createSourceStorageAncestorQuery } from "../graph/ancestors.js";
import type { SourceStorageIncomingQuery } from "../graph/edges.js";
import type { createSourceStorageGraphQueries, SourceStorageReconciliation } from "../graph/graph-queries.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { sourceStorageMemberSubject } from "../model/subjects.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { createSourceStorageMemberFlow, createSourceStorageMemberImplementations } from "../graph/member-flow.js";
import { SpreadAssignment_Expression } from "../../../source-navigation/index.js";
import type { SourceStorageAccessorInvocation } from "../graph/scoped-model.js";

interface SourceStorageAccessorQueries {
  readonly subject: SourceStorageSubjectQuery;
  readonly incomingFor: SourceStorageIncomingQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  implementationsFor(declaration: Node, invocation: Node, receiver: Node): ReturnType<ReturnType<typeof createSourceStorageMemberImplementations>>;
  readonly spreadMembersFor: ReturnType<typeof createSourceStorageMemberFlow>["spreadMembersFor"];
  connect(origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined): void;
  recordInvocation(invocation: Node): void;
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
  const operations = function* (): Generator<SourceStorageReconciliation> {
    for (const access of sites) yield once => {
      const property = ast.is.IsPropertyAccessExpression(access) ? semantics.forNode(access).operations.propertyAccess(access) : undefined;
      const operation = property ?? (ast.is.IsElementAccessExpression(access) ? semantics.forNode(access).operations.elementAccess(access) : undefined);
      const receiver = ast.is.IsSpreadAssignment(access) ? SpreadAssignment_Expression(ast, access) : operation?.receiver.expression;
      if (receiver === undefined) return;
      const selected: { readonly declaration: Node; readonly read: boolean }[] = [];
      if (ast.is.IsSpreadAssignment(access)) {
        const members = queries.spreadMembersFor(receiver);
        if (members === undefined) return;
        for (const member of members) for (const declaration of member.declarations) selected.push({ declaration, read: true });
      } else if (operation !== undefined) {
        const read = operation.accessMode === "write" ? undefined : property?.selectedReadDeclaration ?? operation.selectedDeclaration;
        const write = operation.accessMode === "read" ? undefined : property?.selectedWriteDeclaration ?? operation.selectedDeclaration;
        if (read !== undefined) selected.push({ declaration: read, read: true });
        if (write !== undefined) selected.push({ declaration: write, read: false });
      }
      for (const { declaration, read: readAccess } of selected) {
        for (const accessor of declarationsFor(declaration) ?? []) {
          if (!budget.step()) return;
          if (readAccess ? !ast.is.IsGetAccessorDeclaration(accessor) : !ast.is.IsSetAccessorDeclaration(accessor)) continue;
          const implementations = queries.implementationsFor(accessor, access, receiver);
          if (readAccess && implementations.exact && !ast.is.IsSpreadAssignment(access))
            for (const slot of implementations.slots ?? []) queries.connect(slot, queries.subjectFor(access));
          for (const candidate of implementations.nodes) {
            const known = targets.get(access);
            if (!known?.some(target => target.declaration === candidate && target.receiver === receiver)) {
              if (!budget.row()) return;
              targets.set(access, Object.freeze([...known ?? [], Object.freeze({ declaration: candidate, receiver })]));
              graph.invalidate({ node: access, kind: targets });
              queries.recordInvocation(access);
            }
            if (!once(candidate)) continue;
            queries.connect(queries.subjectFor(receiver), queries.subject(candidate, "receiver"));
            if (readAccess && ast.is.IsSpreadAssignment(access)) {
              const object = ast.parent(access);
              if (object === undefined || !ast.is.IsObjectLiteralExpression(object)) {
                budget.reject("A spread accessor requires its original checked object literal evaluation."); return;
              }
              queries.connect(queries.subject(candidate, "return"), queries.subject(object, "value", [{ kind: "member", declaration: accessor }]));
            } else if (readAccess) queries.connect(queries.subject(candidate, "return"), queries.subjectFor(access));
            else {
              const parent = ast.parent(access);
              const assignment = parent === undefined || !ast.is.IsBinaryExpression(parent) ? undefined : ast.as.AsBinaryExpression(parent);
              if (assignment?.Left === access && ast.operatorKindName(parent) === "KindEqualsToken")
                queries.connect(queries.subjectFor(assignment.Right), queries.subject(ast.parameters(candidate)[0], "input"));
            }
          }
        }
      }
    };
  };
  return Object.freeze({ record, sites, declarationsFor, operations, targets });
}
