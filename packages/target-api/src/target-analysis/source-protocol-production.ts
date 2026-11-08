import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceInputProtocolQueries } from "../host-input/protocol-input.js";
import type { SourceInputSignature } from "../host-input/identities.js";
import type { SourceDescriptorView, SourcePresence, SourceRefusal, SourceResult, SourceSignatureIdentity,
  SourceTypeEvidence, SourceValueFacts } from "../public/source/contracts.js";
import type { SourceNodeNavigationFacts } from "../source-model/navigation.js";
import type { SourceProductionResult } from "../source-semantics/descriptor-contracts.js";
import type { SourceMemberInventoryQueries } from "../source-semantics/member-inventory.js";
import type { SourceMemberUse } from "../source-semantics/member-use.js";
import type { SourceMarkerFacts } from "../source-model/markers.js";
import type { SourcePointerFacts } from "../source-model/pointers.js";
import type { SourceAnalysisFacts, SourceDisposalAlternative, SourceResourceManagement } from "../source-model/protocols.js";
import { createSourceStoragePlaceQueries } from "./source-storage/place.js";
import type { SourceControlFlowQueries } from "../source-model/control-flow.js";
import type { SourceSafetyFacts } from "../source-model/safety.js";

export function createSourceAnalysisFacts(options: {
  readonly ast: AstReader;
  readonly input: SourceInputProtocolQueries;
  readonly view: SourceDescriptorView;
  readonly assertNode: (node: Node) => void;
  readonly values: SourceValueFacts;
  readonly navigation: SourceNodeNavigationFacts;
  readonly memberPlace: (occurrence: Node) => SourceProductionResult<SourceMemberUse>;
  readonly inventory: SourceMemberInventoryQueries;
  readonly signature: (original: SourceInputSignature) => SourceSignatureIdentity;
  readonly solved: Pick<SourceAnalysisFacts, "iteration" | "generator" | "yield">;
  readonly pointers: SourcePointerFacts & SourceMarkerFacts;
  readonly controlFlow: SourceControlFlowQueries;
  readonly storageAnalysis: SourceAnalysisFacts["storageAnalysis"];
  readonly safety: SourceSafetyFacts;
  readonly unavailable: (node: Node, reason: string) => SourceRefusal;
  readonly settle: <Value>(value: SourceProductionResult<Value>) => SourceResult<Value>;
}): SourceAnalysisFacts {
  const { ast, input, view, assertNode, values, navigation, memberPlace, inventory, signature,
    solved, pointers, controlFlow, storageAnalysis, safety, unavailable, settle } = options;
  const resolved = <Value>(value: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value });
  const present = <Value>(value: Value): SourcePresence<Value> => Object.freeze({ kind: "present", value });
  const none = Object.freeze({ kind: "none" } as const);
  const places = createSourceStoragePlaceQueries({ ast, view, navigation, assertNode,
    declared: values.declaredSlot, argumentPassing: input.argumentPassing, member: memberPlace, unavailable });
  const passing = new WeakMap<Node, ReturnType<SourceAnalysisFacts["argumentPassing"]>>();
  const resources = new WeakMap<Node, ReturnType<SourceAnalysisFacts["resourceManagement"]>>();
  const completions = new WeakMap<Node, ReturnType<SourceAnalysisFacts["callableCompletion"]>>();
  const callIdentities = (value: SourceTypeEvidence): SourceResult<readonly SourceSignatureIdentity[]> => {
    view.assertEvidence(value);
    const pending = [...(value.sum?.arms ?? [value])];
    const visited = new Set<SourceTypeEvidence>();
    const selected = new Set<SourceSignatureIdentity>();
    while (pending.length !== 0) {
      const current = pending.pop()!;
      view.assertEvidence(current);
      if (visited.has(current)) continue;
      visited.add(current);
      if (current.type.kind === "declared") {
        const definition = view.definition(current);
        if (definition.kind === "refused") return definition;
        if (definition.value === current) return unavailable(current.component.root,
          "The selected disposer has no available callable definition.");
        pending.push(...(definition.value.sum?.arms ?? [definition.value]));
      } else if (current.type.kind === "shape" || current.type.kind === "callable") {
        for (const call of current.type.calls) selected.add(call.identity);
      } else return unavailable(current.component.root, "A selected Source disposer requires its original callable signatures.");
    }
    return resolved(Object.freeze([...selected]));
  };
  const resourceManagement = (declaration: Node): ReturnType<SourceAnalysisFacts["resourceManagement"]> => {
    const original = input.resourceManagement(declaration);
    if (original.kind === "none") return resolved(none);
    if (original.value.declaration !== declaration) throw new Error("Resource management requires its exact original declaration.");
    const slot = values.declaredSlot(declaration);
    if (slot.kind === "refused") return slot;
    const resource = slot.value.type;
    view.assertEvidence(resource);
    let acquisition: SourceResourceManagement["acquisition"];
    if (original.value.acquisition.kind === "initializer") {
      const occurrence = original.value.acquisition.expression;
      assertNode(occurrence);
      const selected = values.type(occurrence);
      if (selected.kind === "refused") return selected;
      view.assertEvidence(selected.value);
      acquisition = Object.freeze({ kind: "initializer", value: Object.freeze({ occurrence, value: selected.value }) });
    } else {
      assertNode(original.value.acquisition.statement);
      acquisition = Object.freeze({ kind: "iteration", statement: original.value.acquisition.statement, value: resource });
    }
    const base = { declaration, kind: original.value.kind, acquisition, resource, acceptsAbsence: true as const };
    if (resource.type.kind === "intrinsic" && resource.type.intrinsic === "any")
      return resolved(present(Object.freeze({ ...base, disposal: Object.freeze({ kind: "untyped-dynamic", value: resource }) })));
    const alternatives: SourceDisposalAlternative[] = [];
    const pending = [...(resource.sum?.arms ?? [resource])];
    const visited = new Set<SourceTypeEvidence>();
    while (pending.length !== 0) {
      const arm = pending.pop()!;
      view.assertEvidence(arm);
      if (visited.has(arm)) continue;
      visited.add(arm);
      if (arm.type.kind === "intrinsic" && (arm.type.intrinsic === "absence" || arm.type.intrinsic === "never")) continue;
      if (arm.type.kind === "optional") {
        const payload = view.component(arm, { kind: "optional-value" });
        if (payload.kind === "refused") return payload;
        pending.push(...(payload.value.sum?.arms ?? [payload.value]));
        continue;
      }
      if (original.value.disposal.kind !== "selected") return unavailable(declaration,
        "The Source resource has no original selected disposal protocol.");
      const rows = settle(inventory.members(arm));
      if (rows.kind === "refused") return rows;
      if (rows.value.kind !== "complete") return unavailable(declaration, "The Source resource member inventory is unavailable.");
      const candidates = rows.value.members.filter(row => original.value.disposal.kind === "selected" &&
        original.value.disposal.alternatives.some(selected => row.declarations.some(node => selected.declarations.includes(node))));
      if (candidates.length !== 1 || candidates[0]!.optional || candidates[0]!.read === "unavailable")
        return unavailable(declaration, "The Source resource requires its exact readable original disposal member.");
      const row = candidates[0]!;
      const selected = original.value.disposal.alternatives.filter(alternative =>
        row.declarations.some(node => alternative.declarations.includes(node)));
      const kinds = new Set(selected.map(alternative => alternative.kind));
      if (kinds.size !== 1) return unavailable(declaration, "The Source resource has ambiguous original disposal protocols.");
      const member = settle(row.readType());
      if (member.kind === "refused") return member;
      if (member.value.kind === "none") return unavailable(declaration, "The Source disposer has no canonical read component.");
      const calls = callIdentities(member.value.value);
      if (calls.kind === "refused") return calls;
      const signatures = Object.freeze([...new Set(selected.flatMap(alternative => alternative.signatures.map(signature)))]);
      if (signatures.length === 0 || signatures.some(identity => !calls.value.includes(identity)))
        return unavailable(declaration, "The Source disposer must retain every original selected callable identity.");
      alternatives.push(Object.freeze({ resource: arm, kind: selected[0]!.kind, declarations: row.declarations,
        origins: row.readOrigins, member: member.value.value, signatures }));
    }
    return resolved(present(Object.freeze({ ...base,
      disposal: Object.freeze({ kind: "selected", alternatives: Object.freeze(alternatives) }) })));
  };
  const facts: SourceAnalysisFacts = Object.freeze({
    controlFlow,
    storageAnalysis,
    safety: safety.safety,
    iteration(occurrence: Node) { assertNode(occurrence); return solved.iteration(occurrence); },
    generator(declaration: Node) { assertNode(declaration); return solved.generator(declaration); },
    yield(occurrence: Node) { assertNode(occurrence); return solved.yield(occurrence); },
    storage(occurrence: Node) { return settle(places.storage(occurrence)); },
    argumentPassing(occurrence: Node) {
      assertNode(occurrence);
      const previous = passing.get(occurrence);
      if (previous !== undefined) return previous;
      const original = input.argumentPassing(occurrence);
      let selected: ReturnType<SourceAnalysisFacts["argumentPassing"]>;
      if (original.kind === "none") selected = resolved(none);
      else if (original.value.role === "declaration") selected = resolved(present(original.value));
      else {
        const operand = original.value.storageExpression;
        assertNode(operand);
        const place = settle(places.storage(operand));
        const mode = original.value.mode;
        const writable = mode === "byref-readwrite" || mode === "byref-writeonly-must-init";
        selected = place.kind === "refused" ? place : place.value.kind === "none"
          ? unavailable(operand, "The explicit argument-passing marker requires an original storage expression.")
          : writable && !place.value.value.writable
            ? unavailable(operand, "The explicit writable argument-passing marker requires mutable storage.")
            : resolved(present(original.value));
      }
      passing.set(occurrence, selected);
      return selected;
    },
    callableCompletion(declaration: Node) {
      assertNode(declaration);
      const previous = completions.get(declaration);
      if (previous !== undefined) return previous;
      const selected = resolved(input.callableCompletion(declaration));
      completions.set(declaration, selected);
      return selected;
    },
    resourceManagement(declaration: Node) {
      assertNode(declaration);
      const previous = resources.get(declaration);
      if (previous !== undefined) return previous;
      const selected = resourceManagement(declaration);
      resources.set(declaration, selected);
      return selected;
    },
    pointerType(value: SourceTypeEvidence) { view.assertEvidence(value); return pointers.pointerType(value); },
    pointerOperation(occurrence: Node) { assertNode(occurrence); return pointers.pointerOperation(occurrence); },
    typeMarkers(value: SourceTypeEvidence) { view.assertEvidence(value); return pointers.typeMarkers(value); },
    declarationMarkers(occurrence: Node) { assertNode(occurrence); return pointers.declarationMarkers(occurrence); },
  });
  return facts;
}
