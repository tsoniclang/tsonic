import type { Node } from "@tsonic/tsts";
import { Node_Expression } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageCallbackEntry, SourceStorageUnresolved } from "../model/types.js";

interface SourceStorageRejectionQueries {
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
  callbackEntriesFor(invocation: Node): readonly SourceStorageCallbackEntry[];
  callbackImplementationsFor(entry: SourceStorageCallbackEntry): ReadonlySet<Node>;
  implementationsFor(invocation: Node): ReadonlySet<Node>;
  invocationOrigins(origin: SourceStorageSubject, candidate: Node, invocation: Node): ReadonlySet<SourceStorageSubject> | undefined;
  throwsFor(candidate: Node, invocation: Node): {
    readonly origins: readonly SourceStorageSubject[];
    readonly reason: string | undefined;
  };
}

export function createSourceStorageRejections(source: TargetSourceProgram, budget: SourceStorageBudget,
  queries: SourceStorageRejectionQueries) {
  const { ast, navigation, semantics } = source;
  const forOperand = (operand: Node): ReadonlySet<SourceStorageSubject | SourceStorageUnresolved> => budget.withRows(rows => {
    const origins = new Set<SourceStorageSubject | SourceStorageUnresolved>();
    let reason: string | undefined;
    const refuse = (message: string): void => { reason ??= message; };
    const add = (origin: SourceStorageSubject, candidate: Node, invocation: Node): void => {
      const selected = queries.invocationOrigins(origin, candidate, invocation);
      if (selected === undefined) {
        refuse("Awaited rejection storage requires completed checked implementation input transport.");
        return;
      }
      for (const actual of selected) {
        if (!budget.step() || origins.has(actual)) continue;
        if (!rows.add(1)) return;
        origins.add(actual);
      }
    };
    const thrown = (candidate: Node, invocation: Node): void => {
      const selected = queries.throwsFor(candidate, invocation);
      if (selected.reason !== undefined) refuse(selected.reason);
      for (const origin of selected.origins) {
        if (!budget.step()) return;
        add(origin, candidate, invocation);
      }
    };
    const executor = (candidate: Node, invocation: Node, parameterIndex: number): void => {
      const parameter = ast.parameters(candidate)[parameterIndex];
      if (parameter === undefined) {
        refuse("A rejection channel requires its exact checked executor parameter.");
        return;
      }
      const uses = navigation.declarationUseSummary(parameter);
      if (uses.bindingWritten || uses.exported || uses.hasUnclassifiedValueUse) {
        refuse("A rejection channel requires an unmodified, nonescaping executor parameter.");
        return;
      }
      for (const use of uses.uses) {
        if (!budget.step()) return;
        if (use.kind === "type-only" || use.kind === "source-linkage") continue;
        let reference = use.reference;
        let parent = ast.parent(reference);
        while (parent !== undefined && (ast.is.IsParenthesizedExpression(parent) || ast.is.IsNonNullExpression(parent) ||
          ast.is.IsAsExpression(parent) || ast.is.IsSatisfiesExpression(parent) || ast.is.IsTypeAssertion(parent))) {
          if (!budget.step()) return;
          reference = parent;
          parent = ast.parent(reference);
        }
        if (use.kind !== "direct-call" || parent === undefined || !ast.is.IsCallExpression(parent) ||
          Node_Expression(ast, parent) !== reference) {
          refuse("A rejection channel cannot prove a rejection parameter that escapes direct checked invocation.");
          continue;
        }
        const call = semantics.forNode(parent).operations.call(parent);
        const bindings = call?.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === 0);
        const binding = bindings?.length === 1 ? bindings[0] : undefined;
        const expression = binding?.sourceForm === "value" && binding.sourceParameterForm === "parameter"
          ? call?.sourceArguments[binding.sourceArgumentIndex]?.expression : undefined;
        const rejected = queries.subjectFor(expression);
        if (rejected === undefined) {
          refuse("A rejection channel requires its exact checked scalar rejection argument.");
          continue;
        }
        add(rejected, candidate, invocation);
      }
      thrown(candidate, invocation);
    };
    const selected = queries.subjectFor(operand);
    const producers = selected === undefined ? undefined : queries.originsFor(selected);
    if (producers === undefined) refuse("Awaited rejection storage requires a completed checked value origin.");
    for (const producer of producers ?? []) {
      if (!budget.step()) break;
      const invocation = producer.node;
      if (producer.kind !== "value" || producer.projection.length !== 0 ||
        !ast.is.IsCallExpression(invocation) && !ast.is.IsNewExpression(invocation)) continue;
      for (const entry of queries.callbackEntriesFor(invocation)) {
        if (!budget.step()) break;
        if (entry.rejection === undefined) continue;
        const candidates = queries.callbackImplementationsFor(entry);
        if (candidates.size === 0) refuse("A rejection channel requires its checked executor implementation.");
        for (const candidate of candidates) {
          if (!budget.step()) break;
          executor(candidate, invocation, entry.rejection);
        }
      }
      for (const candidate of queries.implementationsFor(invocation)) {
        if (!budget.step()) break;
        if (!ast.hasModifierKind(candidate, "async")) continue;
        thrown(candidate, invocation);
      }
    }
    if (reason !== undefined) origins.add(Object.freeze({ kind: "unresolved", reason }));
    return origins;
  });
  return Object.freeze({ forOperand });
}
