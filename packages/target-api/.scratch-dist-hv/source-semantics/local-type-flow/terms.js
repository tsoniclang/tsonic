import { createSourceTypeFlowRefusal } from "./refusals.js";
import { freezeSourceTypeDescriptorMemberOrigin } from "./member-origins.js";
import { sourceTypeDescriptorMemberLiteralsKey, sourceTypeDescriptorStructure, } from "../descriptor-model.js";
// The pure descriptor algebra is defined in ../descriptor-model.ts (checker-free, I1) and re-exported for the value model.
export { sourceTypeDescriptorLiteralKey, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue, } from "../descriptor-model.js";
export function createSourceTypeDescriptorUnions(ast, files) {
    const owner = { ast, files };
    owner.registry = { owner: owner, applications: new WeakMap(), owned: new WeakSet(), snapshots: new WeakMap(),
        files: new Map(files.map((file, index) => [file, index])),
        preferences: new Map(), nodes: new WeakMap(), descriptors: new WeakMap(), structures: new Map(),
        families: new Map(), nextIdentity: 0, sealed: false, published: false };
    return Object.freeze(owner);
}
/**
 * A value with an absence arm (the one rule for every producer that adds absence to one value): an optional value stays
 * as it is, and `unknown` / `any` already hold null and undefined (Q65), so they absorb it. Every other value becomes
 * optional.
 */
export function sourceTypeDescriptorOptional(value) {
    if (value.kind === "optional")
        return value;
    return sourceTypeDescriptorIsTop(value) ? value : { kind: "optional", value };
}
/** The one "top" predicate (Q103): `unknown` or `any`, through declared aliases. Openness and absence absorption read it. */
export function sourceTypeDescriptorIsTop(type) {
    const structure = sourceTypeDescriptorStructure(type);
    return structure.kind === "intrinsic" && (structure.intrinsic === "unknown" || structure.intrinsic === "any");
}
export function sealSourceTypeDescriptorUnions(owner) {
    owner.registry.sealed = true;
}
export function sourceTypeDescriptorUnion(owner, types, origin, bindings = new Map()) {
    const { ast } = owner;
    const { registry } = owner;
    if (origin === undefined && types.length === 1 && types[0]?.kind === "intrinsic" && types[0].intrinsic === "void")
        return types[0];
    if (origin !== undefined) {
        const file = ast.getSourceFile(origin.node);
        if (file === undefined || !registry.files.has(file))
            return undefined;
    }
    if ((origin === undefined || origin.kind === "inferred") && types.length === 1) {
        if (registry.applications.has(types[0]))
            return types[0];
    }
    const authored = origin?.kind === "authored" ? origin.node : undefined;
    const identityOf = descriptorIdentity(ast, registry);
    const members = [];
    const keys = [];
    const seen = new Set();
    let absent = false;
    const pending = [...types];
    while (pending.length > 0) {
        const selected = pending.shift();
        if (selected.kind === "union")
            pending.unshift(...selected.types);
        else if (selected.kind === "optional") {
            absent = true;
            pending.unshift(selected.value);
        }
        else if (selected.kind === "intrinsic" && (selected.intrinsic === "absence" || selected.intrinsic === "void"))
            absent = true;
        else {
            const key = identityOf(selected);
            if (key === undefined)
                return undefined;
            if (!seen.has(key)) {
                seen.add(key);
                keys.push(key);
                members.push(selected);
            }
        }
    }
    if (members.length > 1) {
        const identity = JSON.stringify([...keys].sort((left, right) => left - right));
        const previous = registry.preferences.get(identity);
        const earlier = (left, right) => {
            const leftFile = ast.getSourceFile(left);
            const rightFile = ast.getSourceFile(right);
            const leftOrder = leftFile === undefined ? undefined : registry.files.get(leftFile);
            const rightOrder = rightFile === undefined ? undefined : registry.files.get(rightFile);
            if (leftOrder === undefined || rightOrder === undefined)
                throw new Error("An authored Source sum requires its original program file order.");
            return leftOrder < rightOrder || leftOrder === rightOrder &&
                (ast.pos(left) < ast.pos(right) || ast.pos(left) === ast.pos(right) && ast.end(left) < ast.end(right));
        };
        if (!registry.sealed && (previous === undefined || authored !== undefined &&
            (previous.authored === undefined || earlier(authored, previous.authored)))) {
            registry.preferences.set(identity, { keys, ...(authored === undefined ? {} : { authored }) });
        }
        const selected = registry.preferences.get(identity);
        if (selected === undefined)
            return undefined;
        const positions = new Map(selected.keys.map((key, index) => [key, index]));
        const ordered = members.map((type, index) => ({ type, position: positions.get(keys[index]) }));
        ordered.sort((left, right) => left.position - right.position);
        members.splice(0, members.length, ...ordered.map(member => member.type));
    }
    const value = members.length === 0 ? undefined
        : members.length === 1 ? members[0] : { kind: "union", types: members };
    const descriptor = absent
        ? value === undefined ? { kind: "intrinsic", intrinsic: "absence" } : { kind: "optional", value } : value;
    if (descriptor === undefined || origin === undefined)
        return descriptor;
    let family = registry.families.get(origin.node);
    if (family === undefined) {
        if (registry.sealed)
            return descriptor.kind === "union" ? undefined : descriptor;
        const roles = sourceUnionArms(descriptor);
        const parameters = sourceTypeDescriptorParameters(ast, roles);
        parameters.sort((left, right) => {
            const leftFile = ast.getSourceFile(left);
            const rightFile = ast.getSourceFile(right);
            return registry.files.get(leftFile) - registry.files.get(rightFile) || ast.pos(left) - ast.pos(right);
        });
        family = { node: origin.node, origin: origin.kind, parameters: Object.freeze(parameters), roles: Object.freeze(roles),
            applications: new Map(), records: new Map() };
        registry.families.set(origin.node, family);
    }
    const arguments_ = family.parameters.map(parameter => bindings.get(parameter) ??
        { kind: "declared", declaration: parameter, typeArguments: [] });
    const key = sourceUnionApplicationKey(ast, registry, arguments_);
    if (key === undefined)
        return undefined;
    if (registry.sealed && !family.applications.has(key))
        return members.length > 1 ? undefined : descriptor;
    const project = createSourceTypeDescriptorNormalizer(owner, bindings);
    const roles = family.roles.map(project);
    if (!roles.every((role) => role !== undefined))
        return undefined;
    const retained = origin.kind === "inferred" && types.length === 1 &&
        (types[0]?.kind === "union" || types[0]?.kind === "optional") ? types[0] : undefined;
    const owned = retained ?? (descriptor.kind === "union" || descriptor.kind === "optional" ? { ...descriptor } : descriptor);
    const application = { registry, family, arguments: arguments_, roles, descriptor: owned };
    if (owned !== descriptor)
        registry.applications.set(owned, application);
    if (!registry.sealed)
        family.applications.set(key, application);
    return owned;
}
function sourceUnionApplicationKey(ast, registry, application) {
    const identity = descriptorIdentity(ast, registry);
    const keys = application.map(identity);
    return keys.every((key) => key !== undefined) ? JSON.stringify(keys) : undefined;
}
function sourceUnionArms(type) {
    return type.kind === "union" ? type.types : type.kind === "optional"
        ? [...sourceUnionArms(type.value), { kind: "intrinsic", intrinsic: "absence" }]
        : type.kind === "intrinsic" && type.intrinsic === "void" ? [{ kind: "intrinsic", intrinsic: "absence" }] : [type];
}
export function createSourceClosedSumQuery(owner, normalize) {
    const { ast } = owner;
    const { registry } = owner;
    if (!registry.sealed)
        throw new Error("Source sum publication requires its sealed original program.");
    const identify = descriptorIdentity(ast, registry);
    if (!registry.published)
        for (const family of registry.families.values())
            for (const [key, application] of family.applications) {
                const descriptor = normalize(application.descriptor);
                const types = sourceUnionArms(descriptor);
                const indexes = new Map(types.map((type, index) => [identify(type), index]));
                const roles = application.roles.map((type, role) => Object.freeze({ role,
                    arms: Object.freeze([...new Set(sourceUnionArms(normalize(type)).map(member => {
                            const index = indexes.get(identify(member));
                            if (index === undefined)
                                throw new Error("An original Source role requires its exact closed sum arm.");
                            return index;
                        }))]) }));
                const record = Object.freeze({
                    identity: Object.freeze({ family: family.node, application: Object.freeze(application.arguments.map(normalize)) }),
                    arms: Object.freeze(types.map((type, index) => {
                        const role = roles.find(role => role.arms.includes(index))?.role;
                        if (role === undefined)
                            throw new Error("A closed Source arm requires its original family role.");
                        return Object.freeze({ role, type: freezeSourceTypeDescriptor(owner, type) });
                    })), roles: Object.freeze(roles),
                });
                family.records.set(key, record);
            }
    registry.published = true;
    const records = new Map([...registry.families].map(([node, family]) => [node, new Map(family.records)]));
    return identity => {
        const key = sourceUnionApplicationKey(ast, registry, identity.application);
        return key === undefined ? undefined : records.get(identity.family)?.get(key);
    };
}
export function sourceTypeDescriptorSum(owner, descriptor) {
    const { registry } = owner;
    const application = registry.applications.get(descriptor);
    if (application === undefined || !registry.sealed)
        return undefined;
    const key = sourceUnionApplicationKey(owner.ast, registry, application.arguments);
    return key === undefined ? undefined : application.family.records.get(key);
}
function descriptorIdentity(ast, registry) {
    const node = (declaration) => {
        const file = ast.getSourceFile(declaration);
        if (file === undefined || !registry.files.has(file))
            return undefined;
        let identity = registry.nodes.get(declaration);
        if (identity === undefined) {
            identity = registry.nextIdentity++;
            registry.nodes.set(declaration, identity);
        }
        return identity;
    };
    const vector = (values) => {
        const selected = values.filter((value) => value !== undefined);
        return selected.length === values.length ? selected : undefined;
    };
    const ordered = (values) => {
        return values.every((value) => value !== undefined) ? [...values].sort((left, right) => left - right) : undefined;
    };
    const intern = (value) => {
        if (value === undefined)
            return undefined;
        const key = JSON.stringify(value);
        let identity = registry.structures.get(key);
        if (identity === undefined) {
            identity = registry.nextIdentity++;
            registry.structures.set(key, identity);
        }
        return identity;
    };
    const signature = (value) => intern(vector([
        "signature", vector(value.typeParameters.map(node)),
        vector(value.parameters.map(parameter => vector([parameter.kind, tree(parameter.type)]))), tree(value.result),
    ]));
    const tree = (type) => {
        if (registry.descriptors.has(type))
            return registry.descriptors.get(type);
        let value;
        switch (type.kind) {
            case "primitive":
                value = vector(["primitive", type.primitive]);
                break;
            case "string":
                value = vector(["string"]);
                break;
            case "intrinsic":
                value = vector(["intrinsic", type.intrinsic]);
                break;
            case "declared":
                value = vector(["declared", node(type.declaration), vector(type.typeArguments.map(tree)),
                    ...(type.extent === undefined ? [] : [vector(["extent", type.extent.length.toString(), type.extent.lengthRuntimeBase])])]);
                break;
            case "array":
                value = vector(["array", type.readonly, tree(type.element)]);
                break;
            case "tuple":
                value = vector(["tuple", type.readonly, vector(type.elements.map(element => vector([element.kind, tree(element.type)])))]);
                break;
            case "shape":
                value = vector(["shape", ordered(type.members.map(member => intern(vector(["member", member.name, member.optional, !!member.readonly, sourceTypeDescriptorMemberLiteralsKey(member), tree(member.type)])))),
                    ordered(type.indexes.map(index => intern(vector(["index", index.readonly, tree(index.key), tree(index.value)])))),
                    vector(type.calls.map(signature)), vector(type.constructs.map(signature))]);
                break;
            case "callable":
                value = vector(["callable", vector(type.calls.map(signature)), vector(type.constructs.map(signature))]);
                break;
            case "optional":
                value = vector(["optional", tree(type.value)]);
                break;
            case "union":
                value = vector(["union", ordered(type.types.map(tree))]);
                break;
        }
        const identity = intern(value);
        registry.descriptors.set(type, identity);
        return identity;
    };
    return tree;
}
// The sole substitution (I6). A descriptor this program did not produce is not substituted (undefined).
export function substituteSourceTypeDescriptor(owner, type, bindings) {
    if (type.kind === "primitive" || type.kind === "string" || type.kind === "intrinsic")
        return type;
    return owner.registry.applications.has(type) || owner.registry.owned.has(type)
        ? substituteDescriptor(owner, type, bindings, new WeakMap()) : undefined;
}
export function createSourceTypeDescriptorNormalizer(owner, bindings) {
    const memo = new WeakMap();
    return type => substituteDescriptor(owner, type, bindings, memo);
}
function substituteDescriptor(owner, type, bindings, memo) {
    if (memo.has(type))
        return memo.get(type);
    const substitute = (selected) => substituteDescriptor(owner, selected, bindings, memo);
    const vector = (values) => {
        const selected = values.map(substitute);
        return selected.every((value) => value !== undefined) ? selected : undefined;
    };
    const signatures = (values) => {
        const selected = [];
        for (const signature of values) {
            const parameters = [];
            for (const parameter of signature.parameters) {
                const type = substitute(parameter.type);
                if (type === undefined)
                    return undefined;
                parameters.push({ ...parameter, type });
            }
            const result = substitute(signature.result);
            if (result === undefined)
                return undefined;
            selected.push(result === signature.result && parameters.every((parameter, index) => parameter.type === signature.parameters[index].type)
                ? signature : { ...signature, parameters, result });
        }
        return selected;
    };
    const result = replace();
    if (result !== undefined) {
        owner.registry.owned.add(type);
        owner.registry.owned.add(result);
    }
    memo.set(type, result);
    return result;
    function replace() {
        const application = owner.registry.applications.get(type);
        if (application !== undefined) {
            const arguments_ = vector(application.arguments);
            const members = vector(type.kind === "union" ? type.types : type.kind === "optional"
                ? [type.value, { kind: "intrinsic", intrinsic: "absence" }] : [type]);
            if (arguments_ === undefined || members === undefined)
                return undefined;
            const result = sourceTypeDescriptorUnion(owner, members, { kind: application.family.origin, node: application.family.node }, new Map(application.family.parameters.map((parameter, index) => [parameter, arguments_[index]])));
            if (result === undefined)
                return undefined;
            const same = type.kind === "union" && result.kind === "union" && type.types.length === result.types.length
                ? type.types.every((member, index) => member === result.types[index]) : type.kind === "optional" && result.kind === "optional" &&
                (type.value === result.value || type.value.kind === "union" && result.value.kind === "union" &&
                    type.value.types.length === result.value.types.length &&
                    type.value.types.every((member, index) => result.value.kind === "union" && member === result.value.types[index]));
            if (same && arguments_.every((argument, index) => argument === application.arguments[index])) {
                return type;
            }
            return result;
        }
        switch (type.kind) {
            case "primitive":
            case "intrinsic":
            case "string": return type;
            case "declared": {
                const argument = bindings.get(type.declaration);
                if (argument !== undefined && type.typeArguments.length === 0) {
                    const owned = owner.registry.applications.has(argument) || owner.registry.owned.has(argument);
                    return owner.registry.sealed && argument.kind !== "primitive" && argument.kind !== "string" &&
                        argument.kind !== "intrinsic" && !owned ? undefined : argument;
                }
                const typeArguments = vector(type.typeArguments);
                const definition = type.definition === undefined ? undefined : substitute(type.definition);
                if (typeArguments === undefined || type.definition !== undefined && definition === undefined)
                    return undefined;
                return definition === type.definition && typeArguments.every((argument, index) => argument === type.typeArguments[index])
                    ? type : { ...type, typeArguments, ...(definition === undefined ? {} : { definition }) };
            }
            case "optional": {
                const value = substitute(type.value);
                return value === undefined ? undefined : value === type.value ? type : { ...type, value };
            }
            case "array": {
                const element = substitute(type.element);
                return element === undefined ? undefined : element === type.element ? type : { ...type, element };
            }
            case "tuple": {
                const values = vector(type.elements.map(element => element.type));
                if (values === undefined)
                    return undefined;
                const elements = type.elements.map((element, index) => ({ ...element, type: values[index] }));
                return elements.every((element, index) => element.type === type.elements[index].type) ? type : { ...type, elements };
            }
            case "union": {
                const types = vector(type.types);
                if (types === undefined)
                    return undefined;
                const result = sourceTypeDescriptorUnion(owner, types);
                if (result === undefined)
                    return undefined;
                return result.kind === "union" && result.types.length === type.types.length &&
                    result.types.every((selected, index) => selected === type.types[index]) ? type : result;
            }
            case "callable":
            case "shape": {
                const calls = signatures(type.calls);
                const constructs = signatures(type.constructs);
                if (calls === undefined || constructs === undefined)
                    return undefined;
                const unchanged = calls.every((signature, index) => signature === type.calls[index]) &&
                    constructs.every((signature, index) => signature === type.constructs[index]);
                if (type.kind === "callable")
                    return unchanged ? type : { ...type, calls, constructs };
                const values = vector(type.members.map(member => member.type));
                const keys = vector(type.indexes.map(index => index.key));
                const indexed = vector(type.indexes.map(index => index.value));
                if (values === undefined || keys === undefined || indexed === undefined)
                    return undefined;
                const members = type.members.map((member, index) => ({ ...member, type: values[index] }));
                const indexes = type.indexes.map((entry, index) => ({ ...entry, key: keys[index], value: indexed[index] }));
                return unchanged && members.every((member, index) => member.type === type.members[index].type) &&
                    indexes.every((selected, index) => selected.key === type.indexes[index].key && selected.value === type.indexes[index].value)
                    ? type : { ...type, calls, constructs, members, indexes };
            }
        }
    }
}
// Identity-stable deep freeze, owned by the program (I5): the snapshot keeps the original's ownership and sum application.
export function freezeSourceTypeDescriptor(owner, type) {
    const { registry } = owner;
    const existing = registry.snapshots.get(type);
    if (existing !== undefined)
        return existing;
    const frozen = snapshotSourceTypeDescriptor(owner, type);
    if (registry.owned.has(type))
        registry.owned.add(frozen);
    const application = registry.applications.get(type);
    if (application !== undefined) {
        registry.applications.set(frozen, { ...application,
            arguments: application.arguments.map(argument => freezeSourceTypeDescriptor(owner, argument)),
            roles: application.roles.map(role => freezeSourceTypeDescriptor(owner, role)), descriptor: frozen });
    }
    registry.snapshots.set(type, frozen);
    registry.snapshots.set(frozen, frozen);
    return frozen;
}
function snapshotSourceTypeDescriptor(owner, type) {
    const freeze = (selected) => freezeSourceTypeDescriptor(owner, selected);
    const indexes = (values) => Object.freeze(values.map(index => Object.freeze({ ...index, key: freeze(index.key), value: freeze(index.value) })));
    const signatures = (values) => Object.freeze(values.map(signature => Object.freeze({ ...signature, typeParameters: Object.freeze([...signature.typeParameters]),
        parameters: Object.freeze(signature.parameters.map(parameter => Object.freeze({ ...parameter,
            type: freeze(parameter.type) }))), result: freeze(signature.result) })));
    switch (type.kind) {
        case "primitive":
        case "string":
        case "intrinsic": return Object.freeze({ ...type });
        case "union": return Object.freeze({ ...type, types: Object.freeze(type.types.map(freeze)) });
        case "callable": return Object.freeze({ ...type, calls: signatures(type.calls), constructs: signatures(type.constructs) });
        case "array": return Object.freeze({ ...type, element: freeze(type.element) });
        case "optional": return Object.freeze({ ...type, value: freeze(type.value) });
        case "tuple": return Object.freeze({ ...type, elements: Object.freeze(type.elements.map(element => Object.freeze({ ...element, type: freeze(element.type) }))) });
        case "declared": return Object.freeze({ kind: "declared", declaration: type.declaration,
            typeArguments: Object.freeze(type.typeArguments.map(freeze)),
            ...(type.definition === undefined ? {} : { definition: freeze(type.definition) }),
            ...(type.cut === undefined ? {} : { cut: type.cut }),
            ...(type.extent === undefined ? {} : { extent: Object.freeze({ ...type.extent }) }) });
        case "shape": return Object.freeze({ ...type, indexes: indexes(type.indexes), calls: signatures(type.calls), constructs: signatures(type.constructs),
            members: Object.freeze(type.members.map(member => Object.freeze({ ...member, origin: freezeSourceTypeDescriptorMemberOrigin(member.origin),
                type: freeze(member.type),
                ...(member.literals === undefined ? {} : { literals: Object.freeze(member.literals.map(literal => Object.freeze({ ...literal }))) }) }))) });
    }
}
export function sourceTypeDescriptorDepth(type) {
    const children = type.kind === "array" ? [type.element] : type.kind === "optional" ? [type.value]
        : type.kind === "union" ? type.types : type.kind === "callable" ? [...type.calls, ...type.constructs]
            .flatMap(signature => [...signature.parameters.map(parameter => parameter.type), signature.result])
            : type.kind === "tuple" ? type.elements.map(element => element.type) : type.kind === "declared" ? type.typeArguments
                : type.kind === "shape" ? [...type.members.map(member => member.type), ...type.indexes.flatMap(index => [index.key, index.value]),
                    ...[...type.calls, ...type.constructs].flatMap(signature => [...signature.parameters.map(parameter => parameter.type), signature.result])] : [];
    let depth = -1;
    for (const child of children)
        depth = Math.max(depth, sourceTypeDescriptorDepth(child));
    return depth + 1;
}
export function sourceTypeDescriptorHasTypeVariables(ast, type, bound = new Set()) {
    return sourceTypeDescriptorParameters(ast, [type], bound).length !== 0;
}
function sourceTypeDescriptorParameters(ast, types, bound = new Set()) {
    const parameters = new Set();
    const scopes = new Map();
    const visit = (type, scope) => {
        let seen = scopes.get(scope);
        if (seen === undefined) {
            seen = new WeakSet();
            scopes.set(scope, seen);
        }
        if (seen.has(type))
            return;
        seen.add(type);
        if (type.kind === "declared") {
            if (ast.is.IsTypeParameterDeclaration(type.declaration) && !scope.has(type.declaration))
                parameters.add(type.declaration);
            for (const argument of type.typeArguments)
                visit(argument, scope);
            if (type.definition !== undefined)
                visit(type.definition, scope);
        }
        else if (type.kind === "array")
            visit(type.element, scope);
        else if (type.kind === "tuple")
            for (const element of type.elements)
                visit(element.type, scope);
        else if (type.kind === "optional")
            visit(type.value, scope);
        else if (type.kind === "union")
            for (const member of type.types)
                visit(member, scope);
        if (type.kind === "shape") {
            for (const member of type.members)
                visit(member.type, scope);
            for (const index of type.indexes) {
                visit(index.key, scope);
                visit(index.value, scope);
            }
        }
        if (type.kind === "shape" || type.kind === "callable")
            for (const signature of [...type.calls, ...type.constructs]) {
                const nested = new Set([...scope, ...signature.typeParameters]);
                for (const parameter of signature.parameters)
                    visit(parameter.type, nested);
                visit(signature.result, nested);
            }
    };
    for (const type of types)
        visit(type, bound);
    return [...parameters];
}
export function isSourceTypeFlowDeclaredConstruction(node) {
    return node.kind === "fixed" && (node.term?.kind === "array" || node.term?.kind === "shape") &&
        node.term.site === node.node;
}
export function createSourceTypeFlowTerms(ast, graph) {
    const indexes = new WeakMap();
    const slots = [];
    function intern(variable) {
        const existing = indexes.get(variable.node);
        let index;
        if (existing === undefined) {
            index = { parts: new Map(), binders: new WeakMap() };
            indexes.set(variable.node, index);
        }
        else {
            index = existing;
        }
        for (const part of variable.path) {
            if (part.kind === "tuple" && (!Number.isSafeInteger(part.index) || part.index < 0)) {
                throw new Error("A Source tuple path requires a nonnegative safe integer position.");
            }
            const selected = part.kind === "binder" ? index.binders.get(part.declaration)
                : index.parts.get(pathKey(part));
            if (selected !== undefined) {
                index = selected;
                continue;
            }
            const child = { parts: new Map(), binders: new WeakMap() };
            if (part.kind === "binder")
                index.binders.set(part.declaration, child);
            else
                index.parts.set(pathKey(part), child);
            index = child;
        }
        if (index.slot === undefined) {
            const selected = { variable, rank: 0, parent: undefined, nodes: [], terms: [], structures: [], numeric: false, refusals: [] };
            index.slot = selected;
            slots.push(selected);
        }
        return index.slot;
    }
    function root(slot) {
        let selected = slot;
        while (selected.parent !== undefined)
            selected = selected.parent;
        while (slot.parent !== undefined) {
            const parent = slot.parent;
            slot.parent = selected;
            slot = parent;
        }
        return selected;
    }
    function children(slot) {
        return [...slot.structures.flatMap(term => term.kind === "array" ? [intern(term.element)]
                : term.kind === "optional" ? [intern(term.value)]
                    : term.kind === "tuple" ? term.elements.map(element => intern(element.variable))
                        : term.kind === "shape" ? term.members.map(member => intern(member.variable))
                            : term.kind === "declared" ? term.typeArguments.map(intern) : []),
            ...slot.terms.flatMap(term => term.kind === "template" ? term.bindings.map(binding => intern(binding.variable)) : [])];
    }
    function contains(from, target) {
        const pending = [...children(from)];
        const seen = new Set();
        while (pending.length > 0) {
            const selected = root(pending.pop());
            if (selected === target)
                return true;
            if (seen.has(selected))
                continue;
            seen.add(selected);
            for (const child of children(selected))
                pending.push(child);
        }
        return false;
    }
    function refuse(slot, refusal) {
        const selected = root(slot);
        if (selected.refusals.length === 0)
            selected.refusals.push(refusal);
    }
    function union(left, right, site) {
        const pending = [[left, right]];
        while (pending.length > 0) {
            const pair = pending.pop();
            let first = root(pair[0]);
            let second = root(pair[1]);
            if (first === second)
                continue;
            if (contains(first, second) || contains(second, first)) {
                const issue = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_SELF_REFERENCE", site);
                refuse(first, issue);
                refuse(second, issue);
                continue;
            }
            const firstStructures = first.structures;
            const secondStructures = second.structures;
            let clash = firstStructures.length > 0 && second.numeric || secondStructures.length > 0 && first.numeric;
            for (const one of firstStructures) {
                for (const other of secondStructures) {
                    if (one.kind !== other.kind) {
                        clash = true;
                        continue;
                    }
                    if (one.kind === "array" && other.kind === "array")
                        pending.push([intern(one.element), intern(other.element)]);
                    if (one.kind === "optional" && other.kind === "optional")
                        pending.push([intern(one.value), intern(other.value)]);
                    if (one.kind === "tuple" && other.kind === "tuple") {
                        if (one.elements.length !== other.elements.length) {
                            clash = true;
                            continue;
                        }
                        one.elements.forEach((element, index) => {
                            const selected = other.elements[index];
                            if (element.kind !== selected.kind)
                                clash = true;
                            else
                                pending.push([intern(element.variable), intern(selected.variable)]);
                        });
                    }
                    if (one.kind === "shape" && other.kind === "shape") {
                        if (one.members.length !== other.members.length) {
                            clash = true;
                            continue;
                        }
                        for (const member of one.members) {
                            const selected = other.members.find(candidate => candidate.name === member.name);
                            if (selected === undefined)
                                clash = true;
                            else
                                pending.push([intern(member.variable), intern(selected.variable)]);
                        }
                    }
                    if (one.kind === "declared" && other.kind === "declared") {
                        if (one.declaration !== other.declaration || one.typeArguments.length !== other.typeArguments.length) {
                            clash = true;
                            continue;
                        }
                        one.typeArguments.forEach((argument, index) => pending.push([intern(argument), intern(other.typeArguments[index])]));
                    }
                }
            }
            if (clash) {
                const issue = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_CONFLICT", site);
                refuse(first, issue);
                refuse(second, issue);
                continue;
            }
            if (first.rank < second.rank)
                [first, second] = [second, first];
            second.parent = first;
            if (first.rank === second.rank)
                first.rank += 1;
            for (const node of second.nodes)
                first.nodes.push(node);
            for (const term of second.terms)
                first.terms.push(term);
            for (const term of second.structures)
                first.structures.push(term);
            first.numeric || (first.numeric = second.numeric);
            for (const refusal of second.refusals)
                first.refusals.push(refusal);
        }
    }
    for (const node of graph.nodes) {
        const selected = intern(node.variable);
        selected.nodes.push(node);
        if (node.term !== undefined) {
            selected.terms.push(node.term);
            if (structural(node.term))
                selected.structures.push(node.term);
            if (node.term.kind === "numeric")
                selected.numeric = true;
            children(selected);
        }
    }
    for (const derived of graph.derived) {
        intern(derived.result);
        derived.operands.forEach(intern);
        if (derived.accumulator !== undefined)
            intern(derived.accumulator);
    }
    for (const call of graph.calls) {
        [...call.receiver, ...call.method].forEach(binder => intern(binder.variable));
        call.argumentPlaces.forEach(place => intern(place.value));
        if (call.result !== undefined)
            intern(call.result);
    }
    const constructions = new Set(graph.nodes.filter(isSourceTypeFlowDeclaredConstruction).map(node => intern(node.variable)));
    const conversionPositions = new Set([...constructions].flatMap(children));
    for (const link of graph.links) {
        if (!conversionPositions.has(intern(link.target)))
            union(intern(link.source), intern(link.target), link.site);
    }
    for (const input of graph.inferenceInputs) {
        intern(input.source);
        intern(input.target);
    }
    const declaredRoots = new Set([...constructions].map(root));
    const unboundConstructions = new Set(graph.nodes.filter(node => {
        if (node.kind === "fixed" || node.variable.path.length !== 0 || ast.is.IsSourceFile(node.root) ||
            !(ast.is.IsArrayLiteralExpression(node.node) || ast.is.IsObjectLiteralExpression(node.node)))
            return false;
        let occurrence = node.node;
        let owner = ast.parent(occurrence);
        while (owner !== undefined && (ast.is.IsParenthesizedExpression(owner) || ast.is.IsNonNullExpression(owner) ||
            ast.is.IsAsExpression(owner) || ast.is.IsSatisfiesExpression(owner))) {
            occurrence = owner;
            owner = ast.parent(owner);
        }
        return owner === undefined || !(ast.is.IsVariableDeclaration(owner) || ast.is.IsPropertyDeclaration(owner) ||
            ast.is.IsParameterDeclaration(owner)) || ast.as.AsVariableDeclaration(owner)?.Initializer !== occurrence &&
            ast.as.AsPropertyDeclaration(owner)?.Initializer !== occurrence && ast.as.AsParameterDeclaration(owner)?.Initializer !== occurrence;
    }).map(node => root(intern(node.variable))));
    const inference = new Set();
    const successors = new Map();
    const connect = (from, to) => {
        const source = root(from), target = root(to);
        let selected = successors.get(source);
        if (selected === undefined)
            successors.set(source, selected = new Set());
        selected.add(target);
    };
    for (const slot of slots) {
        const selected = root(slot);
        if (unboundConstructions.has(selected) || selected.nodes.some(node => node.kind === "open-local" || node.kind === "derived-local")) {
            inference.add(selected);
        }
        for (const child of declaredRoots.has(selected) ? [] : children(selected)) {
            connect(selected, child);
            connect(child, selected);
        }
    }
    for (const derived of graph.derived) {
        for (const operand of derived.operands)
            connect(intern(operand), intern(derived.result));
    }
    for (const input of graph.inferenceInputs)
        connect(intern(input.source), intern(input.target));
    const pendingInference = [...inference];
    for (let index = 0; index < pendingInference.length; index += 1) {
        for (const next of successors.get(pendingInference[index]) ?? []) {
            if (inference.has(next))
                continue;
            inference.add(next);
            pendingInference.push(next);
        }
    }
    function depth(slot, active = new Set()) {
        const selected = root(slot);
        if (active.has(selected))
            return 5;
        const nested = children(selected);
        if (nested.length === 0)
            return 0;
        const next = new Set(active).add(selected);
        let maximum = 0;
        for (const child of nested)
            maximum = Math.max(maximum, depth(child, next));
        return 1 + maximum;
    }
    for (const slot of slots) {
        const selected = root(slot);
        if (inference.has(selected) && depth(selected) > 4)
            refuse(selected, createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_LIMIT", selected.variable.node));
    }
    const view = (slot) => {
        const selected = root(slot);
        return { variable: selected.variable, nodes: selected.nodes, terms: selected.terms, refusals: selected.refusals };
    };
    return Object.freeze({
        group: (variable) => view(intern(variable)),
        groups: () => [...new Set(slots.map(root))].map(view),
        isInference: (variable) => inference.has(root(intern(variable))),
        refuse: (variable, refusal) => refuse(intern(variable), refusal),
    });
}
function structural(term) {
    return term.kind === "array" || term.kind === "shape" || term.kind === "declared" || term.kind === "tuple" || term.kind === "optional";
}
function pathKey(part) {
    return part.kind === "element" ? "element" : part.kind === "optional-value" ? "optional-value"
        : part.kind === "tuple" ? `tuple:${part.index}` : `member:${part.name}`;
}
//# sourceMappingURL=terms.js.map