import { sourceTypeDescriptorMemberOrigin } from "./member-origins.js";
import { sourceObjectLiteralDestinationMember } from "./semantics-object-literal-correspondence.js";
import { createSourceHostNullishComponents } from "./nullish-components.js";
import { checkerType, createSourceHostQueries, hostComponent, sourceHostAbsentConstituent, sourceHostPresence, sourceHostTypeDeclaration, } from "./queries.js";
const presenceOf = (queries, type) => sourceHostPresence(queries.types, type);
/** One adapter per program view; lifetime is the program's (I5). */
export function createSourceHostInput(services) {
    const { ast, semantics, sourceFacts, navigation, sourceFiles, platform } = services;
    const reader = Object.freeze({ ast, navigation, sourceFacts, sourceFiles, platform,
        enumIntegerWidth: (declaration) => services.enumIntegerWidth(declaration) });
    const calls = new Map();
    const members = new Map();
    const presences = new Map();
    const declaredMembers = new Map();
    const facades = new Map();
    const facade = (queries) => {
        let selected = facades.get(queries);
        if (selected === undefined) {
            selected = createSourceHostQueries(ast, queries, sourceFacts, reader);
            facades.set(queries, selected);
        }
        return selected;
    };
    const includes = (node) => {
        const file = ast.getSourceFile(node);
        return file !== undefined && semantics.includes(file);
    };
    const nullishComponents = createSourceHostNullishComponents(semantics);
    return Object.freeze({
        nullishComponents,
        at: (node) => facade(semantics.forNode(node)),
        file: (node) => {
            const file = ast.getSourceFile(node);
            return file !== undefined && semantics.includes(file) ? facade(semantics.forFile(file)) : undefined;
        },
        program: () => sourceFiles[0] === undefined ? undefined : facade(semantics.forFile(sourceFiles[0])),
        includes,
        returnReachesCallable(declaration, returned) {
            const queries = semantics.forNode(declaration);
            const selected = ast.is.IsFunctionExpression(declaration) || ast.is.IsArrowFunction(declaration)
                ? queries.types.expressionType(declaration) : queries.declarations.declaredValueType(declaration);
            if (selected === undefined || queries.types.callSignatures(selected).length === 0)
                return false;
            const type = queries.types.expressionType(returned);
            if (type === undefined)
                return false;
            const pending = [type];
            const seen = new Set();
            while (pending.length > 0) {
                const current = pending.pop();
                if (current === selected)
                    return true;
                if (seen.has(current))
                    continue;
                seen.add(current);
                if (queries.types.isUnion(current) || queries.types.isIntersection(current)) {
                    pending.push(...queries.types.unionOrIntersectionTypes(current));
                    continue;
                }
                const symbol = queries.declarations.typeAliasSymbol(current) ?? queries.declarations.typeSymbol(current);
                const nominal = symbol !== undefined && queries.declarations.symbolDeclarations(symbol).some(node => ast.is.IsTypeAliasDeclaration(node) || ast.is.IsClassDeclaration(node) || ast.is.IsInterfaceDeclaration(node));
                if (nominal || queries.types.isArrayLike(current) || queries.types.isTuple(current)) {
                    pending.push(...queries.types.typeArguments(current));
                    continue;
                }
                for (const signature of [...queries.types.signatureInfos(current, "call"), ...queries.types.signatureInfos(current, "construct")]) {
                    if (signature.returnType !== undefined)
                        pending.push(signature.returnType);
                    pending.push(...signature.parameters.map(parameter => parameter.type));
                }
                if (!queries.types.isAny(current) && !queries.types.isUnknown(current) && !queries.types.isNumberLike(current) &&
                    !queries.types.isStringLike(current) && !queries.types.isBooleanLike(current) && !queries.types.isBigIntLike(current) &&
                    !queries.types.isSymbolLike(current) && !queries.types.isNullish(current) && !queries.types.isVoidLike(current)) {
                    pending.push(...queries.types.propertyInfos(current).map(property => property.type));
                }
            }
            return false;
        },
        unionMemberWitness(node, member) {
            const queries = semantics.forNode(node);
            const type = queries.types.expressionType(node);
            if (type === undefined)
                return undefined;
            const base = queries.types.literalBaseType(type);
            const selected = checkerType(member);
            if (queries.types.isIdentical(type, selected) || base !== undefined && queries.types.isIdentical(base, selected))
                return "selected";
            return queries.types.isUnion(type) ? "ambiguous" : "other";
        },
        argumentHasFormalType(occurrence, formal) {
            const queries = semantics.forNode(occurrence);
            const actual = queries.types.expressionType(occurrence);
            return actual !== undefined && queries.types.isIdentical(actual, checkerType(formal));
        },
        objectLiteralDestination(literal, property, destination) {
            const queries = semantics.forNode(literal);
            const element = queries.operations.objectLiteralElement(property);
            if (element === undefined || element.objectLiteral !== literal || element.element !== property)
                return undefined;
            const selected = (destination.component === undefined ? undefined : checkerType(destination.component.selectedType)) ??
                (destination.destinationAt === undefined ? undefined : queries.types.expressionType(destination.destinationAt)) ??
                element.contextualType;
            const present = selected === undefined ? undefined : queries.types.nonNullableType(selected);
            const member = present === undefined ? undefined : sourceObjectLiteralDestinationMember(element, present, queries);
            return member === undefined ? undefined : sourceTypeDescriptorMemberOrigin({ ast }, queries, member.property, member.receiverType);
        },
        presence(node) {
            if (presences.has(node))
                return presences.get(node);
            const queries = semantics.forNode(node);
            const type = queries.types.expressionType(node);
            const result = type === undefined ? undefined : presenceOf(queries, type);
            presences.set(node, result);
            return result;
        },
        componentPresence(component, at) {
            return presenceOf(semantics.forNode(at), checkerType(component.selectedType));
        },
        regularExpressionComponent(node) {
            if (ast.kindName(node) !== "KindRegularExpressionLiteral")
                return undefined;
            const queries = semantics.forNode(node);
            const type = queries.types.expressionType(node);
            const symbol = type === undefined ? undefined : queries.declarations.typeSymbol(type);
            const declaration = symbol === undefined ? undefined : queries.declarations.primarySymbolDeclaration(symbol);
            const declared = declaration === undefined ? undefined : queries.declarations.declaredType(declaration);
            return declaration === undefined || declared === undefined ? undefined
                : hostComponent(Object.freeze({ selectedType: declared, declaration }));
        },
        narrowed(node) {
            const refinement = semantics.selectValueTypeRefinement(node);
            return refinement.kind === "resolved" &&
                !semantics.forNode(node).types.isIdentical(refinement.declaredType, refinement.selectedType);
        },
        declaredAdmitsAbsence(occurrence, declaration) {
            const queries = semantics.forNode(occurrence);
            const refinement = semantics.selectValueTypeRefinement(occurrence);
            const declared = refinement.kind === "resolved" ? refinement.declaredType
                : declaration === undefined ? undefined : queries.declarations.declaredType(declaration);
            return declared !== undefined && presenceOf(queries, declared) === "possibly-absent";
        },
        authoredNarrowing(node, declaration, annotation) {
            if (!ast.is.IsIdentifier(node))
                return undefined;
            const refinement = semantics.selectValueTypeRefinement(node);
            if (refinement.kind !== "resolved" || refinement.reference.declaration !== declaration)
                return undefined;
            const selected = semantics.forNode(node).types.authoredSelection(annotation, refinement.selectedType);
            return selected.kind === "authored-members"
                ? Object.freeze({ nodes: selected.nodes, nullishCount: selected.selectedNullishTypes.length }) : undefined;
        },
        narrowedMembers(node) {
            if (!ast.is.IsIdentifier(node))
                return undefined;
            const refinement = semantics.selectValueTypeRefinement(node);
            if (refinement.kind !== "resolved")
                return undefined;
            const types = semantics.forNode(node).types;
            if (types.isIdentical(refinement.declaredType, refinement.selectedType))
                return undefined;
            const constituents = types.isUnion(refinement.selectedType) ? types.unionOrIntersectionTypes(refinement.selectedType)
                : [refinement.selectedType];
            return Object.freeze({
                members: Object.freeze(constituents.filter(member => !sourceHostAbsentConstituent(types, member))
                    .map(member => hostComponent(Object.freeze({ selectedType: member })))),
                absent: constituents.some(member => sourceHostAbsentConstituent(types, member)),
            });
        },
        narrowedClass(node) {
            if (!ast.is.IsIdentifier(node))
                return undefined;
            const selected = semantics.selectValueTypeRefinement(node);
            if (selected.kind !== "resolved")
                return undefined;
            const queries = semantics.forNode(node);
            if (queries.types.isIdentical(selected.declaredType, selected.selectedType) ||
                queries.types.couldContainTypeVariables(selected.selectedType))
                return undefined;
            const declaration = sourceHostTypeDeclaration(ast, queries, selected.selectedType);
            if (declaration === undefined || !(ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)))
                return undefined;
            const declared = queries.declarations.declaredType(declaration);
            return declared !== undefined && queries.types.isIdentical(declared, selected.selectedType) ? declaration : undefined;
        },
        declaredMembers(declaration, name) {
            let byName = declaredMembers.get(declaration);
            if (byName === undefined) {
                byName = new Map();
                declaredMembers.set(declaration, byName);
            }
            if (byName.has(name))
                return byName.get(name);
            const queries = semantics.forNode(declaration);
            const declared = queries.declarations.declaredType(declaration);
            const property = declared === undefined ? undefined : queries.types.propertyInfos(declared).find(selected => selected.name === name);
            const found = property === undefined ? undefined : queries.declarations.symbolDeclarations(property.symbol);
            const result = found === undefined || found.length === 0 ? undefined : Object.freeze([...found]);
            byName.set(name, result);
            return result;
        },
        // A projection of the one call witness (host-input/navigation.ts, R2 #1).
        call(use) {
            if (calls.has(use))
                return calls.get(use);
            const selected = navigation.call(use);
            const witness = selected === undefined ? undefined : Object.freeze({
                use,
                signature: selected.signature,
                receiver: selected.receiver ?? selected.callee,
                optionalChain: selected.optionalChain,
            });
            calls.set(use, witness);
            return witness;
        },
        member(use) {
            if (members.has(use))
                return members.get(use);
            // A projection of the one member-access witness (host-input/navigation.ts, R2 #2): only the declarations the
            // checker selected (read, selected, write), never the root-member list of an unselected access.
            const selected = navigation.memberAccess(use);
            const declarations = selected === undefined ? [] : [...new Set([selected.readDeclaration, selected.declaration,
                    selected.writeDeclaration].filter((declaration) => declaration !== undefined))];
            const witness = selected === undefined ? undefined : Object.freeze({
                use, receiver: selected.receiver, declarations: Object.freeze(declarations), writeDeclaration: selected.writeDeclaration,
                accessMode: selected.accessMode, optionalChain: selected.optionalChain, callCallee: selected.callCallee,
            });
            members.set(use, witness);
            return witness;
        },
    });
}
//# sourceMappingURL=index.js.map