import { sourceTypeDescriptorArms, sourceTypeDescriptorIsAbsentArm, sourceTypeDescriptorIsNeverArm } from "../../source-semantics/descriptor-arms.js";
import { sourceTypeDescriptorOpenness } from "../../source-semantics/local-type-flow/uses.js";
import { sourceAnalysisIncludesNode, sourceAnalysisIsScalar } from "../analysis-program.js";
import { Node_Expression } from "../../source-navigation/index.js";
import { sourceDeclarationOwnershipContractProblem, sourceDeclarationOwnershipUnresolved } from "./contracts.js";
export function createSourceDeclarationSuspensionQuery(input) {
    const { source, values, premises, budget } = input;
    const operations = new Map();
    const results = new Map();
    const pending = new WeakSet();
    const select = (operation, selection) => {
        const subject = selection.kind === "expression" ? selection.expression : selection.declaration;
        const use = selection.kind === "expression" ? selection.use : "resource-cleanup";
        if (!budget.step(operation))
            return budget.failure();
        const cache = use === "operation" ? operations : results;
        const existing = cache.get(operation);
        if (existing !== undefined)
            return existing;
        const region = values.regionFor(operation);
        if ("kind" in region)
            return region;
        const value = values.forNode(subject);
        if ("kind" in value)
            return value;
        if (value.region !== region)
            return sourceDeclarationOwnershipUnresolved(operation, "A native pending operand must belong to this exact checked execution region.");
        if (use === "value") {
            // A value whose every Host arm is never, a scalar or absence cannot be a pending native completion.
            const arms = sourceTypeDescriptorArms(value.component.type);
            const immediate = arms.length !== 0 && arms.every(arm => budget.step(subject) && sourceTypeDescriptorOpenness(source.ast, arm) !== "top" &&
                (sourceTypeDescriptorIsNeverArm(arm) || sourceTypeDescriptorIsAbsentArm(arm) ||
                    sourceAnalysisIsScalar(arm, node => source.ast.is.IsEnumDeclaration(node))));
            if (immediate) {
                const rows = budget.createRows(operation);
                if (!rows.add(2)) {
                    rows.release();
                    return budget.failure();
                }
                const result = Object.freeze({ kind: "never" });
                cache.set(operation, result);
                return result;
            }
            const failure = budget.failure();
            if (failure !== undefined)
                return failure;
        }
        const selected = premises.suspensionFor(value, use);
        if (selected === undefined)
            return sourceDeclarationOwnershipUnresolved(subject, "A missing declaration body or native completion record is not proof of a non-suspending operation.");
        if (selected.kind === "unresolved")
            return selected;
        if (selected.value !== value)
            return sourceDeclarationOwnershipUnresolved(subject, "Native suspension evidence belongs to a different checked local operand.");
        const problem = sourceDeclarationOwnershipContractProblem(source, subject, value.component, selected.contract);
        if (problem !== undefined)
            return sourceDeclarationOwnershipUnresolved(subject, problem);
        const rows = budget.createRows(operation);
        if (!rows.add(selected.kind === "never" ? 2 : 4)) {
            rows.release();
            return budget.failure();
        }
        if (selected.kind === "never") {
            const result = Object.freeze({ kind: "never" });
            cache.set(operation, result);
            return result;
        }
        const contracts = Object.freeze([Object.freeze({ value, contract: selected.contract })]);
        const witness = selection.kind === "expression"
            ? Object.freeze({ kind: "expression", operation, expression: subject, region, contracts })
            : Object.freeze({ kind: "resource-cleanup", operation, declaration: selection.declaration, region, contracts });
        pending.add(witness);
        const result = Object.freeze({ kind: "resolved", pending: witness });
        cache.set(operation, result);
        return result;
    };
    return Object.freeze({
        owns: (witness) => pending.has(witness),
        forAwait(operation) {
            if (!budget.step(operation))
                return budget.failure();
            const expression = source.ast.is.IsAwaitExpression(operation)
                ? Node_Expression(source.ast, operation) : undefined;
            if (!sourceAnalysisIncludesNode(source, operation) || expression === undefined)
                return sourceDeclarationOwnershipUnresolved(operation, "A pending await requires its original checked operation and operand.");
            return select(operation, { kind: "expression", expression, use: "value" });
        },
        forResourceCleanup(declaration) {
            const operation = declaration;
            if (!budget.step(operation))
                return budget.failure();
            if (!sourceAnalysisIncludesNode(source, operation) || !source.ast.is.IsVariableDeclaration(operation) ||
                source.ast.variableDeclarationKind(operation) !== "await using")
                return sourceDeclarationOwnershipUnresolved(operation, "Cleanup suspension requires its original checked await-using declaration.");
            // The Host resource selection: an async disposal selected for this declaration. The cleaned value is the
            // declaration's own Host value (values.forNode(declaration)).
            const selected = source.facts.selections.resource(declaration);
            if (selected === undefined || "kind" in selected || selected.declaration !== declaration || !selected.async)
                return sourceDeclarationOwnershipUnresolved(operation, "Cleanup suspension requires its exact checked acquisition and selected disposal facts.");
            return select(operation, { kind: "resource-cleanup", declaration });
        },
        forCall(call) {
            if (!budget.step(call))
                return budget.failure();
            if (!sourceAnalysisIncludesNode(source, call) ||
                !source.ast.is.IsCallExpression(call) && !source.ast.is.IsNewExpression(call))
                return sourceDeclarationOwnershipUnresolved(call, "Native completion requires its exact checked call operation.");
            const selected = source.navigation.call(call);
            if (selected?.selection !== "resolved")
                return sourceDeclarationOwnershipUnresolved(call, "Native completion requires its checked selected declaration contract.");
            return select(call, { kind: "expression", expression: call, use: "operation" });
        },
        forResult(expression) {
            return select(expression, { kind: "expression", expression, use: "value" });
        },
    });
}
//# sourceMappingURL=suspension.js.map