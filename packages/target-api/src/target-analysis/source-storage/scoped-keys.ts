import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";
import type { SourceStorageTerm, SourceStorageScope, SourceStorageVariable } from "./scoped-model.js";
import { sourceStorageReference } from "./scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import { createSourceStorageContextFootprints } from "./context-footprints.js";
import { sourceStorageRegionOwner } from "./lexical-regions.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageTransparentInput } from "./scoped-transport.js";

type Encoded = null | string | number | readonly Encoded[];

export function createSourceStorageScopedKeys(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes) {
  const footprints = createSourceStorageContextFootprints(budget, transport.contextualInputs, subject => {
    if (subject.kind === "value" && (source.ast.is.IsObjectLiteralExpression(subject.node) ||
      source.ast.is.IsArrayLiteralExpression(subject.node) || source.ast.is.IsNewExpression(subject.node) &&
      transport.invocationEffects.get(subject.node)?.resultAlias === undefined)) return true;
    for (const store of transport.storedValuesFor(subject) ?? []) {
      if (!budget.step()) return false;
      if (store.destination === "binding" && store.kind === "mutation") return true;
    }
    return false;
  });
  const birthKey = (subject: SourceStorageSubject, scope: SourceStorageScope): string | undefined => {
    if (!budget.step()) return undefined;
    const region = scope === scopes.empty ? undefined : transport.regions.enclosing(subject.node);
    const owner = subject.kind === "return" ? subject.node : region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
    const activation = scopes.activationKey(owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope);
    return activation === undefined ? undefined : `${scopes.identity(subject)}:${activation}`;
  };
  const encode = (term: SourceStorageTerm): string | undefined => {
    const variables = new Map<SourceStorageVariable, number>();
    const encodeScope = (subject: SourceStorageSubject, scope: SourceStorageScope): Encoded | undefined => {
      if (scope === scopes.empty) return [];
      if (!budget.step()) return undefined;
      const footprint = footprints.select(subject);
      if (footprint === undefined) return undefined;
      const inputs: Encoded[] = [];
      for (const port of footprint.ports) {
        if (!budget.step()) return undefined;
        const bound = scopes.lookup(port, scope);
        let entry: Encoded = null;
        if (bound?.kind === "expand") {
          const variable = bound.variable;
          let ordinal = variables.get(variable);
          if (ordinal === undefined) { ordinal = variables.size; variables.set(variable, ordinal); }
          entry = ["variable", variable.equation.identity, scopes.identity(variable.owner), ordinal];
        } else if (bound?.kind === "replace") {
          const values: Encoded[] = [];
          for (const value of bound.terms) {
            const encoded = encodeTerm(value);
            if (encoded === undefined) return undefined;
            values.push(encoded);
          }
          entry = values;
        }
        inputs.push([scopes.identity(port), entry]);
      }
      const physical: Encoded[] = [];
      for (const location of footprint.locations) {
        const selected = birthKey(location, scope);
        if (selected === undefined) return undefined;
        physical.push([scopes.identity(location), selected]);
      }
      return [inputs, physical];
    };
    const encodeTerm = (selected: SourceStorageTerm): Encoded | undefined => {
      if (!budget.step()) return undefined;
      if (selected.kind === "execution-root") return [selected.kind];
      if (selected.kind === "reference" && selected.subject.kind === "value") {
        const input = sourceStorageTransparentInput(selected.subject, source.ast, transport);
        if (input !== undefined) return encodeTerm(sourceStorageReference(input, selected.scope));
      }
      if (selected.kind === "guard") {
        const guards: Extract<SourceStorageTerm, { readonly kind: "guard" }>[] = [];
        let value = selected as SourceStorageTerm;
        while (value.kind === "guard") { if (!budget.step()) return undefined; guards.push(value); value = value.value; }
        const encoded = encodeTerm(value);
        if (encoded === undefined) return undefined;
        const conditions = new Set<string>();
        for (let index = guards.length - 1; index >= 0; index -= 1) {
          const guard = guards[index]!;
          const condition = encodeTerm(guard.condition);
          if (condition === undefined) return undefined;
          conditions.add(JSON.stringify([scopes.identity(guard.candidate), condition]));
        }
        return ["guard", [...conditions].sort(), encoded];
      }
      if (selected.kind === "store") {
        const destination = encodeTerm(selected.destination); const receiver = encodeTerm(selected.receiver); const value = encodeTerm(selected.value);
        return destination === undefined || receiver === undefined || value === undefined ? undefined : [selected.kind, destination, receiver, value];
      }
      if (selected.kind === "effect") {
        const activation = scopes.activationKey(selected.scope);
        const receiver = selected.store.receiver === undefined ? null : encodeTerm(sourceStorageReference(selected.store.receiver, selected.scope));
        const value = selected.store.value === undefined ? null : encodeTerm(sourceStorageReference(selected.store.value, selected.scope));
        return activation === undefined || receiver === undefined || value === undefined ? undefined
          : [selected.kind, scopes.identity(selected.store.reference), activation, receiver, value];
      }
      if (selected.kind === "region") {
        const activation = scopes.activationKey(selected.scope);
        const inputs: Encoded[] = [];
        const owner = sourceStorageRegionOwner(source.ast, selected.region);
        const parameters = owner === undefined || source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner)
          ? [] : source.ast.parameters(owner);
        if (owner !== undefined) for (const parameter of [...parameters, owner]) {
          if (parameter === undefined || !budget.step()) continue;
          const formal = transport.subject(parameter, parameter === owner ? "receiver" : "input");
          const value = formal === undefined ? undefined : encodeTerm(sourceStorageReference(formal, selected.scope));
          if (value === undefined) return undefined;
          inputs.push(value);
        }
        return activation === undefined ? undefined : [selected.kind, scopes.identity(selected.region), activation, inputs];
      }
      if (selected.kind === "member") {
        const receiver = encodeTerm(selected.receiver);
        const subject = transport.subject(selected.access);
        const context = subject === undefined ? undefined : encodeScope(subject, selected.scope);
        return receiver === undefined || context === undefined ? undefined : [selected.kind, selected.mode, scopes.identity(selected.access), receiver,
          context, JSON.stringify(selected.projection)];
      }
      if (selected.kind === "application") {
        const callee = encodeTerm(selected.callee);
        const call = source.semantics.forNode(selected.invocation).operations.call(selected.invocation);
        const receiverSubject = transport.subjectFor(call?.sourceReceiver?.expression ?? call?.sourceCalleeAccess?.receiver.expression
          ?? source.semantics.forNode(selected.invocation).operations.propertyAccess(selected.invocation)?.receiver.expression);
        const receiver = receiverSubject === undefined ? null : encodeTerm(sourceStorageReference(receiverSubject, selected.scope));
        let createsLocation = false;
        if (selected.mode === "value") for (const candidate of transport.invocationImplementations(selected.invocation)) {
          if (!budget.step()) return undefined;
          const result = transport.subject(candidate, "return", selected.projection);
          const locations = result === undefined ? undefined : footprints.select(result)?.locations;
          if (locations === undefined) return undefined;
          for (const location of locations) {
            if (!budget.step()) return undefined;
            const region = transport.regions.enclosing(location.node);
            const owner = region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
            const captured = "scope" in selected.callee ? selected.callee.scope : selected.scope;
            if (owner !== undefined && scopes.owningScope(captured, owner) === undefined) createsLocation = true;
          }
        }
        const activation = selected.mode === "execution" || createsLocation ? scopes.activationKey(selected.scope) : null;
        if (callee === undefined || receiver === undefined || activation === undefined) return undefined;
        const arguments_: Encoded[] = [];
        for (const argument of call?.sourceArguments ?? []) {
          const subject = transport.subjectFor(argument.expression);
          const encoded = subject === undefined ? undefined : encodeTerm(sourceStorageReference(subject, selected.scope));
          if (encoded === undefined) return undefined;
          arguments_.push(encoded);
        }
        return [selected.kind, selected.mode, scopes.identity(selected.invocation), activation, callee, receiver,
          arguments_, JSON.stringify(selected.projection)];
      }
      if (selected.kind === "reference" && (selected.subject.kind === "input" || selected.subject.kind === "receiver")) {
        const bound = scopes.lookup(selected.subject, selected.scope);
        if (bound?.kind === "replace") {
          const values: Encoded[] = [];
          for (const term of bound.terms) {
            const value = encodeTerm(term);
            if (value === undefined) return undefined;
            values.push(value);
          }
          return values.length === 1 ? values[0] : ["binding", values];
        }
      }
      const context = encodeScope(selected.subject, selected.scope);
      const birth = selected.kind === "leaf" ? birthKey(selected.subject, selected.scope) : null;
      return context === undefined || birth === undefined ? undefined : [selected.kind, scopes.identity(selected.subject), birth, context];
    };
    const encoded = encodeTerm(term);
    return encoded === undefined || budget.failure() !== undefined ? undefined : JSON.stringify(encoded);
  };
  return Object.freeze({ encode, birthKey });
}
