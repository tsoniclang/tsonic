import { sourceNodeIdentity, sourceNodesEqual } from "./identity.js";
export function createSourceMemberDispatchNavigation(source, sourceFiles, referenceFor, isProjectDeclaration) {
    const ast = source.ast;
    const cache = new Map();
    const classDeclarations = collectClassDeclarations(ast, sourceFiles);
    const memberDispatch = (node) => {
        if (node === undefined) {
            return undefined;
        }
        const nodeKey = sourceNodeIdentity(ast, node);
        const cached = nodeKey === undefined ? undefined : cache.get(nodeKey);
        if (cached !== undefined) {
            return cached ?? undefined;
        }
        if (!isDispatchMember(ast, node, isProjectDeclaration)) {
            if (nodeKey !== undefined) {
                cache.set(nodeKey, null);
            }
            return undefined;
        }
        const classDeclaration = ast.parent(node);
        if (classDeclaration === undefined ||
            !isClassDefinition(ast, classDeclaration)) {
            if (nodeKey !== undefined) {
                cache.set(nodeKey, null);
            }
            return undefined;
        }
        const memberName = dispatchMemberName(ast, node);
        if (memberName === undefined) {
            if (nodeKey !== undefined) {
                cache.set(nodeKey, null);
            }
            return undefined;
        }
        const result = {
            overridesBase: memberOverridesBase(source, ast, classDeclaration, node, referenceFor, isProjectDeclaration),
            hasDerivedOverride: hasDerivedOverride(source, ast, classDeclarations, classDeclaration, memberName, referenceFor, isProjectDeclaration),
        };
        if (nodeKey !== undefined) {
            cache.set(nodeKey, result);
        }
        return result;
    };
    return Object.freeze({ memberDispatch });
}
function isDispatchMember(ast, node, isProjectDeclaration) {
    return node !== undefined &&
        isProjectDeclaration(node) &&
        (ast.is.IsMethodDeclaration(node) ||
            ast.is.IsGetAccessorDeclaration(node) ||
            ast.is.IsSetAccessorDeclaration(node) ||
            ast.is.IsPropertyDeclaration(node)) &&
        !ast.hasModifierKind(node, "private") &&
        !ast.hasModifierKind(node, "static") &&
        dispatchMemberName(ast, node) !== undefined;
}
function dispatchMemberName(ast, member) {
    const name = ast.name(member);
    return name !== undefined &&
        (ast.is.IsIdentifier(name) ||
            ast.is.IsStringLiteral(name) ||
            ast.is.IsNumericLiteral(name))
        ? ast.text(name)
        : undefined;
}
function memberOverridesBase(source, ast, classDeclaration, member, referenceFor, isProjectDeclaration) {
    const base = projectBaseClassDeclaration(ast, classDeclaration, referenceFor);
    if (base === undefined) {
        return false;
    }
    return isDispatchMember(ast, source.declaredMember(base, member)?.[0], isProjectDeclaration);
}
function hasDerivedOverride(source, ast, classes, baseClass, memberName, referenceFor, isProjectDeclaration) {
    for (const candidate of classes) {
        if (sourceNodesEqual(ast, candidate, baseClass) ||
            !classExtends(ast, candidate, baseClass, referenceFor, new Set())) {
            continue;
        }
        const candidateMember = ast.members(candidate).find((member) => member !== undefined &&
            isDispatchMember(ast, member, isProjectDeclaration) &&
            dispatchMemberName(ast, member) === memberName);
        if (candidateMember !== undefined &&
            memberOverridesBase(source, ast, candidate, candidateMember, referenceFor, isProjectDeclaration)) {
            return true;
        }
    }
    return false;
}
function classExtends(ast, candidate, expectedBase, referenceFor, seen) {
    const candidateKey = sourceNodeIdentity(ast, candidate);
    if (candidateKey === undefined || seen.has(candidateKey)) {
        return false;
    }
    seen.add(candidateKey);
    const directBase = projectBaseClassDeclaration(ast, candidate, referenceFor);
    return sourceNodesEqual(ast, directBase, expectedBase) ||
        (directBase !== undefined &&
            classExtends(ast, directBase, expectedBase, referenceFor, seen));
}
function projectBaseClassDeclaration(ast, classDeclaration, referenceFor) {
    const reference = referenceFor(baseClassReferenceNode(ast, classDeclaration));
    return reference !== undefined && isClassDefinition(ast, reference.declaration)
        ? reference.declaration
        : undefined;
}
function baseClassReferenceNode(ast, classDeclaration) {
    for (const heritage of ast.extendsHeritageElements(classDeclaration)) {
        if (heritage !== undefined && ast.is.IsExpressionWithTypeArguments(heritage)) {
            return ast.as.AsExpressionWithTypeArguments(heritage)?.Expression;
        }
    }
    return undefined;
}
function collectClassDeclarations(ast, sourceFiles) {
    const declarations = [];
    const visit = (node) => {
        if (node === undefined) {
            return;
        }
        if (isClassDefinition(ast, node)) {
            declarations.push(node);
        }
        ast.forEachChild(node, visit);
    };
    for (const sourceFile of sourceFiles) {
        visit(sourceFile);
    }
    return Object.freeze(declarations);
}
function isClassDefinition(ast, node) {
    return ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node);
}
//# sourceMappingURL=member-dispatch.js.map