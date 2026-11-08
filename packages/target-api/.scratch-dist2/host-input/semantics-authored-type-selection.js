import { sourceTypeRelationship } from "./semantics-type-relationship.js";
import { sourceTypeMemberRefines } from "./semantics-type-refinement.js";
import { sourceBoundTypeRelationship } from "./semantics-bound-type-relationship.js";
export function selectAuthoredSourceType(ast, types, checker, facts, authoredTypeNode, selectedType, semantics) {
    const authoredType = checker.getTypeFromTypeNode(authoredTypeNode);
    if (authoredType === undefined) {
        return { kind: "unrelated" };
    }
    const directRelationship = sourceTypeRelationship(types, checker, facts, authoredType, selectedType);
    const preservesArguments = (authored, selected) => authored === selected || !types.isTypeReference(authored) || !types.isTypeReference(selected) ||
        types.couldContainTypeVariables(authored) || types.couldContainTypeVariables(selected) ||
        sourceBoundTypeRelationship(authored, selected, semantics, () => undefined) !== undefined;
    if (directRelationship !== "unrelated" && preservesArguments(authoredType, selectedType)) {
        return {
            kind: "authored-members",
            nodes: Object.freeze([authoredTypeNode]),
            selectedNullishTypes: Object.freeze([]),
        };
    }
    const authoredMembers = authoredUnionMemberNodes(ast, authoredTypeNode) ??
        [authoredTypeNode];
    const rawSelectedMembers = types.isUnion(selectedType)
        ? types.getUnionOrIntersectionTypes(selectedType)
        : [selectedType];
    if (rawSelectedMembers.some((member) => member === undefined)) {
        return { kind: "unrelated" };
    }
    const selectedMembers = rawSelectedMembers.filter((member) => member !== undefined);
    const authoredMemberTypes = new Map(authoredMembers.map((node) => [node, checker.getTypeFromTypeNode(node)]));
    const retainedUnionMembers = new Map();
    for (const [node, type] of authoredMemberTypes) {
        if (type === undefined || !types.isUnion(type))
            continue;
        const members = types.getUnionOrIntersectionTypes(type);
        if (members.length > 0 && members.every((member) => member !== undefined && selectedMembers.includes(member))) {
            retainedUnionMembers.set(node, members);
        }
    }
    const selectedNodes = [];
    const selectedNullishTypes = [];
    for (const selectedMember of selectedMembers) {
        const candidates = authoredMembers.filter((authoredMember) => {
            const authoredMemberType = authoredMemberTypes.get(authoredMember);
            return retainedUnionMembers.get(authoredMember)?.includes(selectedMember) === true ||
                authoredMemberType !== undefined &&
                    preservesArguments(authoredMemberType, selectedMember) &&
                    sourceTypeMemberRefines(types, checker, facts, authoredMemberType, selectedMember);
        });
        if (candidates.length === 0) {
            if (types.isNullish(selectedMember)) {
                if (!selectedNullishTypes.includes(selectedMember)) {
                    selectedNullishTypes.push(selectedMember);
                }
                continue;
            }
            return { kind: "unrelated" };
        }
        if (candidates.length !== 1) {
            return { kind: "ambiguous" };
        }
        if (!selectedNodes.includes(candidates[0])) {
            selectedNodes.push(candidates[0]);
        }
    }
    return {
        kind: "authored-members",
        nodes: Object.freeze(selectedNodes),
        selectedNullishTypes: Object.freeze(selectedNullishTypes),
    };
}
function authoredUnionMemberNodes(ast, node) {
    if (ast.is.IsUnionTypeNode(node)) {
        return Object.freeze(ast.children(node).filter((child) => child !== undefined));
    }
    if (ast.is.IsParenthesizedTypeNode(node)) {
        const inner = ast.as.AsParenthesizedTypeNode(node)?.Type;
        return inner === undefined
            ? undefined
            : authoredUnionMemberNodes(ast, inner);
    }
    return undefined;
}
//# sourceMappingURL=semantics-authored-type-selection.js.map