import { sourcePrimitiveFactKey } from "@tsonic/tsts";
import { sourceSelectedFactSubjects, sourceTypeFactSubjects } from "./semantics-fact-subjects.js";
export function authoredSourceTypeFactDependencies(ast, navigation, facts, checker, node) {
    return collectAuthoredSourceTypeFactDependencies(ast, navigation, facts, checker, node).subjects;
}
export function authoredSourceTypeFactNodes(ast, navigation, facts, checker, node) {
    return collectAuthoredSourceTypeFactDependencies(ast, navigation, facts, checker, node).nodes;
}
function collectAuthoredSourceTypeFactDependencies(ast, navigation, facts, checker, node) {
    const visited = new Set();
    const nodes = [];
    const subjects = [];
    const visit = (current) => {
        if (current === undefined || visited.has(current)) {
            return;
        }
        visited.add(current);
        const hasFacts = facts.getFacts(current).length > 0;
        if (hasFacts) {
            subjects.push(current);
        }
        if (ast.is.IsImportTypeNode(current)) {
            const qualifier = ast.as.AsImportTypeNode(current)?.Qualifier;
            const symbol = qualifier === undefined ? undefined : checker.getSymbolAtLocation(qualifier);
            for (const subject of sourceSelectedFactSubjects(checker, symbol, undefined)) {
                if (facts.getFacts(subject).length > 0 && !subjects.includes(subject))
                    subjects.push(subject);
            }
        }
        if (hasFacts || ast.is.IsKeywordTypeNode(current) || ast.is.IsIndexedAccessTypeNode(current) ||
            ast.is.IsArrayTypeNode(current) || ast.is.IsTupleTypeNode(current) ||
            ast.is.IsFunctionTypeNode(current) || ast.is.IsConstructorTypeNode(current) ||
            ast.is.IsUnionTypeNode(current) || ast.is.IsIntersectionTypeNode(current) ||
            ast.is.IsParenthesizedTypeNode(current)) {
            nodes.push(current);
        }
        ast.forEachChild(current, visit);
        if (!ast.is.IsTypeReferenceNode(current) || facts.getFact(current, sourcePrimitiveFactKey) !== undefined) {
            return;
        }
        const typeName = ast.as.AsTypeReferenceNode(current)?.TypeName;
        const reference = navigation.referenceFor(typeName);
        if (reference !== undefined &&
            ast.is.IsTypeAliasDeclaration(reference.declaration)) {
            visit(ast.as.AsTypeAliasDeclaration(reference.declaration)?.Type);
        }
    };
    visit(node);
    const type = checker.getTypeFromTypeNode(node);
    if (type !== undefined) {
        for (const subject of sourceTypeFactSubjects(checker, type)) {
            if (facts.getFacts(subject).length > 0 && !subjects.includes(subject)) {
                subjects.push(subject);
            }
        }
    }
    return Object.freeze({
        nodes: Object.freeze(nodes),
        subjects: Object.freeze(subjects),
    });
}
//# sourceMappingURL=semantics-authored-type-facts.js.map