import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises, SourceDeclarationOwnershipValue,
  SourceDeclarationOwnershipValues, SourceDeclarationRetentionPremise, SourceDeclarationRetentionReadSelection,
  SourceDeclarationRetentionSelection } from "./model.js";
import { sourceDeclarationOwnershipContractProblem, sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export function createSourceDeclarationRetentionQuery(input: {
  readonly source: TargetSourceProgram;
  readonly values: SourceDeclarationOwnershipValues;
  readonly premises: Pick<SourceDeclarationOwnershipPremises, "retentionFor">;
  readonly budget: SourceDeclarationOwnershipBudget;
}) {
  const { source, values, premises, budget } = input;
  const reads = new Map<Node, SourceDeclarationRetentionReadSelection>();
  const actuals = new Map<SourceDeclarationOwnershipValue, SourceDeclarationRetentionSelection>();
  const validate = (value: SourceDeclarationOwnershipValue,
    selection: SourceDeclarationRetentionSelection): SourceDeclarationRetentionSelection => {
    if (selection.kind === "unresolved") return selection;
    if (!values.owns(value) || selection.premises.length === 0)
      return sourceDeclarationOwnershipUnresolved(value.node,
        "Retention requires this immutable query's actual checked value and a nonempty native proof.");
    const rows = budget.createRows(value.node);
    let published = false;
    try {
      const retained: SourceDeclarationRetentionPremise[] = [];
      for (const premise of selection.premises) {
        if (!budget.step(value.node)) return budget.failure()!;
        if (premise.value !== value)
          return sourceDeclarationOwnershipUnresolved(value.node,
            "Native retention must describe this exact checked local value, not a copied or foreign descriptor.");
        const problem = sourceDeclarationOwnershipContractProblem(source, value.node, value.component, premise.contract);
        if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(value.node, problem);
        if (premise.kind === "retained" && premise.reason === "retained-owner" || premise.kind === "scoped-borrowed") {
          if (!values.owns(premise.owner) || premise.owner === value)
            return sourceDeclarationOwnershipUnresolved(value.node, "A retained or borrowed owner must be a distinct checked local value.");
        }
        if (premise.kind === "retained" && premise.reason === "module-owner" &&
          !source.ast.is.IsSourceFile(value.region.owner))
          return sourceDeclarationOwnershipUnresolved(value.node, "Program-duration retention requires its actual module owner.");
        if (premise.kind === "scoped-borrowed") {
          const regionFile = source.ast.getSourceFile(premise.region);
          if (regionFile === undefined || !source.semantics.includes(regionFile) || source.ast.is.IsSourceFile(premise.region))
            return sourceDeclarationOwnershipUnresolved(value.node, "A scoped lease needs its checked non-module lifetime region.");
          let current: Node | undefined = value.node;
          const visited = new Set<Node>();
          while (current !== undefined && current !== premise.region) {
            if (!budget.step(value.node)) return budget.failure()!;
            if (visited.has(current)) return sourceDeclarationOwnershipUnresolved(value.node, "A lease has cyclic checked ancestry.");
            visited.add(current);
            current = source.ast.parent(current);
          }
          if (current === undefined)
            return sourceDeclarationOwnershipUnresolved(value.node, "A scoped native lease must contain the actual local value.");
        }
        if (premise.kind === "formal-borrowed") {
          const semantics = source.semantics.forNode(value.node);
          const call = source.ast.is.IsCallExpression(value.node) || source.ast.is.IsNewExpression(value.node)
            ? semantics.operations.call(value.node) : undefined;
          const selectedDeclaration = call?.sourceSelectedSignatureKind === "resolved"
            ? semantics.declarations.signatureDeclaration(call.selectedSignature) : undefined;
          const region = premise.region;
          const formal = selectedDeclaration === premise.executionOwner && region.kind === "input-duration"
            ? call?.sourceSelectedSignatureParameters.find(parameter =>
                parameter.parameterDeclaration === region.parameter)?.parameterDeclaration
            : source.ast.is.IsParameterDeclaration(value.node) ? value.node
              : source.navigation.sourceReferenceFor(value.node)?.declaration;
          const nativeResult = call !== undefined && selectedDeclaration === premise.executionOwner;
          if (!nativeResult && (formal === undefined || !source.ast.is.IsParameterDeclaration(formal) ||
            source.ast.parent(formal) !== premise.executionOwner ||
            !source.ast.parameters(premise.executionOwner).includes(formal)))
            return sourceDeclarationOwnershipUnresolved(value.node,
              "A formal native lease must identify its original selected parameter and declaration owner.");
          if (region.kind === "input-duration") {
            if (region.parameter !== formal || formal === undefined)
              return sourceDeclarationOwnershipUnresolved(value.node, "Input-duration retention requires that exact native formal slot.");
            if (nativeResult) {
              const parameter = call.sourceSelectedSignatureParameters.find(selected => selected.parameterDeclaration === formal);
              const inputs = parameter === undefined ? [] : call.sourceArgumentBindings.filter(binding =>
                binding.sourceParameterIndex === parameter.parameterIndex);
              if (inputs.length !== 1 || inputs[0]!.sourceForm !== "value" ||
                source.ast.arguments(value.node)[inputs[0]!.sourceArgumentIndex] === undefined)
                return sourceDeclarationOwnershipUnresolved(value.node,
                  "A borrowed native result requires its exact completed caller-to-formal input correspondence.");
            }
          } else {
            const binding = semantics.types.typeArgumentBindings(value.component.selectedType)?.find(candidate =>
              candidate.declaration === region.binding.declaration &&
              semantics.types.isIdentical(candidate.parameterType, region.binding.parameterType) &&
              semantics.types.isIdentical(candidate.argumentType, region.binding.argumentType));
            const direct = call?.sourceSelectedMethodTypeArguments?.find(argument => {
              const symbol = semantics.declarations.typeSymbol(argument.typeParameter);
              return symbol !== undefined && semantics.declarations.symbolDeclarations(symbol).includes(region.binding.declaration) &&
                semantics.types.isIdentical(argument.typeParameter, region.binding.parameterType) &&
                semantics.types.isIdentical(argument.selectedType, region.binding.argumentType);
            });
            const argumentType = binding?.argumentType ?? direct?.selectedType;
            const symbol = argumentType === undefined ? undefined : semantics.declarations.typeSymbol(argumentType);
            if (argumentType === undefined || symbol === undefined || !source.ast.is.IsTypeParameterDeclaration(region.declaration) ||
              !semantics.declarations.symbolDeclarations(symbol).includes(region.declaration))
              return sourceDeclarationOwnershipUnresolved(value.node, "A formal lease needs its exact instantiated native type argument.");
            let owner: Node | undefined = nativeResult ? value.region.owner : premise.executionOwner;
            const visited = new Set<Node>();
            while (owner !== undefined && !source.ast.typeParameters(owner).includes(region.declaration)) {
              if (!budget.step(value.node)) return budget.failure()!;
              if (visited.has(owner)) return sourceDeclarationOwnershipUnresolved(value.node, "A generic lease has cyclic checked ancestry.");
              visited.add(owner);
              owner = source.ast.parent(owner);
            }
            if (owner === undefined)
              return sourceDeclarationOwnershipUnresolved(value.node, "A native region argument belongs to a different declaration environment.");
          }
        }
        if (premise.kind === "transferred") {
          const region = values.regionFor(premise.operation);
          if ("kind" in region) return region;
          if (region.owner !== value.region.owner)
            return sourceDeclarationOwnershipUnresolved(value.node, "A native transfer needs its actual declaration-local ownership operation.");
        }
        if (!rows.add(1)) return budget.failure()!;
        retained.push(Object.freeze({ ...premise }));
      }
      published = true;
      return Object.freeze({ kind: "resolved", premises: Object.freeze(retained) });
    } finally { if (!published) rows.release(); }
  };
  return Object.freeze({
    forValue(value: SourceDeclarationOwnershipValue): SourceDeclarationRetentionSelection {
      if (!budget.step(value.node)) return budget.failure()!;
      if (!values.owns(value))
        return sourceDeclarationOwnershipUnresolved(value.node, "Native retention requires the original immutable local descriptor.");
      const existing = actuals.get(value);
      if (existing !== undefined) return existing;
      const selected = premises.retentionFor({ kind: "value", value });
      if (selected === undefined)
        return sourceDeclarationOwnershipUnresolved(value.node, "The checked native value has no required retention or lifetime contract.");
      const result = validate(value, selected);
      if (result.kind === "resolved") actuals.set(value, result);
      return result;
    },
    forReference(reference: Node): SourceDeclarationRetentionReadSelection {
      if (!budget.step(reference)) return budget.failure()!;
      const existing = reads.get(reference);
      if (existing !== undefined) return existing;
      const value = values.forNode(reference);
      if ("kind" in value) return value;
      const selected = premises.retentionFor({ kind: "read-value", reference, value });
      if (selected === undefined)
        return sourceDeclarationOwnershipUnresolved(reference, "This exact checked read has no completed native retention contract.");
      const validated = validate(value, selected);
      if (validated.kind === "unresolved") return validated;
      const rows = budget.createRows(reference);
      if (!rows.add(2)) { rows.release(); return budget.failure()!; }
      const result = Object.freeze({ kind: "resolved" as const, reference, premises: validated.premises });
      reads.set(reference, result);
      return result;
    },
  });
}
