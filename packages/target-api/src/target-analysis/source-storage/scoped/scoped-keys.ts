import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection, SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageFormalOwner, sourceStorageIsMemberProjection } from "../model/subjects.js";
import type { SourceStorageActivation, SourceStorageReference, SourceStorageTerm, SourceStorageScope } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageContextFootprint } from "../graph/context-footprints.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import type { SourceStorageCreationContext } from "./activation-keys.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageInputBinding, sourceStorageTransparentInput } from "./scoped-transport.js";
import { createSourceStorageKeyEncoder, type SourceStorageKey, type SourceStorageKeyValue as Encoded } from "../graph/key-encoding.js";
import { completeSourceStorageKeyEncoding, type SourceStorageKeyContinuation } from "./key-continuations.js";
import { Node_Initializer } from "../../../source-navigation/index.js";

interface ReferenceEncoding {
  readonly encoded: SourceStorageKey;
  readonly closed: boolean;
}

interface ReferenceEncodings {
  reference?: Map<SourceStorageSubject, ReferenceEncoding>;
  leaf?: Map<SourceStorageSubject, ReferenceEncoding>;
}

type ReferenceWork = { [Kind in SourceStorageReference["kind"]]?: true };

export function createSourceStorageScopedKeys(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, creation: SourceStorageCreationContext) {
  const { footprints, ownerFor: locationOwner } = creation;
  const locationOwners = new Map<SourceStorageContextFootprint, readonly (Node | undefined)[]>();
  const ownerRows = budget.createRows();
  const completedReferences = new Map<SourceStorageScope, ReferenceEncodings>();
  let completedReferenceRows = budget.createRows();
  const completedTerms = new Map<SourceStorageTerm, ReferenceEncoding>();
  const completedInvocations = new Map<SourceStorageTerm, ReferenceEncoding>();
  let completedTermRows = budget.createRows();
  const encoder = createSourceStorageKeyEncoder(budget);
  const actualInputDemand = (term: SourceStorageTerm): boolean => {
    const demand = term.kind === "region" || term.kind === "application" && term.mode === "execution" ? term.demand : undefined;
    return demand !== undefined && source.ast.is.IsParameterDeclaration(demand) &&
      source.ast.is.IsIdentifier(source.ast.name(demand)) && Node_Initializer(source.ast, demand) === undefined &&
      source.ast.as.AsParameterDeclaration(demand)?.DotDotDotToken === undefined;
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
  // A declaration frame whose whole parent chain is declarations over the empty scope names every activation of its owner:
  // it carries no actual activation, exactly like the empty query, so both share the root creation context.
  const symbolicOnly = (scope: SourceStorageScope): boolean => {
    for (let current: SourceStorageScope = scope; current !== scopes.empty; current = current.parents[0]!) {
      if (current.kind !== "frame" || current.boundary !== "declaration" || current.parents.length !== 1) return false;
      if (!budget.step()) return false;
    }
    return true;
  };
  const birth = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageActivation | undefined => {
    if (!budget.step()) return undefined;
    const owner = scope === scopes.empty ? undefined : locationOwner(subject);
    const bound = owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
    const selected = scopes.activation(symbolicOnly(bound) ? scopes.empty : bound);
    return selected === undefined ? undefined : Object.freeze({ ...selected, key: `${scopes.identity(subject)}:${selected.key}` });
  };
  const encode = (term: SourceStorageTerm, invocation = false) => budget.withRows(temporary => {
    let closed = true;
    const references = new Map<SourceStorageScope, Map<SourceStorageSubject, ReferenceWork>>();
    const terms = new Map<SourceStorageTerm, ReferenceEncoding | undefined>();
    const encodedKey = (value: Encoded | undefined): SourceStorageKey | undefined => value === undefined ? undefined
      : value !== null && typeof value === "object" && "kind" in value && value.kind === "key" ? value : encoder.intern(value);
    const encodeProjection = (projection: readonly SourceStorageProjection[]): Encoded => projection.map(component =>
      sourceStorageIsMemberProjection(component) ? [component.kind, scopes.identity(component.declaration)] :
        component.kind === "tuple-element" ? [component.kind, component.index] : [component.kind]);
    const encodeViews = (value: SourceStorageReference | Extract<SourceStorageTerm, { readonly kind: "input-frontier" }>): Encoded =>
      value.views?.map(view => [scopes.identity(view.receiver), scopes.identity(view.source), scopes.identity(view.type)]) ?? null;
    const activationKey = (scope: SourceStorageScope): string | undefined => {
      const selected = scopes.activation(scope);
      if (selected !== undefined && !selected.closed) closed = false;
      return selected?.key;
    };
    const birthKey = (subject: SourceStorageSubject, scope: SourceStorageScope): string | undefined => {
      const selected = birth(subject, scope);
      if (selected !== undefined && !selected.closed) closed = false;
      return selected?.key;
    };
    const encodeScope = function* (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageKeyContinuation {
      if (scope === scopes.empty) return [];
      if (scope.kind === "frame" && scope.boundary === "declaration" && sourceStorageFormalOwner(subject, source) === scope.owner)
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
            variable.capture === undefined ? null : scopes.identity(variable.capture), scopes.callbackKey(variable.callback)];
        } else if (bound?.kind === "replace") {
          const values: Encoded[] = [];
          for (const value of bound.terms) {
            const encoded = (yield encodeBinding(value));
            if (encoded === undefined) return undefined;
            values.push(encoded);
          }
          entry = [bound.initialization, values];
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
    const encodeUncachedTerm = function* (selected: SourceStorageTerm): SourceStorageKeyContinuation {
      if (selected.kind === "instantiation") {
        const value = (yield encodeTerm(selected.value));
        const activation = activationKey(selected.scope);
        return value === undefined || activation === undefined ? undefined : [selected.kind, value, activation,
          scopes.identity(selected.parameter), scopes.identity(selected.scope)];
      }
      if (selected.kind === "input-frontier") {
        closed = false;
        return [selected.kind, scopes.identity(selected.input.subject), scopes.identity(selected.input.scope),
          scopes.identity(selected.subject), scopes.identity(selected.scope), selected.preservesInput ? 1 : 0, selected.guards?.key ?? null,
          encodeViews(selected)];
      }
      if (selected.kind === "input-projection") {
        closed = false;
        return [selected.kind, scopes.identity(selected.value.input.subject), scopes.identity(selected.value.input.scope),
          scopes.identity(selected.subject), scopes.identity(selected.scope), selected.value.preservesInput ? 1 : 0,
          selected.value.guards?.key ?? null, encodeViews(selected.value)];
      }
      if ((selected.kind === "leaf" || selected.kind === "reference") && selected.views !== undefined) {
        const value = (yield encodeTerm({ ...selected, views: undefined }));
        return value === undefined ? undefined : ["viewed", encodeViews(selected), value];
      }
      if (selected.kind === "leaf" && selected.guards !== undefined) {
        const value = (yield encodeTerm({ kind: "leaf", subject: selected.subject, scope: selected.scope }));
        return value === undefined ? undefined : ["qualified", selected.guards.key, value];
      }
      if (selected.kind === "empty") {
        if (selected.absence === undefined) return [selected.kind, null];
        const reference = selected.absence;
        const activation = birthKey(reference.subject, reference.scope);
        return activation === undefined ? undefined : [selected.kind,
          scopes.identity(reference.subject), activation, reference.guards?.key ?? null];
      }
      if (selected.kind === "execution-root") return [selected.kind, scopes.identity(selected.demand), selected.deferred === true ? 1 : 0];
      if (selected.kind === "guarded") {
        const guarded = budget.withRows(rows => {
          const references = new Set<number>();
          let current: SourceStorageTerm = selected;
          while (current.kind === "guarded") {
            if (!budget.step()) return undefined;
            const reference = scopes.identity(current.reference);
            if (!references.has(reference) && !rows.add(1)) return undefined;
            references.add(reference);
            current = current.value;
          }
          const guards = encoder.intern([...references].sort((left, right) => left - right));
          references.clear();
          return guards === undefined ? undefined : { guards, value: current };
        });
        if (guarded === undefined) return undefined;
        const value = (yield encodeTerm(guarded.value));
        return value === undefined ? undefined : [selected.kind, guarded.guards, value];
      }
      if (selected.kind === "transition") {
        const guards: Extract<SourceStorageTerm, { readonly kind: "transition" }>[] = [];
        let value = selected as SourceStorageTerm;
        while (value.kind === "transition") { if (!budget.step()) return undefined; guards.push(value); value = value.value; }
        const encoded = (yield encodeTerm(value));
        if (encoded === undefined) return undefined;
        const conditions: Encoded[] = [];
        for (let index = guards.length - 1; index >= 0; index -= 1) {
          const guard = guards[index]!;
          const condition = (yield encodeTerm(guard.condition));
          if (condition === undefined) return undefined;
          conditions.push([guard.capture.equation.identity, scopes.identity(guard.capture.owner),
            scopes.identity(guard.capture.capture!), condition]);
        }
        return ["transition", { kind: "set", values: conditions }, encoded];
      }
      if (selected.kind === "store") {
        const destination = (yield encodeTerm(selected.destination)); const receiver = (yield encodeTerm(selected.receiver)); const value = (yield encodeTerm(selected.value));
        return destination === undefined || receiver === undefined || value === undefined ? undefined : [selected.kind, destination, receiver, value];
      }
      if (selected.kind === "effect") {
        const activation = activationKey(selected.scope);
        const receiver = selected.store.receiver === undefined ? null : (yield encodeTerm(sourceStorageReference(selected.store.receiver, selected.scope)));
        const value = selected.store.value === undefined ? null : (yield encodeTerm(sourceStorageReference(selected.store.value, selected.scope)));
        return activation === undefined || receiver === undefined || value === undefined ? undefined
          : [selected.kind, scopes.identity(selected.store.reference), activation, receiver, value];
      }
      if (selected.kind === "region") {
        const activation = actualInputDemand(selected) ? null : activationKey(selected.scope);
        const inputs: Encoded[] = [];
        const owner = sourceStorageRegionOwner(source.ast, selected.region);
        const callable = owner === undefined ? undefined : transport.subject(owner);
        const captures = owner === undefined ? null : callable === undefined ? undefined : (yield encodeScope(callable, selected.scope));
        const parameters = owner === undefined || source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner)
          ? [] : sourceCallableValueParameters(source.ast, owner, source.semantics.forNode(owner), { kind: "declaration" });
        if (parameters === undefined) return undefined;
        if (owner !== undefined) for (const parameter of [...parameters, owner]) {
          if (parameter === undefined || !budget.step()) continue;
          const formal = transport.subject(parameter, parameter === owner ? "receiver" : "input");
          const value = formal === undefined ? undefined : (yield encodeTerm(sourceStorageReference(formal, selected.scope)));
          if (value === undefined) return undefined;
          inputs.push(value);
        }
        return activation === undefined || captures === undefined ? undefined : [selected.kind, scopes.identity(selected.region),
          scopes.identity(selected.demand), selected.deferred === true ? 1 : 0, activation, inputs, captures];
      }
      if (selected.kind === "member") {
        const receiver = (yield encodeBinding(selected.receiver));
        const subject = selected.selection.kind === "access" ? transport.subject(selected.selection.node) : selected.selection.subject;
        const footprint = subject === undefined ? undefined : footprints.select(subject);
        const context = selected.mode === "execution"
          ? subject === undefined ? undefined : (yield encodeScope(subject, selected.scope))
          : footprint === undefined ? undefined : footprint.locations.has(subject!) ? activationKey(selected.scope) : null;
        const execution = selected.mode === "execution" ? activationKey(selected.scope) : null;
        return receiver === undefined || context === undefined || execution === undefined ? undefined : [selected.kind, selected.mode,
          selected.mode === "execution" ? [scopes.identity(selected.demand), selected.deferred === true ? 1 : 0] : null,
          selected.selection.kind === "access" ? ["access", scopes.identity(selected.selection.node)]
            : selected.selection.kind === "physical" ? ["physical", scopes.identity(selected.selection.subject),
              scopes.identity(selected.selection.declaration), scopes.identity(selected.selection.receiverType)]
            : ["projection", scopes.identity(selected.selection.subject), scopes.identity(selected.selection.declaration),
              selected.selection.evaluation === undefined ? null : scopes.identity(selected.selection.evaluation),
              selected.selection.before === undefined ? null : scopes.identity(selected.selection.before)], receiver,
          selected.mode === "execution" ? [execution, context] : context, encodeProjection(selected.projection)];
      }
      if (selected.kind === "pointer") {
        const pointer = (yield encodeTerm(selected.pointer));
        const input = selected.input === undefined ? null : (yield encodeTerm(selected.input));
        const activation = activationKey(selected.scope);
        return pointer === undefined || input === undefined || activation === undefined ? undefined
          : [selected.kind, selected.mode, scopes.identity(selected.invocation), pointer, input, activation,
            selected.mode === "execution" ? [scopes.identity(selected.demand), selected.deferred === true ? 1 : 0] : null,
            encodeProjection(selected.projection)];
      }
      if (selected.kind === "application") {
        const physicalInvocation = invocation && selected === term;
        const callee = (yield encodeBinding(selected.callee));
        const call = source.semantics.forNode(selected.invocation).operations.call(selected.invocation);
        const receiverExpression = call?.sourceReceiver?.expression ?? call?.sourceCalleeAccess?.receiver.expression
          ?? source.semantics.forNode(selected.invocation).operations.propertyAccess(selected.invocation)?.receiver.expression;
        const receiverSubject = transport.subjectFor(receiverExpression);
        const selectedReceiver = selected.callee.kind === "member" && selected.callee.selection.kind === "access" &&
          selected.callee.selection.node === call?.sourceCalleeAccess?.expression &&
          call?.sourceCalleeAccess?.receiver.expression === receiverExpression ? selected.callee.receiver
          : receiverSubject === undefined ? undefined : sourceStorageReference(receiverSubject, selected.scope);
        const receiver = selectedReceiver === undefined ? null : (yield encodeBinding(selectedReceiver));
        const subject = transport.subject(selected.invocation, "value", selected.projection);
        const footprint = subject === undefined ? undefined : footprints.select(subject);
        if (footprint === undefined) return undefined;
        const createsLocation = footprint.locations.has(subject!);
        const activation = !actualInputDemand(selected) && (physicalInvocation || selected.mode === "execution" || createsLocation)
          ? activationKey(selected.scope) : null;
        if (callee === undefined || receiver === undefined || activation === undefined) return undefined;
        const arguments_: Encoded[] = [];
        for (const argument of call?.sourceArguments ?? []) {
          const subject = transport.subjectFor(argument.expression);
          const encoded = subject === undefined ? undefined : (yield encodeBinding(sourceStorageReference(subject, selected.scope)));
          if (encoded === undefined) return undefined;
          arguments_.push(encoded);
        }
        const callback = selected.callback === undefined ? null : scopes.callbackKey(selected.callback);
        const provided = selected.activation.kind === "provided" ? selected.activation.argument === undefined ? null
          : (yield encodeTerm(selected.activation.argument)) : null;
        if (provided === undefined) return undefined;
        const entered: Encoded = selected.activation.kind === "entered" ? ["entered", scopes.identity(selected.activation.scope)]
          : selected.activation.kind === "provided" ? ["provided", provided] : ["invoke"];
        if (physicalInvocation) return ["invocation", scopes.identity(selected.invocation), callback, activation, callee, receiver, arguments_, entered];
        return [selected.kind, selected.mode, selected.mode === "execution" ? [scopes.identity(selected.demand), selected.deferred === true ? 1 : 0] : null,
          scopes.identity(selected.invocation), callback, activation, callee, receiver,
          arguments_, entered, encodeProjection(selected.projection)];
      }
      const omittedInput = selected.kind === "leaf" && selected.subject.kind === "input"
        ? scopes.lookup(selected.subject, selected.scope) : undefined;
      if (selected.kind === "leaf" && omittedInput?.kind === "replace" && omittedInput.initialization === "absent") {
        const activation = birthKey(selected.subject, selected.scope);
        return activation === undefined ? undefined : ["absent-input", scopes.identity(selected.subject), activation];
      }
      if (selected.kind === "reference" && (selected.subject.kind === "receiver" || selected.subject.kind === "input") &&
        selected.subject.projection.length !== 0) {
        const base = scopes.inputBase(selected.subject, selected.scope);
        if (base === undefined) return undefined;
        if (base !== selected.subject) {
          const root = (yield encodeTerm(sourceStorageReference(base, selected.scope)));
          return root === undefined ? undefined : ["projected-binding", root,
            encodeProjection(selected.subject.projection.slice(base.projection.length))];
        }
      }
      if (selected.kind === "reference" &&
        (selected.subject.kind === "receiver" || selected.subject.kind === "input" &&
        Node_Initializer(source.ast, selected.subject.node) === undefined)) {
        const bound = sourceStorageInputBinding(source, budget, transport, scopes, selected, undefined);
        if (bound?.kind === "replace") {
          const values: Encoded[] = [];
          for (const term of bound.terms) {
            const value = (yield encodeBinding(term));
            if (value === undefined) return undefined;
            values.push(value);
          }
          return values.length === 1 ? values[0] : ["binding", values];
        }
      }
      const frame = selected.scope.kind === "substitution" ? selected.scope.scope : selected.scope;
      const terminalInput = selected.kind === "leaf" && (selected.subject.kind === "input" || selected.subject.kind === "receiver") &&
        frame.kind === "frame" && frame.invocation !== undefined && frame.owner !== undefined &&
        sourceStorageFormalOwner(selected.subject, source) === frame.owner;
      const context = terminalInput ? null : (yield encodeScope(selected.subject, selected.scope));
      const birth = selected.kind === "leaf" || selected.kind === "unresolved" ? birthKey(selected.subject, selected.scope) : null;
      if (context === undefined || birth === undefined) return undefined;
      if (selected.kind === "unresolved") {
        const exposure = selected.exposure === undefined ? null : scopes.identity(selected.exposure);
        if (exposure === undefined) return undefined;
        return [selected.kind, scopes.identity(selected.subject), birth, context, selected.reason,
          selected.executionOnly === true ? 1 : 0, selected.effectOnly === true ? 1 : 0,
          ...(exposure === null ? [] : [exposure])];
      }
      return [selected.kind, scopes.identity(selected.subject), birth, context];
    };
    const encodeBinding = function* (selected: SourceStorageTerm): SourceStorageKeyContinuation {
      if ((selected.kind === "reference" || selected.kind === "leaf") && selected.views !== undefined) return (yield encodeTerm(selected));
      if (selected.kind !== "reference" || selected.subject.kind !== "value") return (yield encodeTerm(selected));
      const rows = budget.createRows();
      try {
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
          if (input === undefined) return (yield encodeTerm(sourceStorageReference(subject, selected.scope)));
          subject = input;
        }
      } finally { rows.release(); }
    };
    const encodeTerm = function* (selected: SourceStorageTerm): SourceStorageKeyContinuation {
      if (!budget.step()) return undefined;
      if ((selected.kind === "reference" || selected.kind === "leaf") && selected.views !== undefined)
        return encodedKey((yield encodeUncachedTerm(selected)));
      if (selected.kind === "reference" && selected.subject.kind === "value") {
        const input = sourceStorageTransparentInput(selected.subject, source.ast, transport);
        if (input !== undefined) return (yield encodeTerm(sourceStorageReference(input, selected.scope)));
      }
      if (selected.kind === "reference" && selected.scope === scopes.empty)
        return encoder.intern(["reference", scopes.identity(selected.subject)]);
      if (selected.kind === "guarded") return encodedKey((yield encodeUncachedTerm(selected)));
      if (selected.kind !== "reference" && selected.kind !== "leaf" || selected.kind === "leaf" && selected.guards !== undefined) {
        if (terms.has(selected)) {
          const completed = terms.get(selected);
          if (completed === undefined) {
            budget.reject("Source storage key terms require an acyclic exact value.");
            return undefined;
          }
          closed = closed && completed.closed;
          return completed.encoded;
        }
        const memo = invocation && selected === term && selected.kind === "application"
          ? completedInvocations : completedTerms;
        const known = memo.get(selected);
        if (known !== undefined) {
          closed = closed && known.closed;
          return known.encoded;
        }
        if (!temporary.add(1)) return undefined;
        terms.set(selected, undefined);
        const outerClosed = closed;
        closed = true;
        let completed: ReferenceEncoding | undefined;
        try {
          const encoded = encodedKey((yield encodeUncachedTerm(selected)));
          if (encoded !== undefined && budget.failure() === undefined) completed = Object.freeze({ encoded, closed });
        } finally {
          closed = outerClosed && closed;
        }
        if (completed !== undefined) terms.set(selected, completed);
        return completed?.encoded;
      }
      const completed = completedReferences.get(selected.scope)?.[selected.kind]?.get(selected.subject);
      if (completed !== undefined) {
        closed = closed && completed.closed;
        return completed.encoded;
      }
      const subjects = references.get(selected.scope);
      const retained = subjects?.get(selected.subject);
      const previous = retained?.[selected.kind];
      if (previous !== undefined) {
        budget.reject("Source storage key references cannot expose an unfinished encoding.");
        return undefined;
      }
      const rows = budget.createRows();
      let result: ReferenceEncoding | undefined;
      try {
        if (!rows.add(retained === undefined ? subjects === undefined ? 3 : 2 : 1)) return undefined;
        const encodings = retained ?? {};
        encodings[selected.kind] = true;
        const entries = subjects ?? new Map<SourceStorageSubject, ReferenceWork>();
        entries.set(selected.subject, encodings);
        references.set(selected.scope, entries);
        const outerClosed = closed;
        closed = true;
        try {
          const encoded = (yield encodeUncachedTerm(selected));
          const key = encodedKey(encoded);
          result = key === undefined || budget.failure() !== undefined ? undefined : Object.freeze({ encoded: key, closed });
        } finally {
          delete encodings[selected.kind];
          if (encodings.reference === undefined && encodings.leaf === undefined) {
            entries.delete(selected.subject);
            if (entries.size === 0) references.delete(selected.scope);
          }
          closed = outerClosed && closed;
        }
      } finally { rows.release(); }
      if (result === undefined) return undefined;
      const currentModes = completedReferences.get(selected.scope);
      const currentSubjects = currentModes?.[selected.kind];
      if (!completedReferenceRows.add(currentSubjects === undefined ? currentModes === undefined ? 3 : 2 : 1)) return undefined;
      const subjectsForMode = currentSubjects ?? new Map<SourceStorageSubject, ReferenceEncoding>();
      subjectsForMode.set(selected.subject, result);
      const modes = currentModes ?? {};
      modes[selected.kind] = subjectsForMode;
      completedReferences.set(selected.scope, modes);
      return result.encoded;
    };
    const encoded = encodedKey(completeSourceStorageKeyEncoding(budget, encodeTerm(term)));
    if (encoded === undefined || budget.failure() !== undefined) return undefined;
    let retained = 0;
    for (const completed of terms.values()) {
      if (!budget.step()) return undefined;
      if (completed !== undefined) retained += 1;
    }
    if (retained !== 0 && !completedTermRows.add(retained)) return undefined;
    for (const [selected, completed] of terms) {
      if (completed === undefined) continue;
      const memo = invocation && selected === term && selected.kind === "application"
        ? completedInvocations : completedTerms;
      memo.set(selected, completed);
    }
    return { encoded, closed };
  });
  const key = (term: SourceStorageTerm, invocation = false): string | undefined => {
    const selected = encode(term, invocation);
    return selected === undefined ? undefined : String(selected.encoded.identity);
  };
  return Object.freeze({ encode: key,
    releaseReferenceMemo(): void {
      completedReferences.clear();
      completedReferenceRows.release();
      completedReferenceRows = budget.createRows();
      completedTerms.clear();
      completedInvocations.clear();
      completedTermRows.release();
      completedTermRows = budget.createRows();
    },
    context(inputs: readonly (readonly { readonly subject: SourceStorageSubject; readonly term: SourceStorageTerm }[])[]): string | undefined {
      return budget.withRows(temporary => {
        const states: Encoded[] = [];
        for (const inputs_ of inputs) {
          const values: Encoded[] = [];
          for (const input of inputs_) {
            if (!budget.step() || !temporary.add(1)) return undefined;
            const selected = encode(input.term);
            if (selected === undefined) return undefined;
            values.push([scopes.identity(input.subject), selected.encoded]);
          }
          if (!temporary.add(1)) return undefined;
          states.push({ kind: "set", values });
        }
        const selected = encoder.intern(["source-query-context", { kind: "set", values: states }]);
        return selected === undefined ? undefined : String(selected.identity);
      });
    },
    closed: (term: SourceStorageTerm): boolean | undefined => encode(term)?.closed,
    birth,
    invocation: (term: Extract<SourceStorageTerm, { readonly kind: "application" }>) => key(term, true) });
}
