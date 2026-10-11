import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { createSourceStorageAncestorQuery } from "./ancestors.js";
import type { SourceStorageIncomingQuery } from "./edges.js";
import type { createSourceStorageGraphQueries, SourceStorageReconciliation } from "./graph-queries.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import { sourceStorageMemberSubject } from "./subjects.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";

interface SourceStorageAccessorQueries {
  readonly subject: SourceStorageSubjectQuery;
  readonly incomingFor: SourceStorageIncomingQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  implementationsFor(declaration: Node, invocation: Node): ReadonlySet<Node>;
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
  const targets = new Map<Node, readonly Node[]>();
  const record = (access: Node): void => {
    if (sites.has(access) || !budget.row()) return;
    sites.add(access);
  };
  const operations = function* (): Generator<SourceStorageReconciliation> {
    for (const access of sites) yield once => {
      const property = ast.is.IsPropertyAccessExpression(access) ? semantics.forNode(access).operations.propertyAccess(access) : undefined;
      const operation = property ?? semantics.forNode(access).operations.elementAccess(access);
      if (operation === undefined) return;
      const read = operation.accessMode === "write" ? undefined : property?.selectedReadDeclaration ?? operation.selectedDeclaration;
      const write = operation.accessMode === "read" ? undefined : property?.selectedWriteDeclaration ?? operation.selectedDeclaration;
      for (const [declaration, readAccess] of [[read, true], [write, false]] as const) {
        if (declaration === undefined) continue;
        for (const accessor of declarationsFor(declaration) ?? []) {
          if (!budget.step()) return;
          if (readAccess ? !ast.is.IsGetAccessorDeclaration(accessor) : !ast.is.IsSetAccessorDeclaration(accessor)) continue;
          const known = targets.get(access);
          if (!known?.includes(accessor)) {
            if (!budget.row()) return;
            targets.set(access, Object.freeze([...known ?? [], accessor]));
            graph.invalidate({ node: access, kind: targets });
            queries.recordInvocation(access);
          }
          for (const candidate of queries.implementationsFor(accessor, access)) {
            if (!once(candidate)) continue;
            queries.connect(queries.subjectFor(operation.receiver.expression), queries.subject(candidate, "receiver"));
            if (readAccess) queries.connect(queries.subject(candidate, "return"), queries.subjectFor(access));
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
