import type { SourceStorageProgram } from "../model/program.js";
import { sourceStorageOriginalParameters, sourceStorageOriginalSignature } from "../model/callable-heads.js";
import type { Node } from "@tsonic/tsts";

import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageCallbackEntry } from "../../../source-model/storage.js";
import type { SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageSubject } from "../../../source-model/storage.js";
import { sourceStorageProjectionType } from "./projection-views.js";
import { sourceStorageSelectedInputSlots, type SourceStorageInvocationInputSelectionQuery, type SourceStorageInvocationInputQuery } from "../graph/invocation-inputs.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { Node_Initializer } from "../../../source-navigation/index.js";
import type { SourceStorageEquation, SourceStorageFrame, SourceStorageFrameInput, SourceStorageReference, SourceStorageInputFrontier, SourceStorageReduction, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";

export function createSourceStorageScopeFrames(input: {
  readonly source: SourceStorageProgram;
  readonly budget: SourceStorageBudget;
  readonly rows: SourceStorageRows;
  readonly subject: SourceStorageSubjectQuery;
  readonly inputSlotsFor: SourceStorageInvocationInputSelectionQuery;
  readonly invocationInputs: SourceStorageInvocationInputQuery;
  readonly identity: (value: object) => number;
  readonly callbackKey: (callback: SourceStorageCallbackEntry | undefined) => string;
}) {
  const { source, budget, rows, subject, inputSlotsFor, invocationInputs, identity, callbackKey } = input;
  const frames = new Map<string, SourceStorageFrame>();
  const publishFrame = (key: string, frame: SourceStorageFrame): SourceStorageFrame | undefined => {
    if (budget.failure() !== undefined || !rows.add(1 + frame.entries.size +
      [...frame.entries.values()].reduce((cost, entry) => cost + entry.values.length, 0))) return undefined;
    frames.set(key, frame);
    identity(frame);
    return frame;
  };
  const frameForActuals = (candidate: Node, invocation: Node, caller: SourceStorageScope, captured: SourceStorageScope,
    actuals: SourceStorageFrameInput["values"]): SourceStorageFrame | undefined => {
    if (!budget.step()) return undefined;
    const key = `actuals:${[candidate, invocation, caller, captured].map(identity).join(":")}:${actuals.map(value =>
      value.kind === "empty" ? value.absence === undefined ? `empty:${value.missingMember ? 1 : 0}`
        : `empty:${value.missingMember ? 1 : 0}:${identity(value.absence.subject)}/${identity(value.absence.scope)}`
        : value.kind === "input-frontier" ? `input:${identity(value.input.subject)}/${identity(value.input.scope)}/${identity(value.subject)}/${identity(value.scope)}/${value.preservesInput ? 1 : 0}/${value.guards?.key ?? ""}`
        : `${identity(value.subject)}/${identity(value.scope)}`).join(";")}`;
    const cached = frames.get(key);
    if (cached !== undefined) return cached;
    const entries = new Map<SourceStorageSubject, SourceStorageFrameInput>();
    const frame: SourceStorageFrame = Object.freeze({ kind: "frame", owner: candidate, invocation, caller,
      entries, parents: Object.freeze([captured]) });
    const slots = sourceStorageSelectedInputSlots(inputSlotsFor(candidate, undefined), candidate);
    if (slots === undefined) return undefined;
    const parameters = sourceStorageOriginalParameters(source, candidate,
      source.facts.navigation.callableRoles(candidate).body ? "body" : "signature");
    if (parameters === undefined) return undefined;
    for (const parameter of parameters) {
      if (!budget.step()) return undefined;
      const formal = subject(parameter, "input");
      if (formal === undefined) return undefined;
      const initial = Node_Initializer(source.ast, parameter);
      const fallback = initial === undefined ? undefined : subject(initial);
      entries.set(formal, Object.freeze({ initialization: fallback === undefined ? "absent" : "initialized",
        values: Object.freeze([fallback === undefined ? Object.freeze({ kind: "leaf", subject: formal, scope: frame })
          : sourceStorageReference(fallback, frame)]) }));
    }
    for (const slot of slots) {
      if (!budget.step() || slot.projection === undefined) return undefined;
      const formal = subject(slot.parameter, "input", slot.projection);
      if (formal === undefined) return undefined;
      const values = slot.repeated ? actuals.slice(slot.effectiveIndex) : actuals.slice(slot.effectiveIndex, slot.effectiveIndex + 1);
      if (values.length !== 0) entries.set(formal, Object.freeze({ initialization: "actual", values: Object.freeze(
        values.map(value => value.kind === "input-frontier" ? Object.freeze({ ...value }) : value)) }));
    }
    return publishFrame(key, frame);
  };
  const enterApplication = (term: Extract<SourceStorageTerm, { readonly kind: "application" }>, candidate: Node,
    callee: SourceStorageReference | SourceStorageInputFrontier): SourceStorageReduction | undefined => {
    if (term.activation.kind !== "provided") return undefined;
    const enter = (argument?: SourceStorageFrameInput["values"][number]): SourceStorageTerm | undefined => {
      const actuals = argument === undefined ? [] : [argument];
      const scope = frameForActuals(candidate, term.invocation, term.scope, callee.scope, actuals);
      if (scope === undefined) return undefined;
      const actualTypes = Object.freeze(actuals.map(value => {
        const type = value.kind === "empty" ? undefined : sourceStorageProjectionType(source, value.subject, value.views);
        return type === undefined ? undefined : Object.freeze([type]);
      }));
      return Object.freeze({ ...term, callee, activation: Object.freeze({ kind: "entered", scope, actualTypes }) });
    };
    if (term.activation.argument === undefined) {
      const selected = enter();
      return selected === undefined ? undefined : { kind: "replace", terms: [selected] };
    }
    return { kind: "project", inputs: [term.activation.argument], select: value => {
      if (value.kind === "empty" && value.absence === undefined) return [value];
      const selected = enter(value);
      return selected === undefined ? undefined : [selected];
    } };
  };
  const declarations = new Map<Node, Map<SourceStorageScope, SourceStorageFrame>>();
  const declarationFor = (owner: Node, parent: SourceStorageScope): SourceStorageFrame | undefined => {
    if (!budget.step()) return undefined;
    const retained = declarations.get(owner);
    const cached = retained?.get(parent);
    if (cached !== undefined) return cached;
    const parameters = source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner) ? []
      : sourceStorageOriginalParameters(source, owner,
        source.facts.navigation.callableRoles(owner).body ? "body" : "signature");
    if (parameters === undefined) return undefined;
    if (!rows.add(3 + (parameters.length + 1) * 2 + (retained === undefined ? 1 : 0))) return undefined;
    const entries = new Map<SourceStorageSubject, SourceStorageFrameInput>();
    const frame: SourceStorageFrame = Object.freeze({ kind: "frame", owner, boundary: "declaration", entries,
      parents: Object.freeze([parent]) });
    for (const parameter of [...parameters, owner]) {
      if (parameter === undefined || !budget.step()) continue;
      const input = subject(parameter, parameter === owner ? "receiver" : "input");
      if (input === undefined) return undefined;
      entries.set(input, Object.freeze({ initialization: "actual", values: Object.freeze([
        Object.freeze({ kind: "leaf", subject: input, scope: frame }),
      ]) }));
    }
    if (budget.failure() !== undefined) return undefined;
    const selections = retained ?? new Map<SourceStorageScope, SourceStorageFrame>();
    selections.set(parent, frame);
    declarations.set(owner, selections);
    identity(frame);
    return frame;
  };
  const frameFor = (candidate: Node, invocation: Node, parent: SourceStorageScope, captured: SourceStorageScope,
    equation?: SourceStorageEquation, callback?: SourceStorageCallbackEntry): SourceStorageFrame | undefined => {
    if (!budget.step()) return undefined;
    const key = `${[candidate, invocation, parent, captured].map(identity).join(":")}:${equation?.identity ?? ""}:${callbackKey(callback)}`;
    const cached = frames.get(key);
    if (cached !== undefined) return cached;
    const entries = new Map<SourceStorageSubject, SourceStorageFrameInput>();
    const frame: SourceStorageFrame = Object.freeze({ kind: "frame", owner: candidate, invocation, caller: parent, equation, callback, entries,
      parents: Object.freeze([captured]) });
    const classOwner = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate);
    const role = source.facts.navigation.callableRoles(candidate).body ? "body" : "signature";
    const parameters = classOwner ? [] : sourceStorageOriginalParameters(source, candidate, role);
    if (parameters === undefined) return undefined;
    const formals = new Set<SourceStorageSubject>();
    for (const parameter of [...parameters, candidate]) {
      if (parameter === undefined) continue;
      if (!budget.step()) return undefined;
      const formal = subject(parameter, parameter === candidate ? "receiver" : "input");
      if (formal === undefined) return undefined;
      formals.add(formal);
    }
    if (!classOwner && sourceStorageOriginalSignature(source, candidate, role)?.signature.parameters.some(parameter => parameter.kind === "rest")) {
      const slots = sourceStorageSelectedInputSlots(inputSlotsFor(candidate, invocation, callback), candidate);
      if (slots === undefined) return undefined;
      for (const slot of slots) {
        if (!budget.step()) return undefined;
        if (slot.projection === undefined || slot.projection.length === 0) continue;
        const formal = subject(slot.parameter, "input", slot.projection);
        if (formal === undefined) return undefined;
        formals.add(formal);
      }
    }
    for (const formal of formals) {
      const selected = invocationInputs(formal, candidate, invocation, callback);
      const values: SourceStorageReference[] = [];
      for (const input of selected.subjects) {
        if (!budget.step()) return undefined;
        values.push(input === formal ? Object.freeze({ kind: "leaf", subject: input, scope: frame })
          : sourceStorageReference(input, selected.context === "callee" ? frame : parent));
      }
      for (const input of selected.calleeSubjects ?? []) {
        if (!budget.step()) return undefined;
        if (values.length !== 0 && formal.kind === "input" && Node_Initializer(source.ast, formal.node) !== undefined && input !== formal) continue;
        values.push(input === formal ? Object.freeze({ kind: "leaf", subject: input, scope: frame }) : sourceStorageReference(input, frame));
      }
      if (values.length === 0) continue;
      entries.set(formal, Object.freeze({ values: Object.freeze(values), initialization: selected.omitted ? "absent"
        : selected.context === "callee" ? "initialized" : "actual" }));
    }
    return publishFrame(key, frame);
  };
  return Object.freeze({ frameFor, enterApplication, declarationFor });
}
