import { sourceTypeDescriptorArms, sourceTypeDescriptorIsAbsentArm, sourceTypeDescriptorIsNeverArm } from "../../../source-semantics/descriptor-arms.js";
import { sourceTypeDescriptorOpenness } from "../../../source-semantics/local-type-flow/uses.js";
import { selectSourceNativeValueGuard } from "../../../source-semantics/native-value-guards.js";
import { selectSourceGuardedValueMembers } from "../../../source-semantics/value-flow-conditions.js";
import { sourceConstructionExpression } from "../../../source-navigation/class-initialization.js";
import { sourceStorageHasOriginalCallableValue } from "../model/subjects.js";
import { sourceStorageIsAbsentType, sourceStorageIsNeverType, sourceStorageIsScalarType, sourceStorageSubjectType } from "../model/components.js";
export function createSourceStorageGuardedValues(source, budget, classValues) {
    const { ast, navigation } = source;
    // Guard selection reads the Host flow conditions and Host value descriptors (R3), never the checker.
    const context = { ast, navigation, sourceFacts: source.sourceFacts, values: source.facts.values,
        effects: source.facts.navigation.expressions.effects,
        flowConditions: (reference) => source.flowConditions(reference) };
    const retained = budget.createRows();
    const plans = new Map();
    const admissions = new Map();
    const conjunctions = new Map();
    const classMatches = (candidate, target) => budget.withRows(rows => {
        let current = candidate;
        const visited = new Set();
        while (true) {
            if (!budget.step())
                return undefined;
            if (current === target)
                return true;
            if (visited.has(current) || !rows.add(1))
                return undefined;
            visited.add(current);
            const heritage = navigation.declaredHeritage(current);
            if (heritage.kind !== "resolved")
                return undefined;
            const bases = heritage.edges.filter(edge => edge.kind === "extends");
            if (bases.length === 0)
                return false;
            if (bases.length !== 1)
                return undefined;
            const base = bases[0].target.declaration;
            if (!ast.is.IsClassDeclaration(base) && !ast.is.IsClassExpression(base))
                return undefined;
            current = base;
        }
    });
    const instanceOf = (owner, target) => {
        if (owner.projection.length !== 0)
            return undefined;
        if (ast.is.IsArrayLiteralExpression(owner.node) || ast.is.IsObjectLiteralExpression(owner.node) ||
            sourceStorageHasOriginalCallableValue(owner, ast))
            return false;
        const file = ast.getSourceFile(owner.node);
        const type = sourceStorageSubjectType(source, owner, file);
        if (type !== undefined && file !== undefined && (sourceStorageIsScalarType(type, ast) || sourceStorageIsAbsentType(type) ||
            sourceStorageIsNeverType(type)))
            return false;
        const expression = sourceConstructionExpression(owner.node, source, budget.step);
        const declaration = expression === undefined ? undefined : navigation.sourceReferenceFor(expression)?.declaration;
        if (declaration !== undefined && (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)))
            return classMatches(declaration, target);
        const lineages = expression === undefined ? undefined : classValues(expression);
        if (lineages === undefined || lineages.length === 0)
            return undefined;
        let result;
        for (const lineage of lineages) {
            if (!budget.step())
                return undefined;
            const candidate = lineage.classes[0]?.subject.node;
            const matches = candidate === undefined ? undefined : classMatches(candidate, target);
            if (matches === undefined || result !== undefined && result !== matches)
                return undefined;
            result = matches;
        }
        return result;
    };
    const absent = (owner) => {
        const file = ast.getSourceFile(owner.node);
        const type = sourceStorageSubjectType(source, owner, file);
        if (file === undefined || type === undefined)
            return undefined;
        let result;
        for (const member of sourceTypeDescriptorArms(type)) {
            if (!budget.step())
                return undefined;
            if (sourceTypeDescriptorIsNeverArm(member))
                continue;
            let selected;
            if (sourceTypeDescriptorIsAbsentArm(member))
                selected = true;
            else {
                if (sourceTypeDescriptorOpenness(source.ast, member) === "top")
                    return undefined;
                selected = false;
            }
            if (result !== undefined && selected !== result)
                return undefined;
            result = selected;
        }
        return result;
    };
    const testOwner = (owner, predicate) => {
        if (predicate.kind === "nominal")
            return instanceOf(owner, predicate.declaration);
        const result = absent(owner);
        return result === undefined ? undefined : result !== predicate.negated;
    };
    const guardFor = (expression) => {
        if (!budget.step())
            return undefined;
        const guard = selectSourceNativeValueGuard(context, expression);
        if (guard?.kind === "absence")
            return { sourceOperand: guard.sourceOperand,
                predicate: { kind: "absence", negated: guard.negated } };
        if (guard?.kind !== "nominal")
            return undefined;
        if (ast.is.IsClassDeclaration(guard.declaration) || ast.is.IsClassExpression(guard.declaration))
            return { sourceOperand: guard.sourceOperand, predicate: { kind: "nominal", declaration: guard.declaration } };
        const lineages = classValues(guard.sourceConstructor);
        if (lineages === undefined || lineages.length === 0 || lineages.some(lineage => !lineage.complete))
            return undefined;
        const target = lineages[0]?.classes[0]?.subject.node;
        return target === undefined || lineages.some(lineage => lineage.classes[0]?.subject.node !== target) ? undefined : { sourceOperand: guard.sourceOperand,
            predicate: { kind: "nominal", declaration: target } };
    };
    const planFor = (reference) => budget.withRows(rows => {
        if (!budget.step())
            return undefined;
        if (plans.has(reference))
            return plans.get(reference) ?? undefined;
        const predicates = new Set();
        const selected = selectSourceGuardedValueMembers(context, reference, [reference], guardFor, (_member, predicate) => {
            if (predicate.kind === "nominal" && !predicates.has(predicate.declaration) && rows.add(1))
                predicates.add(predicate.declaration);
            return undefined;
        });
        if (budget.failure() !== undefined || !retained.add(1 + predicates.size))
            return undefined;
        const plan = selected === undefined ? null : Object.freeze({ identity: plans.size, predicates: Object.freeze([...predicates]) });
        plans.set(reference, plan);
        return plan ?? undefined;
    });
    const appliesTo = (reference) => {
        const plan = planFor(reference);
        return budget.failure() === undefined ? plan !== undefined : undefined;
    };
    const admits = (owner, reference) => {
        if (!budget.step())
            return undefined;
        const previous = admissions.get(reference);
        const cached = previous?.get(owner);
        if (cached !== undefined)
            return cached ?? undefined;
        let unknown = false;
        const selected = selectSourceGuardedValueMembers(context, reference, [owner], guardFor, (subject, predicate) => {
            const result = testOwner(subject, predicate);
            unknown || (unknown = result === undefined);
            return result;
        });
        if (budget.failure() !== undefined || !retained.add(previous === undefined ? 2 : 1))
            return undefined;
        const admitted = selected === undefined ? null : selected.length === 0 ? false : unknown ? null : true;
        const values = previous ?? new Map();
        values.set(owner, admitted);
        admissions.set(reference, values);
        return admitted ?? undefined;
    };
    const conjoin = (existing, reference) => budget.withRows(rows => {
        const plan = planFor(reference);
        if (plan === undefined || existing?.references.includes(reference))
            return existing;
        const references = [...existing?.references ?? [], reference];
        if (!rows.add(references.length))
            return undefined;
        references.sort((left, right) => plans.get(left).identity - plans.get(right).identity);
        const key = references.map(reference => plans.get(reference).identity).join(":");
        if (conjunctions.has(key))
            return conjunctions.get(key);
        const predicates = new Set();
        for (const reference of references)
            for (const predicate of plans.get(reference).predicates) {
                if (!budget.step())
                    return undefined;
                if (!predicates.has(predicate)) {
                    if (!rows.add(1))
                        return undefined;
                    predicates.add(predicate);
                }
            }
        if (!rows.add(predicates.size + 2))
            return undefined;
        const possibilities = [{ kind: "absence" }, { kind: "present" }];
        for (const declaration of predicates) {
            if (!budget.step())
                return undefined;
            possibilities.push({ kind: "present", declaration });
        }
        let candidates = possibilities;
        for (const reference of references) {
            if (!budget.step())
                return undefined;
            candidates = selectSourceGuardedValueMembers(context, reference, candidates, guardFor, (candidate, predicate) => predicate.kind === "absence" ? (candidate.kind === "absence") !== predicate.negated
                : candidate.kind === "absence" || candidate.declaration === undefined ? false
                    : classMatches(candidate.declaration, predicate.declaration)) ?? candidates;
        }
        if (budget.failure() !== undefined || !retained.add(1 + (candidates.length === 0 ? 0 : references.length)))
            return undefined;
        const selected = candidates.length === 0 ? null : Object.freeze({ key, references: Object.freeze(references) });
        conjunctions.set(key, selected);
        return selected;
    });
    return Object.freeze({ appliesTo, admits, conjoin });
}
//# sourceMappingURL=guarded-values.js.map