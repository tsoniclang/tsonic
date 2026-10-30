import type { Node, Type } from "@tsonic/tsts";
import { Node_Initializer, sourceSuperConstructor } from "../../source-navigation/index.js";
import type { ResolvedSourceCallInfo } from "../../source-semantics/call-result-selection.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceDeclarationFlowExecutionRegion, SourceFlowLimits } from "../flow/model.js";
import type { SourceDeclarationContinuationDependency, SourceDeclarationContinuationSelection,
  SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipUnresolved, SourceDeclarationPendingOperation } from "./model.js";
import { resolveSourceDeclarationContinuationFlow, type createSourceDeclarationOwnershipValues,
  type SourceDeclarationContinuationFlowSelection } from "./flow.js";
import type { createSourceDeclarationRetentionQuery } from "./retention.js";
import type { SourceDeclarationSuspensionQueries } from "./suspension.js";
import type { SourceDeclarationContinuationDependencyQueries } from "./dependencies.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";

type SourceDeclaredArguments = ReadonlyMap<Node, readonly (Node | undefined)[]>;

interface SourceContinuationConsumption {
  readonly call: Node;
  readonly declaration: Node;
  readonly pending: Set<SourceDeclarationPendingOperation>;
  readonly arguments: Map<Node, (Node | undefined)[]>;
}

export function createSourceDeclarationContinuationClosureQuery(input: {
  readonly source: TargetSourceProgram;
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
  const absence = (node: Node): "absent" | "present" | "maybe" => {
    const types = source.semantics.forNode(node).types;
    const selected = types.expressionType(node);
    const visit = (type: Type): "absent" | "present" | "maybe" => {
      if (!budget.step(node) || types.isAny(type) || types.isUnknown(type)) return "maybe";
      if (types.isUnion(type)) {
        const members = types.unionOrIntersectionTypes(type).map(visit);
        return members.every(member => member === "absent") ? "absent"
          : members.every(member => member === "present") ? "present" : "maybe";
      }
      return types.isNullish(type) || types.isVoidLike(type) ? "absent" : "present";
    };
    return selected === undefined ? "maybe" : visit(selected);
  };
  const bind = (call: Node, selected: ResolvedSourceCallInfo, arguments_: SourceDeclaredArguments):
    SourceDeclaredArguments | SourceDeclarationOwnershipUnresolved => {
    const result = new Map(arguments_);
    for (const parameter of selected.sourceSelectedSignatureParameters) {
      if (!budget.step(call)) break;
      const declaration = parameter.parameterDeclaration;
      if (declaration === undefined) continue;
      const actuals = selected.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === parameter.parameterIndex);
      const values: (Node | undefined)[] = [];
      for (const actual of actuals) {
        if (!budget.step(call)) break;
        const argument = source.ast.arguments(call)[actual.sourceArgumentIndex];
        if (actual.sourceForm !== "value" || argument === undefined)
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
  const targetsFor = (call: Node, selected: ResolvedSourceCallInfo, arguments_: SourceDeclaredArguments): readonly Node[] => {
    const semantics = source.semantics.forNode(call);
    if (source.ast.is.IsCallExpression(call) && source.ast.kindName(selected.sourceCallee.expression) === "KindSuperKeyword") {
      const superCall = sourceSuperConstructor(call, source, () => budget.step(call));
      const owner = superCall === undefined ? undefined : source.ast.parent(superCall.owner);
      if (owner === undefined) return [];
      const heritage = source.navigation.declaredHeritage(owner);
      if (heritage.kind === "unresolved") return [];
      const bases = heritage.edges.filter(edge => edge.kind === "extends");
      return bases.length === 1 ? [bases[0]!.target.declaration] : [];
    }
    if (source.ast.is.IsNewExpression(call)) {
      const symbol = semantics.declarations.typeSymbol(selected.sourceResultType);
      const classes = symbol === undefined ? [] : semantics.declarations.symbolDeclarations(symbol).filter(declaration =>
        source.ast.is.IsClassDeclaration(declaration) || source.ast.is.IsClassExpression(declaration));
      if (classes.length === 1) return classes;
    }
    const expression = selected.sourceCallee.expression;
    const actuals = argumentsFor(expression, arguments_);
    const targets = new Set<Node>();
    for (const actual of actuals) {
      if (!budget.step(call) || actual === undefined) continue;
      if (source.ast.is.IsArrowFunction(actual) || source.ast.is.IsFunctionExpression(actual)) {
        targets.add(actual);
        continue;
      }
      const actualSemantics = source.semantics.forNode(actual);
      const type = actualSemantics.types.expressionType(actual);
      const parts = type !== undefined && actualSemantics.types.isUnion(type)
        ? actualSemantics.types.unionOrIntersectionTypes(type) : [];
      if (parts.length !== 0 || actual !== expression) {
        for (const part of parts.length === 0 && type !== undefined ? [type] : parts) {
          if (!budget.step(call)) break;
          for (const signature of actualSemantics.types.callSignatures(part)) {
            const declaration = actualSemantics.declarations.signatureDeclaration(signature);
            if (declaration !== undefined) targets.add(declaration);
          }
        }
      } else {
        const declaration = semantics.declarations.signatureDeclaration(selected.selectedSignature);
        if (declaration !== undefined) targets.add(declaration);
      }
    }
    return [...targets];
  };
  const forDeclaration = (declaration: Node): SourceDeclarationContinuationFlowSelection | SourceDeclarationOwnershipUnresolved => {
    if (!budget.step(declaration)) return budget.failure()!;
    const existing = declarations.get(declaration);
    if (existing !== undefined) return existing;
    const graph = input.context.graphFor(declaration);
    if (graph.kind === "unresolved") return graph;
    const selected = resolveSourceDeclarationContinuationFlow({ source, graph: graph.graph, budget,
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
      const file = source.ast.getSourceFile(call);
      if (file === undefined || !source.semantics.includes(file) ||
        !source.ast.is.IsCallExpression(call) && !source.ast.is.IsNewExpression(call))
        return sourceDeclarationOwnershipUnresolved(call, "A native continuation requires its original checked call operation.");
      const semantics = source.semantics.forNode(call);
      const selected = semantics.operations.call(call);
      const declaration = selected?.sourceSelectedSignatureKind === "resolved"
        ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
      if (declaration === undefined)
        return sourceDeclarationOwnershipUnresolved(call, "A native continuation needs its exact selected declaration contract.");
      const pending = input.suspensions.forCall(call);
      if (pending.kind === "unresolved") return pending;
      const rows = budget.createRows(call);
      const workRows = budget.createRows(call);
      let published = false;
      try {
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
        const enqueue = (operation: Node, owner: Node, state: ReadonlySet<SourceDeclarationPendingOperation>,
          arguments_: SourceDeclaredArguments): boolean => {
          if (!budget.step(operation)) return false;
          const owners = consumers.get(operation) ?? new Map<Node, SourceContinuationConsumption>();
          consumers.set(operation, owners);
          let consumer = owners.get(owner);
          let changed = consumer === undefined;
          if (consumer === undefined) {
            if (!workRows.add(2)) return false;
            consumer = { call: operation, declaration: owner, pending: new Set(), arguments: new Map() };
            owners.set(owner, consumer);
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
        const rootArguments = bind(call, selected!, new Map());
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
            const nativeCall = source.semantics.forNode(consumer.call).operations.call(consumer.call);
            const nativeDeclaration = nativeCall?.sourceSelectedSignatureKind === "resolved"
              ? source.semantics.forNode(consumer.call).declarations.signatureDeclaration(nativeCall.selectedSignature) : undefined;
            if (nativeDeclaration !== consumer.declaration)
              return sourceDeclarationOwnershipUnresolved(consumer.call,
                "A callable alternative requires its complete selected native body contracts.");
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
              const problem = append(selection.kind === "unresolved" ? selection : {
                kind: "resolved", dependencies: selection.dependencies.map(dependency =>
                  dependency.reference === read.reference ? dependency : Object.freeze({ ...dependency, reference: read.reference })),
              });
              if (problem !== undefined) return problem;
            }
          }
          for (const operation of summary.calls) {
            if (!budget.step(operation.call)) return budget.failure()!;
            if (!enabled(operation.region, consumer.arguments)) continue;
            const semantics = source.semantics.forNode(operation.call);
            const invocation = semantics.operations.call(operation.call);
            if (invocation?.sourceSelectedSignatureKind !== "resolved")
              return sourceDeclarationOwnershipUnresolved(operation.call, "A continuation call needs its complete selected native contract.");
            const state = new Set([...consumer.pending, ...operation.pending]);
            const arguments_ = bind(operation.call, invocation, consumer.arguments);
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
          const retained = input.retention.forReference(call);
          if (retained.kind === "unresolved") return retained;
          for (const premise of retained.premises) {
            if (premise.kind === "retained" && premise.reason === "owned-value") continue;
            if (!budget.step(call) || !rows.add(1)) return budget.failure()!;
            dependencies.push(Object.freeze({ candidate: declaration, reference: call, actual: premise.value,
              suspension: pending.pending, retention: premise }));
          }
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
