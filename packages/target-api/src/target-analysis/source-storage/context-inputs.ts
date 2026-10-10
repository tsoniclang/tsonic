import type { Node, SourceFile } from "@tsonic/tsts";
import { Node_Expression, sourceLexicalCaptures } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourceStorageComponents, sourceStorageSubjectType } from "./components.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageIncomingQuery } from "./edges.js";

interface SourceStorageContextInputQueries {
  readonly subject: SourceStorageSubjectQuery;
  readonly incomingFor: SourceStorageIncomingQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  sourceFileFor(subject: SourceStorageSubject): SourceFile | undefined;
  isInvocation(node: Node): boolean;
  implementationsFor(node: Node): ReadonlySet<Node>;
  invocationOrigins(subject: SourceStorageSubject, candidate: Node, invocation: Node): ReadonlySet<SourceStorageSubject>;
  argumentsFor(node: Node): readonly Node[];
}

export function createSourceStorageContextInputs(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  queries: SourceStorageContextInputQueries,
) {
  const selections = new Map<SourceStorageSubject, ReadonlySet<SourceStorageSubject>>();
  return (origin: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined => {
    if (!budget.step()) return undefined;
    const cached = selections.get(origin);
    if (cached !== undefined) return cached;
    const { ast, navigation, semantics } = source;
    const node = origin.node;
    const invocation = queries.isInvocation(node);
    const incoming = invocation ? undefined : queries.incomingFor(origin);
    const rows = budget.createRows();
    let complete = false;
    try {
      if (!rows.add(1 + (incoming?.size ?? 0))) return undefined;
      const inputs = new Set(incoming);
      const add = (selected: SourceStorageSubject | undefined): void => {
        if (selected !== undefined && !inputs.has(selected) && rows.add(1)) inputs.add(selected);
      };
      if (origin.kind === "value" && origin.projection.length === 0) {
        if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) {
          const selected = ast.is.IsPropertyAccessExpression(node) ? semantics.forNode(node).operations.propertyAccess(node)
            : semantics.forNode(node).operations.elementAccess(node);
          add(queries.subjectFor(selected?.receiver.expression));
        }
        if (ast.is.IsObjectLiteralExpression(node)) for (const property of ast.properties(node)) {
          if (!budget.step()) return undefined;
          add(queries.subject(property));
        }
        if (ast.is.IsArrayLiteralExpression(node)) {
          const file = queries.sourceFileFor(origin);
          const type = sourceStorageSubjectType(source, origin, file);
          if (file !== undefined && type !== undefined) for (const component of sourceStorageComponents(type, semantics.forFile(file))) {
            if (!budget.step()) return undefined;
            add(queries.subject(node, "value", [component]));
          }
        }
        if (ast.body(node) !== undefined || ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) {
          const captures = sourceLexicalCaptures(node, [node], ast, navigation);
          for (const capture of captures.captures) {
            if (!budget.step()) return undefined;
            add(queries.subjectFor(capture.declaration));
          }
          for (const receiver of captures.receivers) {
            if (!budget.step()) return undefined;
            add(queries.subject(receiver.owner, "receiver"));
          }
        }
      }
      if (invocation) {
        for (const candidate of queries.implementationsFor(node)) {
          if (!budget.step()) return undefined;
          const selected = queries.subject(candidate, "return", origin.projection);
          if (selected === undefined) continue;
          for (const input of queries.invocationOrigins(selected, candidate, node)) {
            if (!budget.step()) return undefined;
            add(input);
          }
        }
        const call = semantics.forNode(node).operations.call(node);
        add(queries.subjectFor(Node_Expression(ast, node)));
        add(queries.subjectFor(call?.sourceReceiver?.expression ?? call?.sourceCalleeAccess?.receiver.expression
          ?? semantics.forNode(node).operations.propertyAccess(node)?.receiver.expression));
        for (const input of queries.argumentsFor(node)) {
          if (!budget.step()) return undefined;
          add(queries.subjectFor(input));
        }
      }
      if (budget.failure() !== undefined) return undefined;
      selections.set(origin, inputs);
      complete = true;
      return inputs;
    } finally {
      if (!complete) rows.release();
    }
  };
}
