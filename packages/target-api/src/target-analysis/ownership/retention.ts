import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import { sourceStorageFormalOwner } from "../source-storage/model/subjects.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceOwnershipBudget, SourceOwnershipPremises, SourceRetentionPremise, SourceRetentionQueries, SourceRetentionReadSelection, SourceRetentionSelection } from "./model.js";
import { sourceOwnershipContractProblem, sourceOwnershipUnresolved } from "./contracts.js";

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
