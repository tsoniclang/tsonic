import { AsCaseBlock, AsCaseOrDefaultClause, AsSwitchStatement } from "../../source-navigation/checked-casts.js";
import { Node_Name } from "../../source-model/ast.js";
import { sourceTypeDescriptorStructure, } from "../../source-semantics/descriptor-model.js";
import { sourceTypeDescriptorMayBeAbsent, sourceTypeDescriptorPresentArms } from "../../source-semantics/descriptor-arms.js";
import { sourceAnalysisValueType } from "../analysis-program.js";
/**
 * Answers whether a switch statement without a default clause selects a case for every value its discriminant can
 * hold (ruling Q79: baseline capability, units from the Host sum and relation of the subject). Units:
 * - a `boolean` Host type: true / false; an enum Host type: one unit per enum member;
 * - a member read `o.k`: the literal domain of member `k` in every arm of the receiver. The arms are those the Host
 *   per-arm relation at the read selects (a narrowed receiver keeps only its narrowed arms), else the present arms of
 *   the receiver's Host type. Each arm's member must carry its literal domain (descriptor member `literals`);
 * - any other subject: the Host literal domain of the value (values.literalDomain), else the literal-union annotation of
 *   its declaration (through non-generic aliases), declaration input. A narrowed discriminant is not covered.
 * A subject whose Host type may be absent (an optional discriminant, an optional member, an optional chain, a top arm)
 * also has the absence unit, which no case covers: the Host publishes no null / undefined distinction for a case, so
 * the switch keeps its fallthrough exit (baseline: an undefined member had no unit key). Each case contributes the unit
 * of its literal value or the enum member it references. Anything else is not proven covered.
 */
export function createSourceSwitchCoverage(source) {
    const { ast, navigation } = source;
    const literalKey = (literal) => {
        if (literal === undefined)
            return undefined;
        if (literal.form === "string" || literal.form === "template")
            return `string:${literal.text}`;
        if (literal.form === "true" || literal.form === "false")
            return `boolean:${literal.form === "true"}`;
        if (literal.form === "bigint" || literal.form === "prefix-unary" && literal.number === undefined && literal.integer !== undefined)
            return literal.integer === undefined ? undefined : `bigint:${literal.integer}`;
        if (literal.form === "numeric" || literal.form === "prefix-unary") {
            // Strict equality, which a case uses, does not distinguish 0 and -0.
            return literal.number === undefined ? undefined : `number:${literal.number === 0 ? 0 : literal.number}`;
        }
        return undefined;
    };
    const absenceUnit = "absence";
    const enumUnits = (declaration) => new Set(ast.members(declaration)
        .filter((member) => member !== undefined).map(member => enumKey(member)));
    const enumKeys = new WeakMap();
    let nextEnumKey = 0;
    const enumKey = (member) => {
        let key = enumKeys.get(member);
        if (key === undefined) {
            key = `enum:${nextEnumKey++}`;
            enumKeys.set(member, key);
        }
        return key;
    };
    const authoredUnits = (typeNode, depth) => {
        if (typeNode === undefined || depth > 32)
            return undefined;
        if (ast.is.IsParenthesizedTypeNode(typeNode))
            return authoredUnits(ast.as.AsParenthesizedTypeNode(typeNode)?.Type, depth + 1);
        if (ast.is.IsUnionTypeNode(typeNode)) {
            const units = new Set();
            for (const member of ast.as.AsUnionTypeNode(typeNode)?.Types?.Nodes ?? []) {
                const selected = authoredUnits(member, depth + 1);
                if (selected === undefined)
                    return undefined;
                for (const unit of selected)
                    units.add(unit);
            }
            return units;
        }
        if (ast.is.IsLiteralTypeNode(typeNode)) {
            const literal = ast.as.AsLiteralTypeNode(typeNode)?.Literal;
            const key = literal === undefined ? undefined : literalKey(source.facts.values.literal(literal));
            return key === undefined ? undefined : new Set([key]);
        }
        if (ast.is.IsTypeReferenceNode(typeNode)) {
            const reference = ast.as.AsTypeReferenceNode(typeNode);
            if (reference?.TypeArguments !== undefined || reference?.TypeName === undefined)
                return undefined;
            const declaration = navigation.declarationFor(reference.TypeName);
            if (declaration === undefined)
                return undefined;
            if (ast.is.IsEnumDeclaration(declaration))
                return enumUnits(declaration);
            if (ast.is.IsTypeAliasDeclaration(declaration) && ast.typeParameters(declaration).length === 0)
                return authoredUnits(ast.as.AsTypeAliasDeclaration(declaration)?.Type, depth + 1);
        }
        return undefined;
    };
    const descriptorLiteralKey = (literal) => literal.kind === "number"
        ? `number:${literal.value === 0 ? 0 : literal.value}` : `${literal.kind}:${String(literal.value)}`;
    /** The literal units of member `name` over the receiver arms, or undefined when some arm has no literal domain. */
    const memberUnits = (access) => {
        const selected = ast.as.AsPropertyAccessExpression(access);
        const receiver = selected?.Expression;
        const memberName = Node_Name(ast, access);
        const name = memberName === undefined ? undefined : ast.text(memberName);
        if (receiver === undefined || name === undefined)
            return undefined;
        const relation = source.facts.relations.at(access);
        let arms;
        if (relation?.kind === "per-arm") {
            const sum = source.facts.sums.sum(relation.sum);
            arms = relation.arms.map(entry => sum.arms[entry.arm]?.type).filter((arm) => arm !== undefined);
            if (arms.length !== relation.arms.length)
                return undefined;
        }
        else {
            const receiverType = sourceAnalysisValueType(source, receiver);
            if (receiverType === undefined)
                return undefined;
            arms = sourceTypeDescriptorPresentArms(receiverType);
        }
        if (arms.length === 0)
            return undefined;
        const units = new Set();
        for (const arm of arms) {
            const shape = sourceTypeDescriptorStructure(arm);
            if (shape.kind !== "shape")
                return undefined;
            const member = shape.members.find(candidate => candidate.name === name);
            if (member?.literals === undefined || member.literals.length === 0)
                return undefined;
            for (const literal of member.literals)
                units.add(descriptorLiteralKey(literal));
        }
        return units;
    };
    const discriminantUnits = (expression) => {
        const type = sourceAnalysisValueType(source, expression);
        if (type === undefined)
            return undefined;
        const arms = sourceTypeDescriptorPresentArms(type).map(sourceTypeDescriptorStructure);
        if (arms.length === 0)
            return undefined;
        let units;
        if (arms.every(arm => arm.kind === "primitive" && arm.primitive === "bool"))
            units = new Set(["boolean:true", "boolean:false"]);
        else if (arms.every(arm => arm.kind === "declared" && ast.is.IsEnumDeclaration(arm.declaration))) {
            units = new Set(arms.flatMap(arm => arm.kind === "declared" ? [...enumUnits(arm.declaration)] : []));
        }
        else if (ast.is.IsPropertyAccessExpression(expression))
            units = memberUnits(expression);
        else {
            // A plain subject: the Host literal domain of the value (an inferred discriminant: a constant, a conditional or
            // `??` of constants, an unannotated unwritten local's initializer), else its declaration's literal-union annotation.
            const domain = source.facts.values.literalDomain(expression);
            if (domain !== undefined) {
                const keys = domain.map(literalKey);
                units = keys.every((key) => key !== undefined) ? new Set(keys) : undefined;
            }
            else {
                const declaration = navigation.declarationFor(expression);
                units = declaration === undefined ? undefined : authoredUnits(ast.typeNode(declaration), 0);
            }
        }
        if (units === undefined)
            return undefined;
        // An optional discriminant (or optional member, optional chain, top arm) also holds absence, which no case covers.
        if (sourceTypeDescriptorMayBeAbsent(ast, type))
            units.add(absenceUnit);
        return units;
    };
    const caseKey = (expression) => {
        const literal = literalKey(source.facts.values.literal(expression));
        if (literal !== undefined)
            return literal;
        const declaration = navigation.declarationFor(expression);
        return declaration !== undefined && ast.is.IsEnumMember(declaration) ? enumKey(declaration) : undefined;
    };
    return (switchStatement) => {
        const statement = AsSwitchStatement(ast, switchStatement);
        const block = statement?.CaseBlock;
        const clauses = block === undefined ? undefined : AsCaseBlock(ast, block)?.Clauses?.Nodes;
        if (statement?.Expression === undefined || clauses === undefined)
            return false;
        const required = discriminantUnits(statement.Expression);
        if (required === undefined || required.size === 0)
            return false;
        for (const clause of clauses) {
            if (clause === undefined || ast.is.IsDefaultClause(clause))
                return false;
            const expression = AsCaseOrDefaultClause(ast, clause)?.Expression;
            const key = expression === undefined ? undefined : caseKey(expression);
            if (key !== undefined)
                required.delete(key);
        }
        return required.size === 0;
    };
}
//# sourceMappingURL=switch-coverage.js.map