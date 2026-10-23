import type { Node } from "@tsonic/tsts";
import { Node_Expression } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageCallbackEntry, SourceStorageUnresolved } from "../model/types.js";
import { sourceStorageSubjectType } from "../model/components.js";

interface SourceStorageRejectionQueries {
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
  callbackEntriesFor(invocation: Node): readonly SourceStorageCallbackEntry[];
  implementationsFor(invocation: Node): { readonly nodes: ReadonlySet<Node>; readonly exact: boolean } | undefined;
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
    const type = selected === undefined ? undefined : sourceStorageSubjectType(source, selected);
    const types = semantics.forNode(operand).types;
    const awaited = type === undefined ? undefined : types.awaitedType(type);
    if (type !== undefined && awaited !== undefined && !types.isAny(type) && !types.isUnknown(type) &&
      !types.couldContainTypeVariables(type) && types.isIdentical(type, awaited)) return origins;
    const producers = selected === undefined ? undefined : queries.originsFor(selected);
    if (producers === undefined) refuse("Awaited rejection storage requires a completed checked value origin.");
    let produced = false;
    for (const producer of producers ?? []) {
      if (!budget.step()) break;
      produced = true;
      const invocation = producer.node;
      if (producer.kind !== "value" || producer.projection.length !== 0 ||
        !ast.is.IsCallExpression(invocation) && !ast.is.IsNewExpression(invocation)) {
        refuse("Awaited rejection storage has an original value without a completed checked rejection channel.");
        continue;
      }
      let handled = false;
      for (const entry of queries.callbackEntriesFor(invocation)) {
        if (!budget.step()) break;
        if (entry.rejection === undefined) continue;
        handled = true;
        const candidates = queries.originsFor(entry.argument.actual);
        let supplied = false;
        for (const original of candidates ?? []) {
          if (!budget.step()) break;
          supplied = true;
          const candidate = navigation.callableImplementation(original.node);
          if (original.kind !== "value" || original.projection.length !== 0 || candidate.kind !== "resolved" ||
            ast.body(candidate.implementation.declaration) === undefined) {
            refuse("A rejection channel requires every original executor to have its exact checked implementation.");
            continue;
          }
          executor(candidate.implementation.declaration, invocation, entry.rejection);
        }
        if (!supplied) refuse("A rejection channel requires its checked executor implementation.");
      }
      const implementations = queries.implementationsFor(invocation);
      for (const candidate of implementations?.nodes ?? []) {
        if (!budget.step()) break;
        if (!ast.hasModifierKind(candidate, "async")) continue;
        handled = true;
        thrown(candidate, invocation);
      }
      if (!handled || implementations?.exact !== true && !queries.callbackEntriesFor(invocation).some(entry => entry.rejection !== undefined))
        refuse("Awaited rejection storage requires a completed rejection channel for every original producer.");
    }
    if (!produced) refuse("Awaited rejection storage has no completed original rejection-channel producer.");
    if (reason !== undefined) origins.add(Object.freeze({ kind: "unresolved", reason }));
    return origins;
  });
  return Object.freeze({ forOperand });
}
