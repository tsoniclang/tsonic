import type { SourceAnalysisProgram } from "../analysis-program.js";
import { sourceTypeDescriptorOpenness } from "../../source-semantics/local-type-flow/uses.js";
import type { Node } from "@tsonic/tsts";
import type { SourceNavigationCall } from "../../host-input/navigation.js";
import { isSourceCallableSignatureDeclaration } from "../../source-navigation/callable-boundaries.js";
import {
  sourceAnalysisArms, sourceAnalysisCallSignatures, sourceAnalysisIncludesNode, sourceAnalysisIsAbsentArm, sourceAnalysisValueType,
} from "../analysis-program.js";
import { Node_Initializer, sourceSuperConstructor } from "../../source-navigation/index.js";
import { sourceSingleCallValueArgument } from "../../source-navigation/callable-arguments.js";
import type { SourceCallArgumentCorrespondence } from "../../source-navigation/callable-arguments.js";
import type { SourceDeclarationFlowExecutionRegion, SourceFlowLimits } from "../flow/model.js";
import type { SourceDeclarationContinuationDependency, SourceDeclarationContinuationSelection,
  SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipUnresolved, SourceDeclarationPendingOperation } from "./model.js";
import { resolveSourceDeclarationContinuationFlow, type createSourceDeclarationOwnershipValues,
  type SourceDeclarationContinuationFlowSelection } from "./flow.js";
import type { createSourceDeclarationRetentionQuery } from "./retention.js";
import type { SourceDeclarationSuspensionQueries } from "./suspension.js";
import type { SourceDeclarationContinuationDependencyQueries } from "./dependencies.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";
import { createSourceCallArgumentCorrespondenceQuery } from "./call-arguments.js";

type SourceDeclaredArguments = ReadonlyMap<Node, readonly (Node | undefined)[]>;

// A continuation target: the callable or class whose body continues, keyed by its selected signature declaration
// (the class declaration for an implicit constructor).
interface SourceContinuationTarget {
  readonly declaration: Node;
  readonly signature: Node;
}

interface SourceContinuationConsumption extends SourceContinuationTarget {
  readonly call: Node;
  readonly pending: Set<SourceDeclarationPendingOperation>;
  readonly arguments: Map<Node, (Node | undefined)[]>;
}

export function createSourceDeclarationContinuationClosureQuery(input: {
  readonly source: SourceAnalysisProgram;
  readonly context: ReturnType<typeof createSourceDeclarationOwnershipValues>;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly retention: ReturnType<typeof createSourceDeclarationRetentionQuery>;
  readonly suspensions: SourceDeclarationSuspensionQueries;
  readonly dependencies: SourceDeclarationContinuationDependencyQueries;
  readonly limits: Partial<SourceFlowLimits>;
}) {
  const { source, budget } = input;
  const declarations = new Map<Node, SourceDeclarationContinuationFlowSelection>();
  const calls = new Map<Node, SourceDeclarationContinuationSelection>();
  const referenceDeclaration = (node: Node): Node | undefined => source.ast.is.IsParameterDeclaration(node)
    ? node : source.navigation.sourceReferenceFor(node)?.declaration;
  const argumentsFor = (node: Node, arguments_: SourceDeclaredArguments): readonly (Node | undefined)[] => {
    const declaration = referenceDeclaration(node);
    return declaration !== undefined && source.ast.is.IsParameterDeclaration(declaration)
      ? arguments_.get(declaration) ?? [node] : [node];
  };
  // Absence of a value from its Host descriptor arms (refused value: unknown presence).
  const absence = (node: Node): "absent" | "present" | "maybe" => {
    const selected = sourceAnalysisValueType(source, node);
    if (selected === undefined) return "maybe";
    const arms: ("absent" | "present" | "maybe")[] = [];
    for (const arm of sourceAnalysisArms(selected)) {
      if (!budget.step(node) || sourceTypeDescriptorOpenness(source.ast, arm) === "top") return "maybe";
      arms.push(sourceAnalysisIsAbsentArm(arm) ? "absent" : "present");
    }
    return arms.every(arm => arm === "absent") ? "absent" : arms.every(arm => arm === "present") ? "present" : "maybe";
  };
  const bind = (call: Node, selected: SourceNavigationCall, arguments_: SourceDeclaredArguments,
    correspondence: readonly SourceCallArgumentCorrespondence[] | undefined):
    SourceDeclaredArguments | SourceDeclarationOwnershipUnresolved => {
    const result = new Map(arguments_);
    if (correspondence === undefined) return sourceDeclarationOwnershipUnresolved(call,
      "A continuation needs the completed native spread-to-formal input relation.");
    for (const parameter of selected.parameters) {
      if (!budget.step(call)) break;
      const declaration = parameter.parameterDeclaration;
      if (declaration === undefined) continue;
      const actuals = correspondence.filter(row => row.parameter === parameter);
      const values: (Node | undefined)[] = [];
      for (const actual of actuals) {
        if (!budget.step(call)) break;
        const argument = actual.argument.expression;
        if (actual.binding.sourceForm !== "value")
          return sourceDeclarationOwnershipUnresolved(call,
            "A continuation needs the completed native spread-to-formal input relation.");
        for (const value of argumentsFor(argument, arguments_)) {
          if (!budget.step(call)) break;
          const present = value === undefined ? "absent" : absence(value);
          if (present !== "absent" && !values.includes(value)) values.push(value);
          if (present !== "present" && !values.includes(undefined)) values.push(undefined);
        }
      }
      if (actuals.length === 0) values.push(undefined);
      const initializer = Node_Initializer(source.ast, declaration);
      result.set(declaration, initializer === undefined ? values
        : values.flatMap(value => value === undefined ? [initializer] : [value]));
    }
    return result;
  };
  const enabled = (region: SourceDeclarationFlowExecutionRegion, arguments_: SourceDeclaredArguments): boolean => {
    if (region.role !== "parameter-initializer") return true;
    const parameter = source.ast.parent(region.root);
    const supplied = parameter === undefined ? undefined : arguments_.get(parameter);
    return supplied === undefined || supplied.some(value => value === region.root);
  };
  const targetsFor = (call: Node, selected: SourceNavigationCall, arguments_: SourceDeclaredArguments): readonly SourceContinuationTarget[] => {
    if (source.ast.is.IsCallExpression(call) && source.ast.kindName(selected.callee) === "KindSuperKeyword") {
      const superCall = sourceSuperConstructor(call, source, () => budget.step(call));
      const owner = superCall === undefined ? undefined : source.ast.parent(superCall.owner);
      if (owner === undefined) return [];
      const heritage = source.navigation.declaredHeritage(owner);
      if (heritage.kind === "unresolved") return [];
      const bases = heritage.edges.filter(edge => edge.kind === "extends");
      if (bases.length !== 1) return [];
      const base = bases[0]!.target.declaration;
      if (source.navigation.isProjectDeclaration(base) && !source.ast.hasModifierKind(base, "ambient"))
        return [{ declaration: base, signature: selected.signature ?? base }];
      const native = selected.signature;
      return native === undefined ? [] : [{ declaration: native, signature: native }];
    }
    if (source.ast.is.IsNewExpression(call)) {
      // The constructed class: the declaration of the construction's Host descriptor.
      const constructed = sourceAnalysisValueType(source, call);
      const declaration = constructed?.kind === "declared" ? constructed.declaration : undefined;
      if (declaration !== undefined && (source.ast.is.IsClassDeclaration(declaration) || source.ast.is.IsClassExpression(declaration)) &&
        source.navigation.isProjectDeclaration(declaration) && !source.ast.hasModifierKind(declaration, "ambient"))
        return [{ declaration, signature: selected.signature ?? declaration }];
    }
    const expression = selected.callee;
    const actuals = argumentsFor(expression, arguments_);
    const targets = new Map<Node, SourceContinuationTarget>();
    for (const actual of actuals) {
      if (!budget.step(call) || actual === undefined) continue;
      if (source.ast.is.IsArrowFunction(actual) || source.ast.is.IsFunctionExpression(actual)) {
        targets.set(actual, { declaration: actual, signature: actual });
        continue;
      }
      const type = sourceAnalysisValueType(source, actual);
      const parts = type === undefined ? [] : sourceAnalysisArms(type);
      if (parts.length > 1 || actual !== expression) {
        for (const part of parts) {
          if (!budget.step(call)) break;
          for (const signature of sourceAnalysisCallSignatures(part)) {
            const declaration = signature.declaration;
            if (declaration !== undefined) targets.set(declaration, { declaration, signature: declaration });
          }
        }
      } else {
        const declaration = selected.signature;
        if (declaration !== undefined) targets.set(declaration, { declaration, signature: declaration });
      }
    }
    return [...targets.values()];
  };
  const forDeclaration = (declaration: Node): SourceDeclarationContinuationFlowSelection | SourceDeclarationOwnershipUnresolved => {
    if (!budget.step(declaration)) return budget.failure()!;
    const existing = declarations.get(declaration);
    if (existing !== undefined) return existing;
    const graph = input.context.graphFor(declaration);
    if (graph.kind === "unresolved") return graph;
    const selected = resolveSourceDeclarationContinuationFlow({ source, graph: graph.graph,
      runtimeNodes: input.context.runtimeNodes, budget,
      suspensions: input.suspensions, dependencies: input.dependencies, limits: input.limits });
    if (selected.kind === "unresolved") return selected.cause.kind === "required-fact"
      ? Object.freeze({ ...selected, reason: `The declaration continuation requires its native contract: ${selected.reason}` }) : selected;
    const rows = budget.createRows(declaration);
    if (!rows.add(1)) { rows.release(); return budget.failure()!; }
    declarations.set(declaration, selected);
    return selected;
  };
  return Object.freeze({
    forDeclaration,
    forCall(call: Node): SourceDeclarationContinuationSelection {
      if (!budget.step(call)) return budget.failure()!;
      const existing = calls.get(call);
      if (existing !== undefined) return existing;
      if (!sourceAnalysisIncludesNode(source, call) ||
        !source.ast.is.IsCallExpression(call) && !source.ast.is.IsNewExpression(call))
        return sourceDeclarationOwnershipUnresolved(call, "A native continuation requires its original checked call operation.");
      const selected = source.navigation.call(call);
      const declaration = selected?.selection === "resolved" ? selected.signature : undefined;
      if (declaration === undefined)
        return sourceDeclarationOwnershipUnresolved(call, "A native continuation needs its exact selected declaration contract.");
      const pending = input.suspensions.forCall(call);
      if (pending.kind === "unresolved") return pending;
      const rows = budget.createRows(call);
      const workRows = budget.createRows(call);
      let published = false;
      try {
        const correspondenceFor = createSourceCallArgumentCorrespondenceQuery(source);
        const dependencies: SourceDeclarationContinuationDependency[] = [];
        const queue: SourceContinuationConsumption[] = [];
        const queued = new Set<SourceContinuationConsumption>();
        const consumers = new Map<Node, Map<Node, SourceContinuationConsumption>>();
        const append = (selection: SourceDeclarationContinuationSelection): SourceDeclarationOwnershipUnresolved | undefined => {
          if (selection.kind === "unresolved") return selection;
          for (const dependency of selection.dependencies) {
            if (!budget.step(dependency.reference)) return budget.failure();
            if (dependencies.some(existing => existing.candidate === dependency.candidate &&
              existing.reference === dependency.reference && existing.actual === dependency.actual &&
              existing.suspension === dependency.suspension && existing.retention === dependency.retention)) continue;
            if (!rows.add(1)) return budget.failure();
            dependencies.push(dependency);
          }
          return undefined;
        };
        const retainPending = (operation: Node, declaration: Node, witness: SourceDeclarationPendingOperation):
          SourceDeclarationOwnershipUnresolved | undefined => {
          const retained = input.retention.forReference(operation);
          if (retained.kind === "unresolved") return retained;
          for (const premise of retained.premises) {
            if (premise.kind === "retained" && premise.reason === "owned-value") continue;
            const problem = append({ kind: "resolved", dependencies: [Object.freeze({ candidate: declaration,
              reference: operation, actual: premise.value, suspension: witness, retention: premise })] });
            if (problem !== undefined) return problem;
          }
          return undefined;
        };
        const enqueue = (operation: Node, target: SourceContinuationTarget, state: ReadonlySet<SourceDeclarationPendingOperation>,
          arguments_: SourceDeclaredArguments): boolean => {
          if (!budget.step(operation)) return false;
          const owners = consumers.get(operation) ?? new Map<Node, SourceContinuationConsumption>();
          consumers.set(operation, owners);
          let consumer = owners.get(target.signature);
          let changed = consumer === undefined;
          if (consumer === undefined) {
            if (!workRows.add(2)) return false;
            consumer = { call: operation, ...target, pending: new Set(), arguments: new Map() };
            owners.set(target.signature, consumer);
          }
          for (const witness of state) {
            if (!budget.step(operation)) return false;
            if (!consumer.pending.has(witness)) {
              if (!workRows.add(1)) return false;
              consumer.pending.add(witness);
              changed = true;
            }
          }
          for (const [formal, actuals] of arguments_) {
            if (!budget.step(operation)) return false;
            const existing = consumer.arguments.get(formal) ?? [];
            for (const actual of actuals) if (!existing.includes(actual)) {
              if (!budget.step(operation) || !workRows.add(1)) return false;
              existing.push(actual);
              changed = true;
            }
            consumer.arguments.set(formal, existing);
          }
          if (changed && !queued.has(consumer)) { queue.push(consumer); queued.add(consumer); }
          return true;
        };
        const rootArguments = bind(call, selected!, new Map(), correspondenceFor(call));
        if ("kind" in rootArguments) return rootArguments;
        const rootTargets = targetsFor(call, selected!, new Map());
        if (rootTargets.length === 0)
          return budget.failure() ?? sourceDeclarationOwnershipUnresolved(call, "A continuation requires its complete selected callable contract.");
        for (const target of rootTargets) {
          if (!enqueue(call, target, new Set(), rootArguments)) return budget.failure()!;
        }
        while (queue.length !== 0) {
          if (!budget.step(call)) return budget.failure()!;
          const consumer = queue.shift()!;
          queued.delete(consumer);
          const hasBody = source.ast.body(consumer.declaration) !== undefined ||
            source.ast.is.IsClassDeclaration(consumer.declaration) || source.ast.is.IsClassExpression(consumer.declaration);
          if (!source.navigation.isProjectDeclaration(consumer.declaration) || !hasBody) {
            const native = input.suspensions.forCall(consumer.call);
            if (native.kind === "unresolved") return native;
            // A native callable alternative: its selected signature declaration is its declaration and has a Host result.
            const nativeDeclaration = consumer.signature;
            const nativeOutput = nativeDeclaration === consumer.declaration &&
              isSourceCallableSignatureDeclaration(source.ast, nativeDeclaration)
              ? source.facts.values.callableReturn(nativeDeclaration) : undefined;
            if (nativeOutput === undefined || nativeOutput.kind === "refused")
              return sourceDeclarationOwnershipUnresolved(consumer.call,
                "A callable alternative requires its complete selected native body contracts.");
            if (native.kind === "resolved") {
              const problem = retainPending(consumer.call, nativeDeclaration, native.pending);
              if (problem !== undefined) return problem;
            }
            continue;
          }
          const summary = forDeclaration(consumer.declaration);
          if (summary.kind === "unresolved") return summary.cause.kind === "required-fact" &&
            (source.ast.is.IsClassDeclaration(consumer.declaration) || source.ast.is.IsClassExpression(consumer.declaration))
            ? Object.freeze({ ...summary, reason: `Construction requires its complete native body contracts: ${summary.reason}` }) : summary;
          for (const read of summary.reads) {
            if (!budget.step(read.reference)) return budget.failure()!;
            if (!enabled(read.region, consumer.arguments)) continue;
            const state = new Set([...consumer.pending, ...read.pending]);
            for (const reference of argumentsFor(read.reference, consumer.arguments)) {
              if (reference === undefined) continue;
              const selection = input.dependencies.forRead(state, reference, read.candidate);
              if (selection.kind === "unresolved") return selection;
              const appendRead = (selection: SourceDeclarationContinuationSelection) => append(selection.kind === "unresolved" ? selection : {
                kind: "resolved", dependencies: selection.dependencies.map(dependency =>
                  dependency.reference === read.reference ? dependency : Object.freeze({ ...dependency, reference: read.reference })),
              });
              for (const dependency of selection.dependencies) {
                if (!budget.step(reference)) return budget.failure()!;
                const premise = dependency.retention;
                const node = premise.value.node;
                if (premise.kind !== "formal-borrowed" || premise.region.kind !== "input-duration" ||
                  !source.ast.is.IsCallExpression(node) && !source.ast.is.IsNewExpression(node)) {
                  const problem = appendRead({ kind: "resolved", dependencies: [dependency] });
                  if (problem !== undefined) return problem;
                  continue;
                }
                const parameterDeclaration = premise.region.parameter;
                const operation = source.navigation.call(node);
                if (operation?.selection !== "resolved" || operation.signature !== premise.executionOwner)
                  return sourceDeclarationOwnershipUnresolved(node,
                    "A pending native continuation requires its exact selected input-duration correspondence.");
                const argument = sourceSingleCallValueArgument(correspondenceFor(node), parameterDeclaration);
                if (argument === undefined) return sourceDeclarationOwnershipUnresolved(node,
                  "A pending native continuation requires its exact selected input-duration correspondence.");
                const actuals = argumentsFor(argument, consumer.arguments);
                if (actuals.length === 0)
                  return sourceDeclarationOwnershipUnresolved(node,
                    "A pending native continuation requires every completed original caller input.");
                for (const actual of actuals) {
                  if (actual === undefined) return sourceDeclarationOwnershipUnresolved(node,
                    "A pending native continuation requires every completed original caller input.");
                  if (!budget.step(actual)) return budget.failure()!;
                  const completed = input.dependencies.forRead(new Set([dependency.suspension]), actual, read.candidate);
                  const problem = appendRead(completed);
                  if (problem !== undefined) return problem;
                }
              }
            }
          }
          for (const operation of summary.calls) {
            if (!budget.step(operation.call)) return budget.failure()!;
            if (!enabled(operation.region, consumer.arguments)) continue;
            const invocation = source.navigation.call(operation.call);
            if (invocation?.selection !== "resolved")
              return sourceDeclarationOwnershipUnresolved(operation.call, "A continuation call needs its complete selected native contract.");
            const state = new Set([...consumer.pending, ...operation.pending]);
            const arguments_ = bind(operation.call, invocation, consumer.arguments, correspondenceFor(operation.call));
            if ("kind" in arguments_) return arguments_;
            const targets = targetsFor(operation.call, invocation, consumer.arguments);
            if (targets.length === 0)
              return budget.failure() ?? sourceDeclarationOwnershipUnresolved(operation.call,
                "A continuation requires every selected callable and native constructor contract.");
            for (const target of targets) {
              if (!enqueue(operation.call, target, state, arguments_)) return budget.failure()!;
            }
          }
        }
        if (pending.kind === "resolved") {
          const problem = retainPending(call, declaration, pending.pending);
          if (problem !== undefined) return problem;
        }
        if (!rows.add(1)) return budget.failure()!;
        const result = Object.freeze({ kind: "resolved" as const, dependencies: Object.freeze(dependencies) });
        calls.set(call, result);
        published = true;
        return result;
      } finally { workRows.release(); if (!published) rows.release(); }
    },
  });
}
