import { Node_Expression, Node_Initializer, ObjectLiteralProperty_Value, sourceTransparentExpressionOperand } from "../../source-model/ast.js";
import { freezeSourceTypeDescriptor, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorUnion } from "./terms.js";
import { sourceTypeFlowAssignmentPattern } from "./value-syntax.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { sourceTypeDescriptorMemberOriginsEqual } from "./member-origins.js";
import { sourceTypeDescriptorArrayLikeElements } from "./element-selection.js";
import { sourceIntegerConstantIsExactlyRepresentableAsBinaryFloat, sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat } from "../literal-token.js";
import { sourceTypeFlowBroadSlotKind } from "./uses.js";
export function createSourceMethodValueUses(context, nodes, outcomes) {
    const { ast, navigation } = context.source;
    const result = new Map();
    for (const occurrence of nodes) {
        const outcome = outcomes.get(occurrence);
        if (outcome === undefined || outcome.kind === "refused" || outcome.type.kind !== "callable" ||
            outcome.type.calls.length !== 1 || outcome.type.constructs.length !== 0)
            continue;
        const declaration = outcome.type.calls[0].declaration;
        if (declaration === undefined || !(ast.is.IsMethodDeclaration(declaration) ||
            ast.is.IsMethodSignatureDeclaration(declaration)))
            continue;
        let read = occurrence;
        let alias;
        if (!(ast.is.IsPropertyAccessExpression(read) || ast.is.IsElementAccessExpression(read))) {
            const principal = ast.is.IsVariableDeclaration(occurrence) ? occurrence : ast.is.IsIdentifier(occurrence)
                ? navigation.sourceReferenceFor(occurrence)?.declaration : undefined;
            if (principal === undefined || !ast.is.IsVariableDeclaration(principal) || ast.typeNode(principal) !== undefined ||
                navigation.declarationUseSummary(principal).bindingWritten)
                continue;
            const initializer = Node_Initializer(ast, principal);
            if (initializer === undefined || !(ast.is.IsPropertyAccessExpression(initializer) ||
                ast.is.IsElementAccessExpression(initializer)))
                continue;
            const selected = outcomes.get(principal);
            const initial = outcomes.get(initializer);
            if (selected === undefined || selected.kind === "refused" || selected.provenance.occurrence !== principal ||
                initial === undefined || initial.kind === "refused" || selected.type.kind !== "callable" ||
                initial.type.kind !== "callable" || selected.type.calls.length !== 1 || initial.type.calls.length !== 1 ||
                selected.type.calls[0].declaration !== declaration || initial.type.calls[0].declaration !== declaration ||
                !sourceTypeDescriptorsEqual(outcome.type, selected.type) || !sourceTypeDescriptorsEqual(outcome.type, initial.type))
                continue;
            read = initializer;
            alias = Object.freeze({ principal, initializer, provenance: selected.provenance });
        }
        const queries = context.input.at(read);
        const access = ast.is.IsPropertyAccessExpression(read) ? queries.propertyAccess(read)
            : queries.elementAccess(read);
        const selected = access === undefined ? undefined : "selectedReadDeclaration" in access
            ? access.selectedReadDeclaration ?? access.selectedDeclaration : access.selectedDeclaration;
        if (selected !== declaration || access === undefined)
            continue;
        let input = read;
        let parent = ast.parent(input);
        while (parent !== undefined && sourceTransparentExpressionOperand(ast, parent) === input) {
            input = parent;
            parent = ast.parent(parent);
        }
        if (parent !== undefined && (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) &&
            Node_Expression(ast, parent) === input)
            continue;
        const receiver = access.receiver.expression;
        if (receiver === undefined)
            continue;
        result.set(occurrence, Object.freeze({ occurrence, read, receiver, declaration, type: outcome.type,
            provenance: outcome.provenance, alias }));
    }
    return result;
}
export function createSourceSlotAdmissions(context, uses, outcomes, declaredSlot, retainSlot, numberOrigin) {
    const admissions = new Map();
    const refusals = [];
    for (const entry of uses) {
        const use = entry.association?.occurrence;
        if (use === undefined || admissions.has(use))
            continue;
        const selected = declaredSlot(use);
        const component = selected?.component ?? entry.association?.component;
        const described = selected?.type ?? (component === undefined ? undefined : context.describe(use, component));
        if (described === undefined || sourceTypeFlowBroadSlotKind(described) === undefined)
            continue;
        const componentSlot = component?.declaration ?? component?.authoredTypeNode ?? entry.site;
        // An instantiated destination (`g<unknown>(v)` into `x: T`): the declaration's own slot fact is the uninstantiated,
        // non-broad binder slot, so the use's broad destination slot is retained at the use itself.
        const own = retainSlot(componentSlot, described);
        const slot = sourceTypeFlowBroadSlotKind(own.type) === undefined ? use : componentSlot;
        const destination = slot === componentSlot ? own.type : retainSlot(slot, described).type;
        const broad = sourceTypeFlowBroadSlotKind(destination);
        if (broad === undefined)
            continue;
        const outcome = outcomes.get(use);
        if (outcome === undefined)
            continue;
        if (outcome.kind === "refused") {
            admissions.set(use, Object.freeze({ kind: "refused", use, slot, refusal: outcome }));
            continue;
        }
        const value = outcome.construction ?? outcome.type;
        const origin = broad === "unknown" || broad === "object" ? numberOrigin(use) : undefined;
        let conversion = Object.freeze({ kind: "identity" });
        if (origin !== undefined && value.kind === "primitive" && value.primitive === "int64") {
            const numeric = origin.literal?.numeric;
            const integer = origin.literal?.integerConstant ?? origin.literal?.integer;
            const exact = numeric?.kind === "authored"
                ? sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(numeric.token, "float64")
                : integer !== undefined && sourceIntegerConstantIsExactlyRepresentableAsBinaryFloat(integer, "float64");
            if (!exact) {
                const refusal = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_NUMBER_ERASURE_INEXACT", use, origin.origin);
                refusals.push(refusal);
                outcomes.set(use, refusal);
                admissions.set(use, Object.freeze({ kind: "refused", use, slot, refusal }));
                continue;
            }
            conversion = Object.freeze({ kind: "exact-number-erasure", origin: origin.origin,
                result: freezeSourceTypeDescriptor(context.unions, { kind: "primitive", primitive: "float64" }) });
        }
        admissions.set(use, Object.freeze({ kind: "admitted", use, slot, value, destination,
            permission: sourceTypeDescriptorsEqual(value, destination) ? "identity" : "widening", conversion }));
    }
    return Object.freeze({ admissions, refusals: Object.freeze(refusals) });
}
export function sourceLiteralMemberCorrespondence(context, node, type, destination = {}) {
    const { ast } = context.source;
    if (!ast.is.IsObjectLiteralExpression(node))
        return undefined;
    const selectedType = sourceTypeDescriptorStructure(type);
    if (selectedType.kind !== "shape")
        return undefined;
    const result = [];
    for (const property of ast.properties(node)) {
        if (property === undefined || ast.is.IsSpreadAssignment(property))
            continue;
        // When the published descriptor is the literal's own shape, the authored member is its own destination.
        // Its origin is that property, so no separately selected destination type takes part (it is not the published type).
        const own = selectedType.members.filter(member => member.origin.kind === "declared" && member.origin.declaration === property);
        if (own.length === 1) {
            result.push(Object.freeze({ property, origin: own[0].origin }));
            continue;
        }
        // Which destination member the property fills is a checker member-selection witness (host-input); the published
        // member is the Host descriptor member with that origin.
        const selected = context.input.objectLiteralDestination(node, property, destination);
        if (selected === undefined)
            continue;
        if (selected.kind !== "resolved")
            throw new Error("A published Source destination requires its complete canonical member origin.");
        const origin = selected.origin;
        const matches = selectedType.members.filter(member => sourceTypeDescriptorMemberOriginsEqual(member.origin, origin));
        if (matches.length !== 1)
            throw new Error("A checked Source correspondence requires exactly one descriptor member with the same origin.");
        result.push(Object.freeze({ property, origin: matches[0].origin }));
    }
    return Object.freeze(result);
}
export function publishSourceLiteralMetadata(context, nodes, outcomes, callableReturn, retainedFill, descriptorRefusal) {
    const { ast } = context.source;
    const complete = new Set();
    function published(node) {
        const selected = outcomes.get(node);
        if (selected === undefined)
            throw new Error(`Source literal metadata requires a published ${ast.kindName(node)} child.`);
        return publish(node, selected);
    }
    function array(node) {
        const types = [];
        for (const element of ast.elements(node)) {
            if (element === undefined)
                throw new Error("A Source array construction requires its actual element nodes.");
            if (ast.is.IsOmittedExpression(element)) {
                const sourceFile = ast.getSourceFile(element);
                if (sourceFile === undefined)
                    throw new Error("A Source array omission requires its original source file.");
                const type = Object.freeze({ kind: "intrinsic", intrinsic: "absence" });
                outcomes.set(element, Object.freeze({ kind: "resolved", type,
                    provenance: Object.freeze({ group: node, occurrence: element, sourceFile }) }));
                const outcome = published(element);
                if (outcome.kind === "refused")
                    return outcome;
                types.push(outcome.type);
                continue;
            }
            const spread = ast.is.IsSpreadElement(element);
            const value = spread ? Node_Expression(ast, element) : element;
            if (value === undefined)
                throw new Error("A Source spread element requires its original operand.");
            const outcome = published(value);
            if (outcome.kind === "refused")
                return outcome;
            if (!spread) {
                types.push(outcome.type);
                continue;
            }
            // The elements a spread yields come from the operand's Host descriptor (element-selection.ts): an array's element,
            // each tuple element, a string. Only an iterator-protocol operand (Set, Map, generator, custom iterable) still
            // reads the checker iteration element (R3 open item, AGENT-FX-HV-NOTES R1 #1b).
            const hostElements = sourceTypeDescriptorArrayLikeElements(outcome.type);
            if (hostElements !== undefined) {
                types.push(...hostElements);
                continue;
            }
            const iteration = context.input.at(element).iteration(element);
            if (iteration?.subjectKind !== "spread" || iteration.subject !== element) {
                throw new Error("A Source spread construction requires the checker's iteration result for that exact spread element.");
            }
            const projected = context.describe(node, { selectedType: iteration.elementType });
            if (projected === undefined) {
                const refusal = descriptorRefusal(node);
                if (refusal !== undefined)
                    return refusal;
                throw new Error("A checked Source spread element requires its published element descriptor.");
            }
            types.push(projected);
        }
        return { kind: "array", readonly: false,
            element: sourceTypeDescriptorUnion(context.unions, types) ?? { kind: "intrinsic", intrinsic: "never" } };
    }
    function object(node) {
        const members = new Map();
        const queries = context.input.at(node);
        for (const property of ast.properties(node)) {
            if (property === undefined)
                throw new Error("A Source object construction requires its actual property nodes.");
            if (ast.is.IsSpreadAssignment(property)) {
                const operand = ast.as.AsSpreadAssignment(property)?.Expression;
                if (operand === undefined)
                    throw new Error("A Source spread property requires its original operand.");
                const outcome = published(operand);
                if (outcome.kind === "refused")
                    return outcome;
                const selected = sourceTypeDescriptorStructure(outcome.construction ?? outcome.type);
                const selectedMembers = selected.kind === "shape" ? selected.members : undefined;
                if (selectedMembers !== undefined)
                    for (const member of selectedMembers)
                        members.set(member.name, member);
                continue;
            }
            const nameNode = ast.name(property);
            const name = nameNode === undefined ? undefined : queries.propertyName(nameNode);
            if (name?.kind !== "resolved")
                continue;
            const value = ObjectLiteralProperty_Value(ast, property);
            const parameter = ast.is.IsSetAccessorDeclaration(property) ? ast.parameters(property)[0] : undefined;
            const outcome = value !== undefined ? published(value) : ast.is.IsGetAccessorDeclaration(property)
                ? callableReturn(property) : parameter !== undefined ? published(parameter) : published(property);
            if (outcome === undefined)
                throw new Error("A Source accessor construction requires its published return descriptor.");
            if (outcome.kind === "refused")
                return outcome;
            const evidence = queries.objectLiteralElement(property);
            const selected = evidence === undefined ? undefined : queries.objectLiteralProperty(evidence);
            if (!ast.is.IsSetAccessorDeclaration(property) || !members.has(name.name))
                members.set(name.name, {
                    name: name.name, type: outcome.construction ?? outcome.type, origin: { kind: "declared", declaration: property }, optional: false,
                    ...(selected === undefined ? {} : { readonly: selected.readonly }),
                });
        }
        return { kind: "shape", members: [...members.values()], indexes: [], calls: [], constructs: [] };
    }
    function publish(node, outcome) {
        if (outcome.kind === "refused" || complete.has(node))
            return outcome;
        complete.add(node);
        if (!(ast.is.IsObjectLiteralExpression(node) || ast.is.IsArrayLiteralExpression(node)) ||
            sourceTypeFlowAssignmentPattern(ast, node))
            return outcome;
        const type = outcome.type;
        // Maintainer Q4 (C-2323, 28j'): an empty object literal whose slot is `unknown` has no member inventory to
        // construct and no target type; it is refused. Non-empty literals under object/unknown still construct (C-2246).
        if (ast.is.IsObjectLiteralExpression(node) && type.kind === "intrinsic" && type.intrinsic === "unknown" &&
            ast.properties(node).length === 0) {
            const refusal = createSourceTypeFlowRefusal("TSONIC_UNTYPED_OBJECT_LITERAL", node);
            outcomes.set(node, refusal);
            return refusal;
        }
        const broad = type.kind === "intrinsic" && (type.intrinsic === "object" || type.intrinsic === "unknown");
        const constructed = broad || ast.is.IsObjectLiteralExpression(node) && type.kind === "shape";
        const produced = !constructed ? undefined : ast.is.IsObjectLiteralExpression(node) ? object(node) : array(node);
        if (produced?.kind === "refused") {
            outcomes.set(node, produced);
            return produced;
        }
        const construction = produced === undefined || sourceTypeDescriptorsEqual(produced, type) ? undefined : produced;
        const memberCorrespondence = sourceLiteralMemberCorrespondence(context, node, type, (() => {
            const component = retainedFill(node);
            return component === undefined ? {} : { component };
        })());
        const owner = ast.parent(node);
        const principal = ast.is.IsObjectLiteralExpression(node) && owner !== undefined && ast.is.IsVariableDeclaration(owner) &&
            Node_Initializer(ast, owner) === node && ast.typeNode(owner) === undefined
            ? Object.freeze({ declaration: owner, initializer: node }) : undefined;
        const selected = Object.freeze({ ...outcome,
            ...(construction === undefined ? {} : { construction: freezeSourceTypeDescriptor(context.unions, construction) }),
            ...(memberCorrespondence === undefined ? {} : { memberCorrespondence }),
            ...(principal === undefined ? {} : { provenance: Object.freeze({ ...outcome.provenance, principal }) }),
        });
        outcomes.set(node, selected);
        return selected;
    }
    for (const node of nodes) {
        const selected = outcomes.get(node);
        if (selected !== undefined)
            publish(node, selected);
    }
}
//# sourceMappingURL=literal-publication.js.map