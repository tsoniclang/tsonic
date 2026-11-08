import { sourceBindingHasMutableExposure } from "../source-navigation/binding-mutation-exposure.js";
import { Node_Expression } from "../source-model/ast.js";
import { sourceGuardPreservesBinding } from "./guard-preservation.js";
import { createSourceSyntaxDomain } from "../source-navigation/node-inventory.js";
export function selectSourceNativeGuardResult(context, expression, membersFor, selectGuard, testMember) {
    let current = expression;
    let negated = false;
    const contains = createSourceSyntaxDomain(context.ast, expression);
    const visited = new Set();
    while (contains(current) && !visited.has(current)) {
        visited.add(current);
        const kind = context.ast.kindName(current);
        if (kind === "KindTrueKeyword" || kind === "KindFalseKeyword")
            return (kind === "KindTrueKeyword") !== negated;
        if (context.ast.is.IsParenthesizedExpression(current) || context.ast.is.IsSatisfiesExpression(current) ||
            context.ast.is.IsNonNullExpression(current)) {
            const inner = Node_Expression(context.ast, current);
            if (inner === undefined)
                return undefined;
            current = inner;
            continue;
        }
        if (context.ast.is.IsPrefixUnaryExpression(current) &&
            context.ast.operatorKindName(current) === "KindExclamationToken") {
            const operand = context.ast.as.AsPrefixUnaryExpression(current)?.Operand;
            if (operand === undefined)
                return undefined;
            current = operand;
            negated = !negated;
            continue;
        }
        const guard = selectGuard(current);
        if (guard === undefined)
            return undefined;
        const members = membersFor(guard.sourceOperand);
        if (members === undefined || members.length === 0)
            return undefined;
        const selected = selectSourceGuardedValueMembers(context, guard.sourceOperand, members, selectGuard, testMember) ?? members;
        if (selected.length === 0)
            return undefined;
        const results = selected.map(member => testMember(member, guard.predicate));
        const result = results.every(value => value === true) ? true
            : results.every(value => value === false) ? false : undefined;
        return result === undefined ? undefined : result !== negated;
    }
    return undefined;
}
export function selectSourceGuardedValueMembers(context, reference, members, selectGuard, testMember) {
    if (!context.ast.is.IsIdentifier(reference))
        return undefined;
    const binding = context.navigation.referenceFor(reference);
    if (binding === undefined ||
        !context.ast.is.IsVariableDeclaration(binding.declaration) &&
            !context.ast.is.IsParameterDeclaration(binding.declaration) &&
            !context.ast.is.IsBindingElement(binding.declaration))
        return undefined;
    const summary = context.navigation.declarationUseSummary(binding.declaration);
    if (summary.exported)
        return undefined;
    const capturedWrites = summary.uses.some(use => use.captured && use.role === "write" && !use.throughMember);
    const enter = createSourceSyntaxDomain(context.ast, reference);
    if (sourceBindingHasMutableExposure(context, summary, enter))
        return undefined;
    const flow = context.flowConditions(reference);
    if (flow === undefined || flow.reference !== reference)
        return undefined;
    let selected = members;
    let consulted = false;
    let invalid = false;
    const selectCondition = (expression, assumed, values) => {
        const active = new Set();
        const results = [];
        const pending = [{ expression, assumed }];
        while (pending.length !== 0) {
            const current = pending.pop();
            if (current.combine !== undefined) {
                active.delete(current.expression);
                if (current.combine === "transparent")
                    continue;
                const right = results.pop();
                const left = results.pop();
                results.push(current.combine === "intersection"
                    ? left === undefined ? right : right === undefined ? left : left.filter(member => right.includes(member))
                    : left === undefined || right === undefined ? undefined : values.filter(member => left.includes(member) || right.includes(member)));
                continue;
            }
            const node = current.expression;
            if (!enter(node) || active.has(node)) {
                invalid = true;
                return undefined;
            }
            active.add(node);
            const transparent = context.ast.is.IsParenthesizedExpression(node) || context.ast.is.IsSatisfiesExpression(node) ||
                context.ast.is.IsNonNullExpression(node);
            const negated = context.ast.is.IsPrefixUnaryExpression(node) && context.ast.operatorKindName(node) === "KindExclamationToken";
            if (transparent || negated) {
                const operand = negated ? context.ast.as.AsPrefixUnaryExpression(node)?.Operand : Node_Expression(context.ast, node);
                if (operand === undefined) {
                    active.delete(node);
                    results.push(undefined);
                    continue;
                }
                pending.push({ ...current, combine: "transparent" }, { expression: operand,
                    assumed: negated ? !current.assumed : current.assumed });
                continue;
            }
            const operator = context.ast.operatorKindName(node);
            if (context.ast.is.IsBinaryExpression(node) &&
                (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken")) {
                const binary = context.ast.as.AsBinaryExpression(node);
                if (binary?.Left !== undefined && binary.Right !== undefined) {
                    pending.push({ ...current, combine: (operator === "KindAmpersandAmpersandToken") === current.assumed ? "intersection" : "union" }, { expression: binary.Right, assumed: current.assumed }, { expression: binary.Left, assumed: current.assumed });
                    continue;
                }
                active.delete(node);
                results.push(undefined);
                continue;
            }
            const guard = selectGuard(node);
            results.push(guard === undefined || !context.ast.is.IsIdentifier(guard.sourceOperand) ||
                context.navigation.referenceFor(guard.sourceOperand)?.declaration !== binding.declaration ? undefined
                : values.filter(member => {
                    const result = testMember(member, guard.predicate);
                    return result === undefined || result === current.assumed;
                }));
            active.delete(node);
        }
        return results.length === 1 ? results[0] : undefined;
    };
    for (const condition of flow.conditions) {
        if (!enter(condition.expression))
            return undefined;
        if (condition.assignments.some(assignment => context.navigation.bindingWritesWithin(binding.declaration, assignment).length > 0))
            continue;
        if (capturedWrites && !sourceGuardPreservesBinding(context, condition.expression, reference, condition.assumed, enter))
            continue;
        const narrowed = selectCondition(condition.expression, condition.assumed, selected);
        if (invalid)
            return undefined;
        if (narrowed === undefined)
            continue;
        consulted = true;
        selected = narrowed;
    }
    return consulted ? Object.freeze([...selected]) : undefined;
}
//# sourceMappingURL=value-flow-conditions.js.map