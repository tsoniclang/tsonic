import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import type { Node } from "@tsonic/tsts";
import { Node_Expression } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageCallbackEntry, SourceStorageUnresolved } from "../model/types.js";
import { sourceStorageSubjectType } from "../model/components.js";
import type { createSourceStorageExecutionRegions } from "../graph/execution-regions.js";
import type { createSourceStorageGraphQueries, SourceStorageReconciliation } from "../graph/graph-queries.js";
import { sourceConstructionExpression } from "../../../source-navigation/class-initialization.js";

interface SourceStorageRejectionQueries {
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
  callbackEntriesFor(invocation: Node): readonly SourceStorageCallbackEntry[];
  implementationsFor(invocation: Node): { readonly nodes: ReadonlySet<Node>; readonly exact: boolean } | undefined;
  invocationOrigins(origin: SourceStorageSubject, candidate: Node, invocation: Node): ReadonlySet<SourceStorageSubject> | undefined;
  readonly regions: ReturnType<typeof createSourceStorageExecutionRegions>;
  readonly graph: Pick<ReturnType<typeof createSourceStorageGraphQueries>, "read" | "query">;
  readonly thrownOrigins: ReadonlyMap<Node, ReadonlySet<SourceStorageSubject>>;
  readonly unresolvedThrows: ReadonlyMap<Node, string>;
  readonly unresolvedSubjects: Map<SourceStorageSubject, string>;
  readonly unresolvedInvocations: ReadonlyMap<Node, string>;
  isAccessorInvocation(node: Node): boolean;
  sealed(): boolean;
  subject(node: Node | undefined, kind: SourceStorageSubject["kind"]): SourceStorageSubject | undefined;
  enclosingCallable(node: Node): Node | undefined;
  connect(origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined): void;
  recordThrow(region: Node, subject: SourceStorageSubject): void;
  recordUnresolvedThrow(region: Node, reason: string): void;
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
      for (const region of queries.regions.callable(candidate, invocation)) {
        if (!budget.step()) return;
        queries.graph.read({ node: region, kind: queries.thrownOrigins });
        const reason = queries.unresolvedThrows.get(region);
        if (reason !== undefined) refuse(reason);
        for (const origin of queries.thrownOrigins.get(region) ?? []) {
          if (!budget.step()) return;
          add(origin, candidate, invocation);
        }
      }
    };
    const executor = (candidate: Node, invocation: Node, parameterIndex: number): void => {
      const parameters = sourceCallableValueParameters(ast, candidate, semantics.forNode(candidate), { kind: "declaration" });
      const parameter = parameters?.[parameterIndex];
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
  const rejected = queries.graph.query(forOperand);
  const receiverOriginsFor = (receiver: Node, formal: SourceStorageSubject): readonly SourceStorageSubject[] | undefined => {
    const selected = rejected(receiver);
    if (selected === undefined) return undefined;
    const origins: SourceStorageSubject[] = [];
    for (const value of selected) {
      if (!budget.step()) return undefined;
      if (value.kind === "unresolved") {
        if (!queries.sealed()) queries.unresolvedSubjects.set(formal, value.reason);
        return undefined;
      }
      origins.push(value);
    }
    return origins;
  };
  const operations = function* (nodes: readonly Node[], invocations: Iterable<Node>): Generator<SourceStorageReconciliation> {
    for (const invocation of invocations) yield () => {
      if (!budget.step()) return;
      const destination = queries.regions.catchDestination(invocation);
      const enclosing = destination === undefined ? queries.regions.enclosing(invocation) : undefined;
      const caught = destination === undefined ? undefined : queries.subject(destination, "input");
      const unresolved = (reason: string): void => {
        if (caught !== undefined) queries.unresolvedSubjects.set(caught, reason);
        else if (enclosing !== undefined) queries.recordUnresolvedThrow(enclosing, reason);
      };
      const reason = queries.unresolvedInvocations.get(invocation);
      if (reason !== undefined) { unresolved(reason); return; }
      const targets = [...queries.implementationsFor(invocation)?.nodes ?? []].map(candidate => ({ candidate,
        regions: queries.regions.callable(candidate, queries.isAccessorInvocation(invocation) ? undefined : invocation) }));
      if (sourceConstructionExpression(invocation, source, budget.step) !== undefined) {
        const instance = queries.regions.instance(invocation);
        if (instance === undefined) return;
        for (const region of instance.regions) targets.push({ candidate: region.owner, regions: [region.node] });
      }
      for (const target of targets) {
        if (ast.hasModifierKind(target.candidate, "async")) continue;
        for (const region of target.regions) {
          if (semantics.forNode(target.candidate).operations.generator(target.candidate) !== undefined && region === ast.body(target.candidate)) continue;
          queries.graph.read({ node: region, kind: queries.thrownOrigins });
          const reason = queries.unresolvedThrows.get(region);
          if (reason !== undefined) unresolved(reason);
          for (const origin of queries.thrownOrigins.get(region) ?? []) {
            const origins = queries.invocationOrigins(origin, target.candidate, invocation);
            if (origins === undefined) {
              unresolved("Thrown source storage requires completed original implementation input transport, not caller ABI correspondence alone.");
              continue;
            }
            for (const actual of origins) {
              if (destination !== undefined) queries.connect(actual, queries.subject(destination, "input"));
              else if (enclosing !== undefined) queries.recordThrow(enclosing, actual);
            }
          }
        }
      }
    };
    for (const node of nodes) {
      const owner = ast.is.IsReturnStatement(node) ? queries.enclosingCallable(node)
        : ast.is.IsArrowFunction(node) ? node : undefined;
      if (owner === undefined || !ast.hasModifierKind(owner, "async")) continue;
      const returned = ast.is.IsReturnStatement(node) ? Node_Expression(ast, node) : ast.body(owner);
      if (returned === undefined || ast.is.IsBlock(returned)) continue;
      yield () => {
        const selected = rejected(returned);
        const region = queries.regions.enclosing(returned);
        if (selected === undefined || region === undefined) return;
        for (const origin of selected) {
          if (!budget.step()) return;
          if (origin.kind === "unresolved") queries.recordUnresolvedThrow(region, origin.reason);
          else queries.recordThrow(region, origin);
        }
      };
    }
    for (const awaited of nodes) {
      if (!ast.is.IsAwaitExpression(awaited)) continue;
      yield () => {
        if (!budget.step()) return;
        const operand = Node_Expression(ast, awaited);
        if (operand === undefined) return;
        const selected = rejected(operand);
        if (selected === undefined) return;
        const caught = queries.regions.catchDestination(awaited);
        const destination = caught === undefined ? undefined : queries.subject(caught, "input");
        const enclosing = destination === undefined ? queries.regions.enclosing(awaited) : undefined;
        for (const origin of selected) {
          if (!budget.step()) return;
          if (origin.kind === "unresolved") {
            if (destination !== undefined) queries.unresolvedSubjects.set(destination, origin.reason);
            else if (enclosing !== undefined) queries.recordUnresolvedThrow(enclosing, origin.reason);
          } else if (destination !== undefined) queries.connect(origin, destination);
          else if (enclosing !== undefined) queries.recordThrow(enclosing, origin);
        }
      };
    }
  };
  return Object.freeze({ receiverOriginsFor, operations });
}
