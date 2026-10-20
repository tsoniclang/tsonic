import type { Node, SourceFile } from "@tsonic/tsts";
import { Node_Expression, sourceLexicalCaptures, sourceReceiverOwner } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { sourceStorageComponents, sourceStorageSubjectType } from "../model/components.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageIncomingQuery } from "../graph/edges.js";
import type { SourceStorageInvocationInputQuery } from "../graph/invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
import { createSourceStorageContextApplications } from "./context-applications.js";
import type { SourceStorageContextLocation } from "../graph/context-locations.js";

interface SourceStorageContextInputQueries {
  readonly subject: SourceStorageSubjectQuery;
  readonly incomingFor: SourceStorageIncomingQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  sourceFileFor(subject: SourceStorageSubject): SourceFile | undefined;
  isInvocation(node: Node): boolean;
  implementationsFor(node: Node): ReadonlySet<Node>;
  readonly invocationInputs: SourceStorageInvocationInputQuery;
  locationFor(subject: SourceStorageSubject): SourceStorageContextLocation | undefined;
  ownerFor(node: Node): Node | undefined;
  argumentsFor(node: Node): readonly Node[];
}

export function createSourceStorageContextInputs(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  queries: SourceStorageContextInputQueries,
  graph: ReturnType<typeof createSourceStorageGraphQueries>,
) {
  const selections = new Map<SourceStorageSubject, ReadonlySet<SourceStorageSubject>>();
  const inputsFor = (origin: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined => {
    if (!budget.step()) return undefined;
    const cached = selections.get(origin);
    if (cached !== undefined) return cached;
    const { ast, navigation, semantics } = source;
    const node = origin.node;
    if ((origin.kind === "input" || origin.kind === "receiver") && origin.projection.length !== 0) {
      const owner = queries.subject(node, origin.kind);
      if (owner === undefined || !budget.row()) return undefined;
      const inputs = new Set([owner]);
      selections.set(origin, inputs);
      return inputs;
    }
    const invocation = queries.isInvocation(node);
    const access = origin.kind === "value" && (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node));
    const member = !access ? undefined : ast.is.IsPropertyAccessExpression(node)
      ? semantics.forNode(node).operations.propertyAccess(node) : semantics.forNode(node).operations.elementAccess(node);
    if (access && member === undefined) return undefined;
    const incoming = invocation || access ? undefined : queries.incomingFor(origin);
    const rows = budget.createRows();
    let complete = false;
    try {
      if (!rows.add(1)) return undefined;
      const inputs = new Set<SourceStorageSubject>();
      const add = (selected: SourceStorageSubject | undefined): void => {
        const input = selected !== undefined && (selected.kind === "input" || selected.kind === "receiver") &&
          selected.projection.length !== 0 ? queries.subject(selected.node, selected.kind) : selected;
        if (input !== undefined && !inputs.has(input) && rows.add(1)) inputs.add(input);
      };
      for (const input of incoming ?? []) {
        if (!budget.step()) return undefined;
        add(input);
      }
      if (member !== undefined) {
        const receiver = queries.subjectFor(member.receiver.expression);
        if (receiver === undefined) return undefined;
        add(receiver);
      }
      if (origin.kind === "value" && origin.projection.length === 0) {
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
          const captures = sourceLexicalCaptures(node, [node], ast, navigation, "source");
          for (const capture of captures.captures) {
            if (!budget.step()) return undefined;
            add(queries.subjectFor(capture.declaration));
          }
          for (const receiver of captures.receivers) {
            for (const reference of receiver.references) {
              if (!budget.step()) return undefined;
              const owner = sourceReceiverOwner(reference, ast, "storage", budget.step);
              if (owner === undefined) return undefined;
              add(queries.subject(owner, "receiver"));
            }
          }
        }
      }
      if (invocation) {
        const call = semantics.forNode(node).operations.call(node);
        add(queries.subjectFor(Node_Expression(ast, node)));
        add(queries.subjectFor(call?.sourceReceiver?.expression ?? call?.sourceCalleeAccess?.receiver.expression
          ?? semantics.forNode(node).operations.propertyAccess(node)?.receiver.expression));
      }
      if (budget.failure() !== undefined) return undefined;
      selections.set(origin, inputs);
      complete = true;
      return inputs;
    } finally {
      if (!complete) rows.release();
    }
  };
  const applicationFor = createSourceStorageContextApplications(source, budget, { ...queries, inputsFor }, graph);
  return Object.assign(inputsFor, { applicationFor });
}
