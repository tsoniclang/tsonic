import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection, SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageFormalOwner, sourceStorageIsMemberProjection } from "../model/subjects.js";
import type { SourceStorageReference, SourceStorageTerm, SourceStorageScope } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import { createSourceStorageContextFootprints, type SourceStorageContextFootprint } from "../graph/context-footprints.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageTransparentInput } from "./scoped-transport.js";
import { createSourceStorageKeyEncoder, type SourceStorageKey, type SourceStorageKeyValue as Encoded } from "../graph/key-encoding.js";

interface ReferenceEncoding {
  readonly encoded: SourceStorageKey;
  readonly closed: boolean;
}

interface ReferenceEncodings {
  reference?: ReferenceEncoding;
  leaf?: ReferenceEncoding;
}

export function createSourceStorageScopedKeys(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes) {
  const footprints = createSourceStorageContextFootprints(budget, transport.contextualInputs,
    transport.contextLocation, transport.contextualInputs.applicationFor);
  const locationOwners = new Map<SourceStorageContextFootprint, readonly (Node | undefined)[]>();
  const ownerRows = budget.createRows();
  const references = new Map<SourceStorageScope, Map<SourceStorageSubject, ReferenceEncodings>>();
  const referenceRows = budget.createRows();
  const encoder = createSourceStorageKeyEncoder(budget);
  const locationOwner = (subject: SourceStorageSubject): Node | undefined => {
    const region = transport.regions.enclosing(subject.node);
    return subject.kind === "return" ? subject.node : region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
  };
  const ownersFor = (footprint: SourceStorageContextFootprint): readonly (Node | undefined)[] | undefined => {
    if (!budget.step()) return undefined;
    if (footprint.locations.size === 0) return [];
    const cached = locationOwners.get(footprint);
    if (cached !== undefined) return cached;
    return budget.withRows(temporary => {
      const owners = new Set<Node | undefined>();
      for (const location of footprint.locations) {
        if (!budget.step()) return undefined;
        const owner = locationOwner(location);
        if (!owners.has(owner) && !temporary.add(1)) return undefined;
        owners.add(owner);
      }
      if (budget.failure() !== undefined || !ownerRows.add(1 + owners.size)) return undefined;
      const selected = Object.freeze([...owners]);
      locationOwners.set(footprint, selected);
      return selected;
    });
  };
  const birth = (subject: SourceStorageSubject, scope: SourceStorageScope) => {
    if (!budget.step()) return undefined;
    const owner = scope === scopes.empty ? undefined : locationOwner(subject);
    return scopes.activation(owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope);
  };
  const encode = (term: SourceStorageTerm, invocation = false) => budget.withRows(rows => {
    let closed = true;
    const pending = new Map<SourceStorageScope, Map<SourceStorageSubject, Set<SourceStorageReference["kind"]>>>();
    const encodeProjection = (projection: readonly SourceStorageProjection[]): Encoded => projection.map(component =>
      sourceStorageIsMemberProjection(component) ? [component.kind, scopes.identity(component.declaration)] :
        component.kind === "tuple-element" ? [component.kind, component.index] : [component.kind]);
    const activationKey = (scope: SourceStorageScope): string | undefined => {
      const selected = scopes.activation(scope);
      if (selected?.variable !== undefined) closed = false;
      return selected?.key;
    };
    const birthKey = (subject: SourceStorageSubject, scope: SourceStorageScope): string | undefined => {
      const selected = birth(subject, scope);
      if (selected?.variable !== undefined) closed = false;
      return selected === undefined ? undefined : `${scopes.identity(subject)}:${selected.key}`;
    };
    const encodeScope = (subject: SourceStorageSubject, scope: SourceStorageScope): Encoded | undefined => {
      if (scope === scopes.empty) return [];
      if (scope.kind === "frame" && scope.boundary === "declaration" && sourceStorageFormalOwner(subject, source.ast) === scope.owner)
        return ["declaration", scopes.identity(scope)];
      if (!budget.step()) return undefined;
      const footprint = footprints.select(subject);
      if (footprint === undefined) return undefined;
      const inputs: Encoded[] = [];
      for (const port of footprint.ports) {
        if (!budget.step()) return undefined;
        const bound = scopes.lookup(port, scope);
        let entry: Encoded = null;
        if (bound?.kind === "expand") {
          closed = false;
          const variable = bound.variable;
          entry = ["variable", variable.equation.identity, scopes.identity(variable.owner),
            variable.capture === undefined ? null : scopes.identity(variable.capture)];
        } else if (bound?.kind === "replace") {
          const values: Encoded[] = [];
          for (const value of bound.terms) {
            const encoded = encodeBinding(value);
            if (encoded === undefined) return undefined;
            values.push(encoded);
          }
          entry = values;
        }
        inputs.push([scopes.identity(port), entry]);
      }
      const physical: Encoded[] = [];
      const owners = ownersFor(footprint);
      if (owners === undefined) return undefined;
      for (const owner of owners) {
        if (!budget.step()) return undefined;
        const selected = activationKey(owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope);
        if (selected === undefined) return undefined;
        physical.push([owner === undefined ? null : scopes.identity(owner), selected]);
      }
      const boundInputs = encoder.intern(inputs);
      const boundLocations = encoder.intern(physical);
      return boundInputs === undefined || boundLocations === undefined ? undefined : [boundInputs, boundLocations];
    };
    const encodeUncachedTerm = (selected: SourceStorageTerm): Encoded | undefined => {
      if (selected.kind === "leaf" && selected.guards !== undefined) {
        const value = encodeTerm({ kind: "leaf", subject: selected.subject, scope: selected.scope });
        return value === undefined ? undefined : ["qualified", selected.guards.key, value];
      }
      if (selected.kind === "empty") return [selected.kind];
      if (selected.kind === "execution-root") return [selected.kind, scopes.identity(selected.demand)];
      if (selected.kind === "guarded") {
        return budget.withRows(rows => {
          const references = new Set<number>();
          let current: SourceStorageTerm = selected;
          while (current.kind === "guarded") {
            if (!budget.step()) return undefined;
            const reference = scopes.identity(current.reference);
            if (!references.has(reference) && !rows.add(1)) return undefined;
            references.add(reference);
            current = current.value;
          }
          const value = encodeTerm(current);
          return value === undefined ? undefined : [selected.kind, [...references].sort((left, right) => left - right), value];
        });
      }
      if (selected.kind === "reference" && selected.subject.kind === "value") {
        const input = sourceStorageTransparentInput(selected.subject, source.ast, transport);
        if (input !== undefined) return encodeTerm(sourceStorageReference(input, selected.scope));
      }
      if (selected.kind === "transition") {
        const guards: Extract<SourceStorageTerm, { readonly kind: "transition" }>[] = [];
        let value = selected as SourceStorageTerm;
        while (value.kind === "transition") { if (!budget.step()) return undefined; guards.push(value); value = value.value; }
        const encoded = encodeTerm(value);
        if (encoded === undefined) return undefined;
        const conditions: Encoded[] = [];
        for (let index = guards.length - 1; index >= 0; index -= 1) {
          const guard = guards[index]!;
          const condition = encodeTerm(guard.condition);
          if (condition === undefined) return undefined;
          conditions.push([guard.capture.equation.identity, scopes.identity(guard.capture.owner),
            scopes.identity(guard.capture.capture!), condition]);
        }
        return ["transition", { kind: "set", values: conditions }, encoded];
      }
      if (selected.kind === "store") {
        const destination = encodeTerm(selected.destination); const receiver = encodeTerm(selected.receiver); const value = encodeTerm(selected.value);
        return destination === undefined || receiver === undefined || value === undefined ? undefined : [selected.kind, destination, receiver, value];
      }
      if (selected.kind === "effect") {
        const activation = activationKey(selected.scope);
        const receiver = selected.store.receiver === undefined ? null : encodeTerm(sourceStorageReference(selected.store.receiver, selected.scope));
        const value = selected.store.value === undefined ? null : encodeTerm(sourceStorageReference(selected.store.value, selected.scope));
        return activation === undefined || receiver === undefined || value === undefined ? undefined
          : [selected.kind, scopes.identity(selected.store.reference), activation, receiver, value];
      }
      if (selected.kind === "region") {
        const activation = activationKey(selected.scope);
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
        return activation === undefined ? undefined : [selected.kind, scopes.identity(selected.region), scopes.identity(selected.demand), activation, inputs];
      }
      if (selected.kind === "member") {
        const receiver = encodeBinding(selected.receiver);
        const subject = selected.selection.kind === "access" ? transport.subject(selected.selection.node) : selected.selection.subject;
        const footprint = subject === undefined ? undefined : footprints.select(subject);
        const context = selected.mode === "execution"
          ? subject === undefined ? undefined : encodeScope(subject, selected.scope)
          : footprint === undefined ? undefined : footprint.locations.has(subject!) ? activationKey(selected.scope) : null;
        return receiver === undefined || context === undefined ? undefined : [selected.kind, selected.mode,
          selected.mode === "execution" ? scopes.identity(selected.demand) : null,
          selected.selection.kind === "access" ? ["access", scopes.identity(selected.selection.node)]
            : ["projection", scopes.identity(selected.selection.subject), scopes.identity(selected.selection.declaration)], receiver,
          context, encodeProjection(selected.projection)];
      }
      if (selected.kind === "application") {
        const physicalInvocation = invocation && selected === term;
        const callee = encodeBinding(selected.callee);
        const call = source.semantics.forNode(selected.invocation).operations.call(selected.invocation);
        const receiverExpression = call?.sourceReceiver?.expression ?? call?.sourceCalleeAccess?.receiver.expression
          ?? source.semantics.forNode(selected.invocation).operations.propertyAccess(selected.invocation)?.receiver.expression;
        const receiverSubject = transport.subjectFor(receiverExpression);
        const selectedReceiver = selected.callee.kind === "member" && selected.callee.selection.kind === "access" &&
          selected.callee.selection.node === call?.sourceCalleeAccess?.expression &&
          call?.sourceCalleeAccess?.receiver.expression === receiverExpression ? selected.callee.receiver
          : receiverSubject === undefined ? undefined : sourceStorageReference(receiverSubject, selected.scope);
        const receiver = selectedReceiver === undefined ? null : encodeBinding(selectedReceiver);
        const subject = transport.subject(selected.invocation, "value", selected.projection);
        const footprint = subject === undefined ? undefined : footprints.select(subject);
        if (footprint === undefined) return undefined;
        const createsLocation = footprint.locations.has(subject!);
        const activation = physicalInvocation || selected.mode === "execution" || createsLocation ? activationKey(selected.scope) : null;
        if (callee === undefined || receiver === undefined || activation === undefined) return undefined;
        const arguments_: Encoded[] = [];
        for (const argument of call?.sourceArguments ?? []) {
          const subject = transport.subjectFor(argument.expression);
          const encoded = subject === undefined ? undefined : encodeBinding(sourceStorageReference(subject, selected.scope));
          if (encoded === undefined) return undefined;
          arguments_.push(encoded);
        }
        if (physicalInvocation) return ["invocation", scopes.identity(selected.invocation), activation, callee, receiver, arguments_];
        return [selected.kind, selected.mode, selected.mode === "execution" ? scopes.identity(selected.demand) : null,
          scopes.identity(selected.invocation), activation, callee, receiver,
          arguments_, encodeProjection(selected.projection)];
      }
      if (selected.kind === "reference" && (selected.subject.kind === "input" || selected.subject.kind === "receiver")) {
        const bound = scopes.lookup(selected.subject, selected.scope);
        if (bound?.kind === "replace") {
          const values: Encoded[] = [];
          for (const term of bound.terms) {
            const value = encodeBinding(term);
            if (value === undefined) return undefined;
            values.push(value);
          }
          return values.length === 1 ? values[0] : ["binding", values];
        }
      }
      const context = encodeScope(selected.subject, selected.scope);
      const birth = selected.kind === "leaf" ? birthKey(selected.subject, selected.scope) : null;
      if (context === undefined || birth === undefined) return undefined;
      return selected.kind === "unresolved" ? [selected.kind, scopes.identity(selected.subject), context, selected.reason]
        : [selected.kind, scopes.identity(selected.subject), birth, context];
    };
    const encodeBinding = (selected: SourceStorageTerm): Encoded | undefined => {
      if (selected.kind !== "reference" || selected.subject.kind !== "value") return encodeTerm(selected);
      return budget.withRows(rows => {
        let subject = selected.subject;
        const visited = new Set<SourceStorageSubject>();
        while (true) {
          if (!budget.step()) return undefined;
          if (visited.has(subject)) {
            budget.reject("Source storage binding aliases require an acyclic exact input."); return undefined;
          }
          if (!rows.add(1)) return undefined;
          visited.add(subject);
          const input = transport.bindingInputFor(subject);
          if (input === undefined) return encodeTerm(sourceStorageReference(subject, selected.scope));
          subject = input;
        }
      });
    };
    const encodeTerm = (selected: SourceStorageTerm): SourceStorageKey | undefined => {
      if (!budget.step()) return undefined;
      if (selected.kind !== "reference" && selected.kind !== "leaf" || selected.kind === "leaf" && selected.guards !== undefined) {
        const encoded = encodeUncachedTerm(selected);
        return encoded === undefined ? undefined : encoder.intern(encoded);
      }
      const subjects = references.get(selected.scope);
      const retained = subjects?.get(selected.subject);
      const previous = retained?.[selected.kind];
      if (previous !== undefined) {
        closed = closed && previous.closed;
        return previous.encoded;
      }
      const inputs = pending.get(selected.scope) ?? new Map<SourceStorageSubject, Set<SourceStorageReference["kind"]>>();
      const encodings = inputs.get(selected.subject) ?? new Set<SourceStorageReference["kind"]>();
      if (encodings.has(selected.kind)) {
        budget.reject("Source storage key references cannot expose an unfinished encoding.");
        return undefined;
      }
      if (!rows.add(3)) return undefined;
      encodings.add(selected.kind);
      inputs.set(selected.subject, encodings); pending.set(selected.scope, inputs);
      const outerClosed = closed;
      closed = true;
      try {
        const encoded = encodeUncachedTerm(selected);
        const key = encoded === undefined ? undefined : encoder.intern(encoded);
        if (key === undefined || budget.failure() !== undefined) return undefined;
        const completedInputs = references.get(selected.scope);
        const completed = completedInputs?.get(selected.subject);
        if (!referenceRows.add(completed === undefined ? completedInputs === undefined ? 3 : 2 : 1)) return undefined;
        const completedEncodings = completed ?? {};
        completedEncodings[selected.kind] = Object.freeze({ encoded: key, closed });
        const completedSubjects = completedInputs ?? new Map<SourceStorageSubject, ReferenceEncodings>();
        completedSubjects.set(selected.subject, completedEncodings);
        references.set(selected.scope, completedSubjects);
        return key;
      } finally { encodings.delete(selected.kind); closed = outerClosed && closed; }
    };
    const encoded = encodeTerm(term);
    return encoded === undefined || budget.failure() !== undefined ? undefined : { encoded, closed };
  });
  const key = (term: SourceStorageTerm, invocation = false): string | undefined => {
    const selected = encode(term, invocation);
    return selected === undefined ? undefined : String(selected.encoded.identity);
  };
  return Object.freeze({ encode: key,
    closed: (term: SourceStorageTerm): boolean | undefined => encode(term)?.closed,
    birthKey: (subject: SourceStorageSubject, scope: SourceStorageScope): string | undefined => {
      const selected = birth(subject, scope);
      return selected === undefined ? undefined : `${scopes.identity(subject)}:${selected.key}`;
    },
    invocation: (term: Extract<SourceStorageTerm, { readonly kind: "application" }>) => key(term, true) });
}
