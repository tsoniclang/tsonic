import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import { sourceStorageFormalOwner } from "../source-storage/model/subjects.js";
import { sourceStorageRegionOwner } from "../source-storage/graph/lexical-regions.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceOwnershipBudget, SourceOwnershipPremises, SourceRetentionPremise, SourceRetentionQueries, SourceRetentionReadSelection, SourceRetentionSelection, SourceCallableRetentionSelection } from "./model.js";
import { sourceOwnershipContractProblem, sourceOwnershipUnresolved } from "./contracts.js";
import { resolveSourceAsyncResultDisposition } from "./result-use.js";
import { sourceEnclosingCallable, sourceExpressionCallArgument, sourceExpressionResultDisposition,
  sourceImmediatelyAwaitedLocal, sourceTransparentExpressionOperand, Node_Expression } from "../../source-navigation/index.js";

export function createSourceCallableRetentionQuery(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly budget: SourceOwnershipBudget;
}) {
  const { source, storage, budget } = input;
  if (source !== storage.source) throw new Error("Callable retention and storage require the identical checked source program.");
  const { ast, navigation, semantics } = source;
  const cache = new Map<Node, SourceCallableRetentionSelection>();
  const retainedRows = budget.createRows();
  return Object.freeze({
    forDeclaration(declaration: Node): SourceCallableRetentionSelection {
      const existing = cache.get(declaration);
      if (existing !== undefined) return existing;
      const selected = storage.subjectFor(declaration);
      if (selected.kind === "unresolved") return sourceOwnershipUnresolved(declaration, selected.reason);
      if (semantics.forNode(declaration).types.declarationSignatureInfo(declaration) === undefined || ast.body(declaration) === undefined)
        return sourceOwnershipUnresolved(declaration, "Callable retention requires its original checked source implementation.");
      const originRegion = storage.enclosingRegionFor(declaration);
      if (originRegion === undefined)
        return sourceOwnershipUnresolved(declaration, "Callable retention requires its original checked creation region.");
      const originOwner = sourceStorageRegionOwner(ast, originRegion);
      const initial = storage.bindingsForLexicalOwner(originOwner ?? originRegion);
      if (initial.kind === "unresolved") return sourceOwnershipUnresolved(declaration, initial.reason);
      const rows = budget.createRows();
      try {
        const pending = [{ node: declaration, bindings: initial.bindings }];
        const visited = new Map<Node, Set<SourceStorageBindings>>();
        const deferredUses = new Map<Node, Set<SourceStorageBindings>>();
        const witnesses: Node[] = [];
        let reason: string | undefined;
        let retained = false;
        let observed = false;
        const enqueue = (node: Node, bindings: SourceStorageBindings): void => { if (rows.add(1)) pending.push({ node, bindings }); };
        const escaped = (node: Node): void => { retained = true; if (rows.add(1)) witnesses.push(node); };
        const observeDeferred = (node: Node, bindings: SourceStorageBindings, generator: boolean): void => {
          const checked = deferredUses.get(node);
          if (checked?.has(bindings)) return;
          if (!rows.add(checked === undefined ? 3 : 1)) return;
          if (checked === undefined) deferredUses.set(node, new Set([bindings]));
          else checked.add(bindings);
          const values = [{ node, bindings }];
          const visited = new Map<Node, Set<SourceStorageBindings>>();
          while (values.length !== 0 && budget.step()) {
            const current = values.pop()!;
            const known = visited.get(current.node);
            if (known?.has(current.bindings)) {
              reason ??= "A deferred activation has a cyclic or unclosed source result lifetime.";
              continue;
            }
            if (!rows.add(known === undefined ? 3 : 1)) return;
            if (known === undefined) visited.set(current.node, new Set([current.bindings]));
            else known.add(current.bindings);
            const disposition = resolveSourceAsyncResultDisposition(source, storage, current.node, budget, current.bindings);
            if (disposition.kind === "unresolved") { reason ??= disposition.reason; continue; }
            if (!generator && (disposition.kind === "awaited-in-scope" || sourceImmediatelyAwaitedLocal(ast, navigation, current.node))) continue;
            if (disposition.kind === "discarded") { if (!generator) escaped(current.node); continue; }
            if (disposition.kind === "returned") {
              const owner = sourceEnclosingCallable(current.node, ast);
              if (owner !== undefined && owner === originOwner) { escaped(current.node); continue; }
              const activations = owner === undefined ? undefined : storage.boundActivationsFor(owner, current.bindings);
              if (activations === undefined || activations.kind === "unresolved" || activations.activations.length === 0) {
                reason ??= activations?.kind === "unresolved" ? activations.reason
                  : "A returned deferred activation requires its original receiving caller lifetime.";
                continue;
              }
              for (const activation of activations.activations) {
                if (!budget.step()) return;
                if (activation.kind !== "invocation") {
                  reason ??= "A deferred result crosses an unchecked or externally entered source activation.";
                } else if (rows.add(1)) values.push({ node: activation.invocation, bindings: activation.callerBindings });
              }
              continue;
            }
            const flow = navigation.expressionValueFlow(current.node);
            if (flow.exported || flow.yielded || flow.storedOutsideBinding) escaped(current.node);
            else reason ??= "A deferred activation is not proven to complete within its original caller.";
          }
        };
        while (pending.length !== 0) {
          if (!budget.step()) return sourceOwnershipUnresolved(declaration, budget.failure()!);
          const { node: current, bindings } = pending.pop()!;
          const known = visited.get(current);
          if (known?.has(bindings)) continue;
          if (!rows.add(known === undefined ? 3 : 1)) return sourceOwnershipUnresolved(declaration, budget.failure()!);
          if (known === undefined) visited.set(current, new Set([bindings]));
          else known.add(bindings);
          const expression = ast.is.IsArrowFunction(current) || ast.is.IsFunctionExpression(current);
          const flow = expression ? navigation.expressionValueFlow(current) : undefined;
          const summary = ast.is.IsParameterDeclaration(current) ? navigation.parameterUseSummary(current)
            : expression ? undefined : navigation.declarationUseSummary(current);
          const uses = flow?.uses ?? summary?.uses;
          if (uses === undefined) { reason ??= "A retained callable use has no completed checked source-use summary."; continue; }
          if (ast.is.IsParameterDeclaration(current)) {
            const formal = storage.subject(current, "input");
            if (formal.kind === "unresolved") reason ??= formal.reason;
            const owner = formal.kind === "resolved" ? sourceStorageFormalOwner(formal.subject, ast) : undefined;
            if (owner !== undefined && (ast.hasModifierKind(owner, "async") || semantics.forNode(owner).operations.generator(owner) !== undefined)) {
              const activations = storage.boundActivationsFor(owner, bindings);
              if (activations.kind === "unresolved" || activations.activations.length === 0)
                reason ??= activations.kind === "unresolved" ? activations.reason : "A used deferred formal requires its exact receiving activation.";
              else for (const activation of activations.activations) {
                if (!budget.step()) return sourceOwnershipUnresolved(declaration, budget.failure()!);
                if (activation.kind === "invocation") observeDeferred(activation.invocation, activation.callerBindings,
                  semantics.forNode(owner).operations.generator(owner) !== undefined);
                else reason ??= "A used deferred formal has no checked receiving invocation lifetime.";
              }
            }
          }
          if (flow?.exported || summary?.exported) escaped(current);
          if (summary?.bindingWritten || flow?.hasUnclassifiedUse || summary?.hasUnclassifiedValueUse)
            reason ??= "Callable retention requires complete unmodified source value uses.";
          if (ast.is.IsParameterDeclaration(current) && summary?.escapeKinds.includes("storage") &&
            summary.uses.every(use => use.role !== "storage")) escaped(current);
          for (const use of uses) {
            if (!budget.step()) return sourceOwnershipUnresolved(declaration, budget.failure()!);
            if (use.kind === "type-only" || use.role === "type-only" || use.kind === "source-linkage") continue;
            observed = true;
            if (use.captured) {
              const capture = sourceEnclosingCallable(use.reference, ast);
              if (capture === undefined) reason ??= "A captured callable requires its original checked retaining callable.";
              else {
                const selected = storage.bindingsForDeclaration(capture, bindings);
                if (selected.kind === "unresolved") reason ??= selected.reason;
                else enqueue(capture, selected.bindings);
              }
            }
            if (use.role === "return" || use.role === "yield") { escaped(use.reference); continue; }
            if (use.role === "storage") {
              const destination = sourceExpressionResultDisposition(ast, use.reference);
              if (destination.kind === "stored" && ast.is.IsVariableDeclaration(destination.use) &&
                ast.variableDeclarationKind(destination.use) === "const") enqueue(destination.use, bindings);
              else escaped(use.reference);
              continue;
            }
            if (use.role === "argument") {
              const argument = sourceExpressionCallArgument(use.reference, source);
              if (argument === undefined) { reason ??= "A forwarded callable requires its exact checked scalar argument."; continue; }
              const transports = storage.argumentTransportsFor(argument.call);
              if (transports.kind !== "resolved") { reason ??= transports.kind === "unresolved" ? transports.reason
                : "An unchecked callable argument has an open retention boundary."; continue; }
              const actuals = transports.arguments.filter(transport => transport.binding.sourceArgumentIndex === argument.argumentIndex);
              if (actuals.length === 0) { reason ??= "A callable argument has no completed original source formal transport."; continue; }
              for (const actual of actuals) {
                if (!budget.step()) return sourceOwnershipUnresolved(declaration, budget.failure()!);
                const formal = actual.formal;
                const owner = sourceStorageFormalOwner(formal, ast);
                if (formal.kind !== "input" || formal.projection.length !== 0 || owner === undefined || ast.body(owner) === undefined)
                  reason ??= "Native or unchecked formal storage has no closed source non-retention proof.";
                else {
                  const selected = storage.bindingsForInvocation(owner, argument.call, bindings);
                  if (selected.kind === "unresolved") reason ??= selected.reason;
                  else enqueue(formal.node, selected.bindings);
                }
              }
              continue;
            }
            if (use.kind === "direct-call" && use.role === "call-target") {
              let callee = use.reference;
              let call = ast.parent(callee);
              const parents = new Set<Node>();
              while (call !== undefined && sourceTransparentExpressionOperand(ast, call) === callee) {
                if (!budget.step() || parents.has(call)) break;
                parents.add(call);
                callee = call;
                call = ast.parent(callee);
              }
              if (call === undefined || !ast.is.IsCallExpression(call) || Node_Expression(ast, call) !== callee) {
                reason ??= "A callable reference requires its original checked invocation occurrence."; continue;
              }
              const checked = semantics.forNode(call).operations.call(call);
              if (checked === undefined) { reason ??= "A callable invocation requires its exact checked call use."; continue; }
              const types = semantics.forNode(call).types;
              const awaited = types.awaitedType(checked.sourceResultType);
              const implementations = storage.invocationImplementationsFor(call, bindings);
              const generator = implementations.kind === "resolved" && implementations.exact &&
                implementations.nodes.some(node => semantics.forNode(node).operations.generator(node) !== undefined);
              if (awaited !== undefined && !types.isIdentical(awaited, checked.sourceResultType) || generator)
                observeDeferred(call, bindings, generator);
              continue;
            }
            if (use.role !== "comparison" && use.role !== "condition" && use.role !== "write")
              reason ??= "A callable value has an unchecked retaining source use.";
          }
        }
        if (budget.failure() !== undefined) return sourceOwnershipUnresolved(declaration, budget.failure()!);
        const result: SourceCallableRetentionSelection = retained
          ? Object.freeze({ kind: "resolved", retention: "retained", witnesses: Object.freeze(witnesses) })
          : reason !== undefined || !observed ? sourceOwnershipUnresolved(declaration,
            reason ?? "An empty callable use inventory is not a closed non-retention proof.")
            : Object.freeze({ kind: "resolved", retention: "scoped", witnesses: Object.freeze([...visited.keys()]) });
        if (!retainedRows.add(2 + (result.kind === "resolved" ? result.witnesses.length : 1)))
          return sourceOwnershipUnresolved(declaration, budget.failure()!);
        cache.set(declaration, result);
        return result;
      } finally { rows.release(); }
    },
  });
}

export function createSourceRetentionQuery(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly premises: Pick<SourceOwnershipPremises, "retentionFor">;
  readonly budget: SourceOwnershipBudget;
}): SourceRetentionQueries {
  const { source, storage, premises, budget } = input;
  if (source !== storage.source) throw new Error("Retention and storage must share the identical checked source program.");
  const selected = new Map<Node, Map<SourceStorageBindings, SourceRetentionReadSelection>>();
  const origins = new Map<SourceStorageSubject, Map<SourceStorageBindings, SourceRetentionSelection>>();
  const forOrigin = (actual: SourceStorageSubject, bindings: SourceStorageBindings): SourceRetentionSelection => {
    if (!budget.step()) return sourceOwnershipUnresolved(actual.node, budget.failure()!);
    const existing = origins.get(actual)?.get(bindings);
    if (existing !== undefined) return existing;
    const type = storage.typeFor(actual);
    if (type.kind === "unresolved") return sourceOwnershipUnresolved(actual.node, type.reason);
    const selection = premises.retentionFor(actual, bindings);
    if (selection === undefined) {
      return sourceOwnershipUnresolved(actual.node, "The actual bound origin has no checked native retention or source lease premise.");
    }
    if (selection.kind === "unresolved") return selection;
    if (selection.premises.length === 0) {
      return sourceOwnershipUnresolved(actual.node, "An empty retention selection does not prove an independently owned value.");
    }
    const rows = budget.createRows();
    let published = false;
    try {
      const retained: SourceRetentionPremise[] = [];
      for (const premise of selection.premises) {
        if (!budget.step()) return sourceOwnershipUnresolved(actual.node, budget.failure()!);
        if (premise.value !== actual) {
          return sourceOwnershipUnresolved(actual.node, "Retention must describe the actual bound origin, not a generic formal or copied subject.");
        }
        const problem = sourceOwnershipContractProblem(source, actual.node, type.type, premise);
        if (problem !== undefined) return sourceOwnershipUnresolved(actual.node, problem);
        if (premise.kind === "retained" && premise.reason === "retained-owner") {
          const owner = storage.typeFor(premise.owner);
          if (owner.kind === "unresolved") return sourceOwnershipUnresolved(actual.node, owner.reason);
        }
        if (premise.kind === "scoped-borrowed") {
          const owner = storage.typeFor(premise.owner);
          const file = source.ast.getSourceFile(premise.region);
          if (owner.kind === "unresolved") return sourceOwnershipUnresolved(actual.node, owner.reason);
          if (premise.owner === actual || file === undefined || !source.semantics.includes(file)) {
            return sourceOwnershipUnresolved(actual.node, "A scoped lease requires its distinct checked owner and execution region.");
          }
          if (source.ast.is.IsSourceFile(premise.region)) {
            return sourceOwnershipUnresolved(actual.node, "A program-duration owner requires a retained module-owner premise, not a source-scoped lease.");
          }
        } else if (premise.kind === "formal-borrowed") {
          if (sourceStorageFormalOwner(actual, source.ast) !== premise.executionOwner ||
            source.ast.body(premise.executionOwner) === undefined) {
            return sourceOwnershipUnresolved(actual.node, "A formal lease requires its actual input or receiver execution owner.");
          }
          const activations = storage.boundActivationsFor(premise.executionOwner, bindings);
          if (activations.kind === "unresolved") return sourceOwnershipUnresolved(actual.node, activations.reason);
          if (activations.activations.length === 0) {
            return sourceOwnershipUnresolved(actual.node, "A formal lease requires a closed checked execution activation.");
          }
          if (premise.region.kind === "input-duration") {
            if (actual.kind !== "input" || premise.region.parameter !== actual.node ||
              !source.ast.parameters(premise.executionOwner).includes(premise.region.parameter)) {
              return sourceOwnershipUnresolved(actual.node, "An input-duration lease must identify that exact native input.");
            }
          } else {
            const region = premise.region;
            const semantics = source.semantics.forNode(actual.node);
            const arguments_ = semantics.types.typeArgumentBindings(type.type);
            const selected = arguments_?.find(binding => binding.declaration === region.binding.declaration &&
              semantics.types.isIdentical(binding.parameterType, region.binding.parameterType) &&
              semantics.types.isIdentical(binding.argumentType, region.binding.argumentType));
            const symbol = selected === undefined ? undefined : semantics.declarations.typeSymbol(selected.argumentType);
            if (selected === undefined || !source.ast.is.IsTypeParameterDeclaration(region.declaration) ||
              symbol === undefined || !semantics.declarations.symbolDeclarations(symbol).includes(region.declaration)) {
              return sourceOwnershipUnresolved(actual.node, "A formal lease requires its exact checked native region argument and declaration.");
            }
            let owner: Node | undefined = premise.executionOwner;
            const visited = new Set<Node>();
            while (owner !== undefined && !source.ast.typeParameters(owner).includes(region.declaration)) {
              if (!budget.step()) return sourceOwnershipUnresolved(actual.node, budget.failure()!);
              if (visited.has(owner)) return sourceOwnershipUnresolved(actual.node, "A formal lease's generic environment has cyclic ancestry.");
              visited.add(owner);
              owner = source.ast.parent(owner);
            }
            if (owner === undefined) {
              return sourceOwnershipUnresolved(actual.node, "A formal lease's region must belong to its checked execution environment.");
            }
          }
        } else if (premise.kind === "transferred") {
          const file = source.ast.getSourceFile(premise.operation);
          if (file === undefined || !source.semantics.includes(file)) {
            return sourceOwnershipUnresolved(actual.node, "A transferred value requires its checked ownership operation.");
          }
        }
        if (!rows.add(1)) return sourceOwnershipUnresolved(actual.node, budget.failure()!);
        retained.push(Object.freeze({ ...premise }));
      }
      if (!rows.add(3)) return sourceOwnershipUnresolved(actual.node, budget.failure()!);
      const result: SourceRetentionSelection = Object.freeze({ kind: "resolved", premises: Object.freeze(retained) });
      const byBinding = origins.get(actual) ?? new Map<SourceStorageBindings, SourceRetentionSelection>();
      byBinding.set(bindings, result);
      origins.set(actual, byBinding);
      published = true;
      return result;
    } finally {
      if (!published) rows.release();
    }
  };
  return Object.freeze({
    forReference(reference: Node, bindings: SourceStorageBindings): SourceRetentionReadSelection {
      if (!budget.step()) return sourceOwnershipUnresolved(reference, budget.failure()!);
      const existing = selected.get(reference)?.get(bindings);
      if (existing !== undefined) return existing;
      const subject = storage.subjectFor(reference);
      if (subject.kind === "unresolved") return sourceOwnershipUnresolved(reference, subject.reason);
      const origins = storage.storageProducersFor(subject.subject, bindings);
      if (origins.kind === "unresolved") return sourceOwnershipUnresolved(reference, origins.reason);
      if (origins.producers.length === 0) {
        return sourceOwnershipUnresolved(reference, "Retention requires a complete nonempty bound-origin selection.");
      }
      const rows = budget.createRows();
      let published = false;
      try {
        const retained: SourceRetentionPremise[] = [];
        for (const actual of origins.producers) {
          const selection = forOrigin(actual.subject, actual.bindings);
          if (selection.kind === "unresolved") return selection;
          for (const premise of selection.premises) {
            if (!budget.step() || !rows.add(1)) return sourceOwnershipUnresolved(reference, budget.failure()!);
            retained.push(premise);
          }
        }
        if (!rows.add(2)) return sourceOwnershipUnresolved(reference, budget.failure()!);
        const result: SourceRetentionReadSelection = Object.freeze({ kind: "resolved", reference,
          premises: Object.freeze(retained) });
        const byBinding = selected.get(reference) ?? new Map<SourceStorageBindings, SourceRetentionReadSelection>();
        byBinding.set(bindings, result);
        selected.set(reference, byBinding);
        published = true;
        return result;
      } finally {
        if (!published) rows.release();
      }
    },
  });
}
