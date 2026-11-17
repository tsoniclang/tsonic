import { CachedTypeKindArrayLiteralType, CheckModeNormal, getTypeListKey } from "../internal/checker/checker/state.js";
import { cachedReferenceInputs } from "../internal/checker/checker.js";
import { Checker_checkExpressionCached } from "../internal/checker/checker/syntax-checking.js";
import { LiteralConstructionOwner, LiteralCreation } from "../internal/checker/checker/literal-creation.js";
import { reacquireFreshLiteral } from "./type-normalization-fresh-literals.js";
import { Node_Properties, SourceFile_FileName } from "../internal/ast/ast.js";
import { IsArrayLiteralExpression, IsObjectLiteralExpression, IsSpreadAssignment } from "../internal/ast/generated/predicates.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { LinkStore_TryGet } from "../internal/core/linkstore.js";
import { ObjectFlagsArrayLiteral, ObjectFlagsObjectLiteral, TypeFlagsObject, TypeFlagsUnion, Type_AsObjectType, Type_AsStructuredType, Type_AsTypeReference, Type_Target, Type_Types } from "../internal/checker/types.js";
function construction(type) {
    const creation = LiteralCreation.read(type);
    return creation === undefined || creation.owner !== undefined
        && (type.checker === undefined || LiteralConstructionOwner.read(creation.owner, type.checker) === undefined)
        ? undefined : creation.creator;
}
function siteOf(event) {
    return event.kind === "object-literal" ? event
        : event.kind === "literal-fragment" ? event : event.site;
}
function boundaryOf(event) {
    return event.kind === "object-literal" ? null : event.kind === "literal-fragment" ? event.boundary : event.site.boundary;
}
function inputs(event) {
    return event.kind === "literal-merge" ? [event.left, event.right]
        : event.kind === "literal-partial" ? [event.source, event.other] : [];
}
function coordinate(event, normalize) {
    const site = siteOf(event);
    if (event.kind === "object-literal" || event.kind === "literal-fragment")
        return JSON.stringify([event.kind, site.mode]);
    const values = inputs(event).map(type => normalize(type).id);
    return JSON.stringify(event.kind === "literal-merge"
        ? [event.kind, site.mode, event.site.phase, values, event.flags, event.readonly]
        : [event.kind, site.mode, event.site.phase, event.role, values, event.readonly]);
}
function select(index, event, key) {
    const site = siteOf(event);
    return index.get(site.node)?.get(boundaryOf(event))?.get(key);
}
function insert(index, event, type) {
    const site = siteOf(event);
    let boundaries = index.get(site.node);
    if (boundaries === undefined) {
        boundaries = new Map();
        index.set(site.node, boundaries);
    }
    const boundary = boundaryOf(event);
    let values = boundaries.get(boundary);
    if (values === undefined) {
        values = new Map();
        boundaries.set(boundary, values);
    }
    const key = coordinate(event, value => value);
    const existing = values.get(key);
    if (existing !== undefined && existing !== type)
        return false;
    values.set(key, type);
    return true;
}
function arrayInputs(owner, type) {
    const target = Type_Target(type);
    const values = Type_AsTypeReference(type)?.resolvedTypeArguments;
    if (target?.checker !== owner || values === undefined)
        return undefined;
    for (const value of values)
        if (value?.checker !== owner)
            return undefined;
    const reference = Type_AsObjectType(target)?.instantiations?.get(getTypeListKey(values));
    if (reference === undefined || owner.cachedTypes.get({ kind: CachedTypeKindArrayLiteralType, typeId: reference.id }) !== type
        || cachedReferenceInputs(owner, reference) !== values)
        return undefined;
    return values;
}
function collect(owner, root) {
    const states = new Map();
    const events = [];
    const index = new Map();
    const owners = new Map();
    const pending = [{ type: root, exit: false }];
    while (pending.length !== 0) {
        const frame = pending.pop();
        if (frame === undefined)
            throw new Error("An owned spread traversal retains its pending frame");
        const type = frame.type;
        if (type.checker !== owner)
            return undefined;
        if (frame.exit) {
            const event = construction(type);
            states.set(type, "complete");
            if (event !== undefined)
                events.push({ type, event });
            continue;
        }
        const state = states.get(type);
        if (state === "active")
            return undefined;
        if (state === "complete")
            continue;
        const event = construction(type);
        if (event === undefined) {
            const kind = type.derivation?.kind;
            if (kind === "object-literal" || kind === "literal-fragment" || kind === "literal-merge" || kind === "literal-partial")
                return undefined;
        }
        states.set(type, "active");
        pending.push({ type, exit: true });
        if (event !== undefined) {
            const site = siteOf(event);
            if (!IsObjectLiteralExpression(site.node)
                || (type.flags & TypeFlagsObject) === 0
                || event.kind !== "object-literal" && (type.objectFlags & ObjectFlagsObjectLiteral) === 0)
                return undefined;
            let boundaries = owners.get(site.node);
            if (boundaries === undefined) {
                const file = GetSourceFileOfNode(site.node);
                if (file === undefined || owner.program.GetSourceFile(SourceFile_FileName(file)) !== file)
                    return undefined;
                const selected = new Set();
                for (const property of Node_Properties(site.node) ?? []) {
                    if (property === undefined)
                        return undefined;
                    if (IsSpreadAssignment(property))
                        selected.add(property);
                }
                boundaries = selected;
                owners.set(site.node, boundaries);
            }
            const boundary = boundaryOf(event);
            if (boundary !== null && !boundaries.has(boundary))
                return undefined;
            if ((event.kind === "literal-merge" || event.kind === "literal-partial")
                && (event.site.phase !== "properties" && event.site.phase !== "spread"
                    || event.site.phase === "spread" && boundary === null))
                return undefined;
            if (event.kind === "literal-partial" && (event.role !== "operand" && event.role !== "left" && event.role !== "right"
                || event.role === "operand" && event.site.phase !== "spread"))
                return undefined;
            if (!insert(index, event, type))
                return undefined;
            for (const input of inputs(event))
                pending.push({ type: input, exit: false });
            if (event.kind === "object-literal" || event.kind === "literal-fragment") {
                const members = Type_AsStructuredType(type)?.members;
                if (members === undefined)
                    return undefined;
                for (const member of members.values()) {
                    if (member === undefined)
                        return undefined;
                    const value = LinkStore_TryGet(owner.valueSymbolLinks, member)?.resolvedType;
                    if (value !== undefined)
                        pending.push({ type: value, exit: false });
                }
            }
        }
        if ((type.flags & TypeFlagsObject) !== 0 && (type.objectFlags & ObjectFlagsArrayLiteral) !== 0) {
            const values = arrayInputs(owner, type);
            if (values === undefined)
                return undefined;
            for (const value of values) {
                if (value === undefined)
                    return undefined;
                pending.push({ type: value, exit: false });
            }
        }
        if ((type.flags & TypeFlagsUnion) !== 0)
            for (const member of Type_Types(type) ?? []) {
                if (member === undefined)
                    return undefined;
                pending.push({ type: member, exit: false });
            }
    }
    return { values: new Set(states.keys()), events, index };
}
function cachedGraph(owner, root, graphs) {
    if (graphs.has(root))
        return graphs.get(root);
    const graph = collect(owner, root);
    graphs.set(root, graph);
    return graph;
}
function question(source, type, site, graphs) {
    let selected;
    const creation = LiteralCreation.read(type);
    const publication = creation?.owner === undefined ? undefined : LiteralConstructionOwner.read(creation.owner, source);
    if (creation?.owner !== undefined && publication === undefined)
        return "invalid";
    const nodes = new Set();
    if (publication !== undefined)
        nodes.add(publication.node);
    for (let node = site; node !== undefined; node = node.Parent)
        if (IsObjectLiteralExpression(node) || IsArrayLiteralExpression(node))
            nodes.add(node);
    for (const node of nodes) {
        const root = LinkStore_TryGet(source.typeNodeLinks, node)?.resolvedType;
        if (root === undefined)
            continue;
        const graph = cachedGraph(source, root, graphs);
        if (graph === undefined)
            return "invalid";
        if (!graph.values.has(type))
            continue;
        if (selected !== undefined)
            return "invalid";
        selected = { node, root, graph };
    }
    return selected ?? "absent";
}
export function reacquireLiteralGraph(producer, type, normalize, remember, admitted, graphs) {
    const event = construction(type);
    if (event === undefined)
        return undefined;
    const source = type.checker;
    if (source === undefined)
        throw new TypeError("A native spread retains its actual producing checker in the same Program");
    const site = siteOf(event);
    if (!IsObjectLiteralExpression(site.node))
        return undefined;
    if (site.mode !== CheckModeNormal && LiteralCreation.read(type)?.owner === undefined)
        return reacquireFreshLiteral(producer, type, normalize, admitted);
    const original = question(source, type, site.node, graphs);
    if (original === "invalid")
        return undefined;
    if (original === "absent")
        return reacquireFreshLiteral(producer, type, normalize, admitted);
    if (source.program.SourceFiles() !== producer.program.SourceFiles())
        throw new TypeError("A native spread retains its actual producing checker in the same Program");
    const sourceGraph = original.graph;
    const target = Checker_checkExpressionCached(producer, original.node);
    if (target === undefined || target.checker !== producer)
        throw new Error("The actual cached literal retains its target producer");
    const targetGraph = cachedGraph(producer, target, graphs);
    if (targetGraph === undefined)
        throw new Error("The actual target literal retains its unique native construction graph");
    const matched = new Map();
    const inputOf = (value) => {
        const known = matched.get(value);
        if (known !== undefined)
            return known;
        const selected = normalize(value);
        if (selected.checker !== producer)
            throw new TypeError("A spread input retains its actual normalized producer");
        return selected;
    };
    for (const produced of sourceGraph.events) {
        const selected = select(targetGraph.index, produced.event, coordinate(produced.event, inputOf));
        if (selected === undefined)
            throw new Error("The target cached literal retains this exact native construction event");
        matched.set(produced.type, selected);
        remember(produced.type, selected);
    }
    const result = matched.get(type);
    if (result === undefined)
        throw new Error("The admitted spread input retains its actual target correspondence");
    remember(original.root, target);
    return result;
}
//# sourceMappingURL=type-normalization-spreads.js.map