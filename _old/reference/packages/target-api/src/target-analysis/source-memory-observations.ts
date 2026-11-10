import type { Node } from "@tsonic/tsts";
import type { SourcePresence } from "../public/source/contracts.js";
import type { SourceMemoryQueries, SourceMemoryObservation, SourceMemorySelection } from "../source-model/memory.js";
import type { SourceMemoryField } from "../source-model/pointers.js";
import type { SourceStorageBindings } from "../source-model/storage.js";
import type { SourceMemberPair } from "../source-model/members.js";
import type { SourceMemoryContext } from "./source-memory-context.js";
import type { SourceMemoryEnvironments } from "./source-storage/model/memory-environments.js";
import type { SourceStorageBudget } from "./source-storage/model/resource-budget.js";

export function createSourceMemoryObservationQueries(input: {
  readonly context: SourceMemoryContext;
  readonly environments: SourceMemoryEnvironments;
  readonly metadata: SourceMemoryQueries["memoryMetadata"];
  readonly budget: SourceStorageBudget;
}): SourceMemoryQueries["observation"] {
  const { context, environments, metadata, budget } = input;
  const retained = new WeakMap<Node, WeakMap<SourceStorageBindings, SourceMemoryObservation>>();
  const retainedRows = budget.createRows();
  const none = Object.freeze({ kind: "none" } as const);
  const resolved = <Value>(value: Value): SourceMemorySelection<Value> => Object.freeze({ kind: "resolved", value });
  const unresolved = (reason: string) => Object.freeze({ kind: "unresolved" as const, reason });
  const value: SourceMemoryQueries["observation"]["value"] = (occurrence, bindings) => budget.withRows(rows => {
    context.assertNode(occurrence);
    environments.assertBindings(bindings);
    if (!budget.step()) return unresolved(budget.failure()!);
    const original = context.original.observation(occurrence);
    if (original.kind === "none") return resolved(none);
    if (original.kind === "unavailable") return unresolved(original.reason);
    const query = original.value;
    if (query.occurrence !== occurrence) throw new Error("A scoped layout observation retains its exact original occurrence.");
    const activations = environments.environments(occurrence, bindings);
    if (activations.kind !== "resolved") return activations;
    if (activations.value.length !== 1)
      return unresolved("A layout observation requires its complete correlated activation environment.");
    const component = context.component(query.source, activations.value[0]!);
    if (component.kind !== "resolved") return component;
    const previous = retained.get(occurrence)?.get(bindings);
    if (previous !== undefined) return resolved(Object.freeze({ kind: "present", value: previous }));
    if (!rows.add(4 + component.value.typeBindings.length)) return unresolved(budget.failure()!);
    const application = context.source.facts.applications.application(occurrence);
    if (application.kind === "refused") return application;
    const arguments_ = application.value.sourceArguments;
    const expected = query.operation === "field-offset" ? 2 : 1;
    if (application.value.identity.invocation !== occurrence || arguments_.length !== expected ||
      arguments_.some(argument => argument.form !== "value") || arguments_[0]?.occurrence !== query.layoutExpression ||
      query.operation === "field-offset" && arguments_[1]?.occurrence !== query.selector)
      throw new Error("A layout observation retains its complete original authored argument vector.");
    const argument = arguments_[0]!.operand;
    if (argument.kind === "refused") return argument;
    const selected = metadata.value(query.layoutExpression, bindings);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "none" || selected.value.value.kind !== "memory-layout")
      return unresolved("A layout observation requires its same finalized scoped memory descriptor.");
    const layout = selected.value.value.layout;
    if (layout.occurrence !== query.layout.occurrence)
      return unresolved("A layout observation cannot borrow another original finalized layout.");
    const domain = context.equivalent(component.value.value, layout.source);
    if (domain.kind !== "resolved") return domain;
    if (!domain.value) return unresolved("A layout observation requires the same applied Source query and layout domain.");
    let field: SourcePresence<SourceMemoryField> = none;
    if (query.operation === "field-offset") {
      if (layout.kind !== "value" || query.selectedDeclarations.length === 0)
        return unresolved("A field observation requires its complete original physical member selection.");
      const selectedFields: SourceMemoryField[] = [];
      const members: Extract<SourceMemberPair, { readonly kind: "present" }>[] = [];
      for (const declaration of query.selectedDeclarations) {
        context.assertNode(declaration);
        if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
        const pair = context.source.facts.objects.correspondingMember(component.value.value, layout.source, declaration, "read");
        if (pair.kind !== "resolved") return pair;
        if (pair.value.kind !== "present" || pair.value.value.kind !== "present" ||
          !pair.value.value.source.declarations.includes(declaration))
          return unresolved("A field observation requires every original query declaration in its own corresponding applied member group.");
        const member = pair.value.value;
        if (query.primary.kind === "present" && (!query.selectedDeclarations.includes(query.primary.value) ||
          !member.source.declarations.includes(query.primary.value)))
          return unresolved("A field observation requires its authentic original primary in its own complete query member group.");
        members.push(member);
      }
      for (const candidate of layout.fields) {
        if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
        const matches = members.every(member => member.destination.declarations.length === candidate.member.declarations.length &&
          member.destination.declarations.every(declaration => candidate.member.declarations.includes(declaration)) &&
          member.destination.declarations.every(declaration => candidate.selectedDeclarations.includes(declaration)));
        if (matches) selectedFields.push(candidate);
      }
      if (selectedFields.length !== 1)
        return unresolved("A field observation requires one same-layout field retaining every original selected declaration.");
      const selected = selectedFields[0]!;
      field = Object.freeze({ kind: "present", value: selected });
    }
    const operand = context.substitute(argument.value.value, component.value.typeBindings);
    if (operand.kind !== "resolved") return operand;
    const number = query.operation === "size" ? layout.byteSize : query.operation === "alignment" ? layout.byteAlignment
      : query.operation === "stride" ? layout.stride : field.kind === "present" ? field.value.byteOffset : undefined;
    if (number === undefined) throw new Error("A field observation requires its same finalized Core offset.");
    const result: SourceMemoryObservation = Object.freeze({ occurrence, operation: query.operation,
      operand: Object.freeze({ occurrence: argument.value.occurrence, value: operand.value }), layout, field,
      result: application.value.result, value: number, bindings, typeBindings: component.value.typeBindings });
    if (!retainedRows.add(4 + result.typeBindings.length)) return unresolved(budget.failure()!);
    let records = retained.get(occurrence);
    if (records === undefined) { records = new WeakMap(); retained.set(occurrence, records); }
    records.set(bindings, result);
    return resolved(Object.freeze({ kind: "present", value: result }));
  });
  return Object.freeze({ value });
}
