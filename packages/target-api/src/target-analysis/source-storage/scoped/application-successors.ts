import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { Node_Expression } from "../../../source-navigation/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { sourceStorageFormalOwner } from "../model/subjects.js";
import { sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageReference, type SourceStorageTerm, type SourceStorageReduction } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import type { createSourceStorageExecutionContext } from "./execution-context.js";
import type { createSourceStorageInputExecutions } from "./execution-reachability.js";
import type { createSourceStorageScopedRejections } from "./rejections.js";
import type { SourceStorageChildContext, SourceStoragePendingReduction } from "./child-reduction.js";

export interface SourceStorageApplicationSuccessorContext extends Pick<ReturnType<typeof createSourceStorageExecutionContext>,
  "dispatchDependencies" | "independentCalleeFor" | "regionsFor" | "classLineages" | "leaf"> {
  readonly source: TargetSourceProgram;
  readonly budget: SourceStorageBudget;
  readonly transport: SourceStorageScopedTransport;
  readonly scopes: SourceStorageScopes;
  readonly equations: Pick<ReturnType<typeof createSourceStorageEquations>, "scopeFor">;
  readonly absent: Extract<SourceStorageReduction, { readonly kind: "replace" }>;
  readonly nativeInputExecutions: ReturnType<typeof createSourceStorageInputExecutions>["nativeInputExecutions"];
  readonly conditionalExecutions: ReturnType<typeof createSourceStorageInputExecutions>["conditionalExecutions"];
  readonly rejections: Pick<ReturnType<typeof createSourceStorageScopedRejections>, "callableThrows">;
  replaceChild(child: SourceStorageTerm, replace: (child: SourceStorageTerm) => SourceStorageTerm,
    context?: SourceStorageChildContext): SourceStoragePendingReduction | undefined;
}

export function createSourceStorageApplicationSuccessors(context: SourceStorageApplicationSuccessorContext) {
  const { source, budget, transport, scopes, equations, absent, nativeInputExecutions, conditionalExecutions,
    rejections, replaceChild, dispatchDependencies, independentCalleeFor, regionsFor, classLineages, leaf } = context;
  const { ast, navigation, semantics } = source;
  return (term: Extract<SourceStorageTerm, { readonly kind: "application" }>): SourceStoragePendingReduction | undefined => {
    const resumes = term.callback === undefined && transport.invocationEffects.get(term.invocation)?.resumeReceiver === true;
    const dependencies = resumes || term.activation.kind !== "invoke" ? [] : dispatchDependencies(term.invocation, term.scope);
    if (term.callee.kind !== "leaf" && term.callee.kind !== "input-frontier") {
      return replaceChild(term.callee, callee => callee === term.callee ? term : Object.freeze({ ...term, callee }), {
        contributes: false,
        independentCallee: resumes ? undefined : independentCalleeFor(term.invocation),
        dependencies,
      });
    }
    const node = term.callee.subject.node;
    if (term.activation.kind === "provided") {
      const selected = navigation.callableImplementation(node);
      if (selected.kind !== "resolved" || ast.body(selected.implementation.declaration) === undefined)
        return { kind: "replace", terms: [Object.freeze({ kind: "unresolved", subject: term.callee.subject,
          scope: term.callee.scope, reason: "A native pointer accessor requires its original checked source implementation." })] };
      return scopes.enterApplication(term, selected.implementation.declaration, term.callee);
    }
    if (resumes) {
      if (term.mode === "value") {
        const result = transport.subject(term.invocation, "value", term.projection);
        return result === undefined ? undefined : { kind: "replace", terms: [leaf(result, term.scope)] };
      }
      const terms: SourceStorageTerm[] = [];
      let supplied = false;
      if (term.callee.subject.kind === "value" && term.callee.subject.projection.length === 0 && ast.is.IsCallExpression(node)) {
        const implementations = transport.pointerInvocations.has(node) ? transport.pointerAccessors(node) : transport.invocationImplementations(node);
        if (implementations === undefined) return undefined;
        for (const candidate of implementations) {
          if (!budget.step()) return undefined;
          if (semantics.forNode(candidate).operations.generator(candidate) === undefined) continue;
          const activation = scopes.boundActivation(term.callee.scope, candidate);
          const body = ast.body(candidate);
          if (activation?.invocation !== node || body === undefined) continue;
          supplied = true;
          if (term.mode === "throw") {
            const thrown = rejections.callableThrows(term.callee.subject, candidate, node, activation.scope, undefined, "active");
            if (thrown === undefined) return undefined;
            terms.push(...thrown);
          } else terms.push(Object.freeze({ kind: "region", region: body, scope: activation.scope,
            demand: term.demand, deferred: term.deferred }));
        }
      }
      if (!supplied) terms.push(Object.freeze({ kind: "unresolved", subject: term.callee.subject,
        scope: term.callee.scope, exposure: term.invocation,
        reason: "A generator may-resume requires its original checked creation call and activation." }));
      return { kind: "replace", terms };
    }
    if (term.callback !== undefined) {
      const type = sourceStorageSubjectType(source, term.callee.subject);
      if (type !== undefined && semantics.forNode(term.invocation).types.isNullish(type)) return absent;
      const selected = navigation.callableImplementation(node);
      const demand = term.mode === "execution" ? transport.subjectFor(term.demand) : undefined;
      if (term.mode !== "execution" || demand === undefined) return undefined;
      if (selected.kind !== "resolved" || ast.body(selected.implementation.declaration) === undefined) {
        const possible = nativeInputExecutions(term.invocation, term.scope, term.demand, term.deferred,
          { entry: term.callback, subject: term.callee.subject, bindings: term.callee.scope });
        if (possible === undefined) return undefined;
        return { kind: "replace", terms: possible, dependencies };
      }
      const candidate = selected.implementation.declaration;
      const scope = equations.scopeFor(candidate, term.invocation, term.scope, term.callee.scope, term);
      if (scope === undefined) return undefined;
      const regions = regionsFor(candidate, term.invocation, scope, term.demand, undefined, term.deferred);
      if (regions === undefined) return undefined;
      const reason = "The relevant native callback has no completed checked execution contract.";
      const terms = term.callback.timing === "unknown" ? conditionalExecutions(regions, term.demand, term.invocation,
        { value: { reason, executionOnly: true }, effect: undefined }, true) : regions;
      if (terms === undefined) return undefined;
      return { kind: "replace", terms, dependencies };
    }
    const construction = ast.is.IsNewExpression(term.invocation) || ast.kindName(Node_Expression(ast, term.invocation)) === "KindSuperKeyword";
    if (construction && (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node))) {
      const lineages = classLineages(term.callee);
      if (lineages === undefined || lineages.some(lineage => !lineage.complete)) return undefined;
      const terms: SourceStorageTerm[] = [];
      for (const lineage of lineages) {
        const captured = lineage.classes[lineage.classes.length - 1];
        if (captured === undefined) return undefined;
        const owner = captured.subject.node;
        const candidate = lineage.implementation ?? owner;
        const scope = equations.scopeFor(candidate, term.invocation, term.scope, captured.bindings,
          Object.freeze({ ...term, callee: leaf(captured.subject, captured.bindings) }));
        if (scope === undefined) return undefined;
        if (term.mode === "execution") {
          const regions = regionsFor(candidate, term.invocation, scope, term.demand, { caller: term.scope, classes: lineage.classes }, term.deferred);
          if (regions === undefined) return undefined;
          terms.push(...regions);
        } else if (term.mode === "throw") {
          const thrown = rejections.callableThrows(captured.subject, candidate, term.invocation, scope);
          if (thrown === undefined) return undefined;
          terms.push(...thrown);
        } else {
          const result = transport.subject(candidate, "return", term.projection);
          if (result !== undefined && transport.incomingFor(result).size !== 0) terms.push(sourceStorageReference(result, scope));
        }
      }
      return { kind: "replace", terms, dependencies };
    }
    const selected = navigation.callableImplementation(node);
    const missingBody = selected.kind !== "resolved" || ast.body(selected.implementation.declaration) === undefined;
    const symbolic = missingBody && scopes.isSymbolic(term.callee);
    if (symbolic) {
      const owner = sourceStorageFormalOwner(term.callee.subject, source);
      const native = owner === undefined ? undefined : scopes.boundActivation(term.callee.scope, owner)?.nativeEntry;
      if (term.mode === "execution" && native !== undefined) {
        const possible = nativeInputExecutions(term.invocation, term.scope, term.demand, term.deferred);
        return possible === undefined ? undefined : { kind: "replace", terms: possible, dependencies };
      }
    }
    const contract = transport.invocationDeclarations.get(term.invocation);
    const nativeAllocation = transport.invocationEffects.get(term.invocation)?.resultAllocation === term.invocation;
    if (missingBody && transport.isOpaque(term.invocation) && contract === undefined) {
      const result = transport.subject(term.invocation, "value", term.projection);
      return result === undefined ? undefined : { kind: "replace", terms: [Object.freeze({
        kind: "unresolved", subject: result, scope: term.scope, exposure: term.invocation,
        reason: "An invocation has no exact checked selected signature transport.",
      })], dependencies };
    }
    if (missingBody && (transport.isOpaque(term.invocation) || nativeAllocation) &&
      (contract !== undefined && ast.body(contract) === undefined || transport.declarationIsAmbient(node) === true &&
        semantics.forNode(node).declarations.declarationSignature(node) !== undefined)) {
      const result = transport.subject(term.invocation, "value", term.projection);
      return result === undefined ? undefined : { kind: "replace", terms: term.mode === "value"
        ? [leaf(result, term.scope)] : term.mode === "execution" ? []
          : [Object.freeze({ kind: "unresolved", subject: result, scope: term.scope, exposure: term.invocation,
            reason: "An opaque invocation has no completed original thrown-value transport." })], dependencies };
    }
    if (symbolic) {
      const result = transport.subject(term.invocation, "value", term.projection);
      if (result === undefined) return undefined;
      return { kind: "replace", terms: [term.mode === "value" ? leaf(result, term.scope)
        : Object.freeze({ kind: "unresolved", subject: result, scope: term.scope,
          reason: "A symbolic callable invocation has no selected implementation execution." })], dependencies };
    }
    if (selected.kind !== "resolved" || ast.body(selected.implementation.declaration) === undefined) {
      budget.reject("Source storage invocation requires its exact checked original implementation."); return undefined;
    }
    const candidate = selected.implementation.declaration;
    const generator = semantics.forNode(candidate).operations.generator(candidate);
    const asynchronous = ast.hasModifierKind(candidate, "async");
    const scope = asynchronous && term.activation.kind !== "entered" &&
      (term.mode === "throw" || term.mode === "value" && generator === undefined)
      ? term.scope : equations.scopeFor(candidate, term.invocation, term.scope, term.callee.scope, term);
    if (scope === undefined) return undefined;
    if (term.mode === "throw") {
      const terms = rejections.callableThrows(term.callee.subject, candidate, term.invocation, scope,
        term.activation.kind === "entered" ? term.activation.actualTypes : undefined);
      return terms === undefined ? undefined : { kind: "replace", terms };
    }
    if (term.mode === "execution") {
      const regions = regionsFor(candidate, term.invocation, scope, term.demand, undefined, term.deferred,
        term.activation.kind === "entered" ? term.activation.actualTypes : undefined);
      return regions === undefined ? undefined : { kind: "replace", terms: regions };
    }
    if (generator !== undefined) {
      const result = transport.subject(term.invocation, "value", term.projection);
      return result === undefined ? undefined : { kind: "replace", terms: [leaf(result, scope)], dependencies };
    }
    if (asynchronous) {
      const result = transport.subject(term.invocation, "value", term.projection);
      return result === undefined ? undefined : { kind: "replace", terms: [leaf(result, scope)], dependencies };
    }
    const result = transport.subject(candidate, "return", term.projection);
    return result === undefined ? undefined : { kind: "replace", terms: [sourceStorageReference(result, scope)], dependencies };
  };
}
