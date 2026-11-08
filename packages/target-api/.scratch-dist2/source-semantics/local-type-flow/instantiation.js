import { freezeSourceTypeDescriptor, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorUnion, substituteSourceTypeDescriptor, } from "./terms.js";
/** The published argument vector of a binder list under bindings (frozen, in binder order). */
export function sourceTypeFlowBinderArguments(unions, binders, bindings) {
    return Object.freeze(binders.map(declaration => Object.freeze({ declaration, type: freezeSourceTypeDescriptor(unions, bindings.get(declaration)) })));
}
/** A type instantiated under bindings (the one substitution), frozen; undefined when the descriptor is not this program's. */
export function sourceTypeFlowInstantiate(unions, bindings, type) {
    const selected = substituteSourceTypeDescriptor(unions, type, bindings);
    return selected === undefined ? undefined : freezeSourceTypeDescriptor(unions, selected);
}
/**
 * The receiver binder values of a member selected on `owner` (its type parameters `binders`) for a receiver whose Host
 * descriptor is `receiver` (REVIEW-R1 #5: one rule, by declaration identity, never by name). Through absence and
 * declared definitions:
 * - a declared reference to the owner, or to a declaration merged with it, binds the binders to its type arguments;
 * - an array binds the owner's one binder to its element (an array member's owner has the element as its binder);
 * - a tuple, read as its array view, binds the one binder to the union of its element types (Host order).
 * undefined: the receiver states no type arguments for the owner.
 */
export function sourceTypeFlowReceiverBinderValues(inputs, receiver, owner, binders) {
    let selected = receiver;
    const seen = new Set();
    while (selected !== undefined && !seen.has(selected)) {
        seen.add(selected);
        if (selected.kind === "optional") {
            selected = selected.value;
            continue;
        }
        if (selected.kind === "array")
            return binders.length === 1 ? [selected.element] : undefined;
        if (selected.kind === "tuple") {
            if (binders.length !== 1)
                return undefined;
            const elements = selected.elements.map(element => {
                if (element.kind !== "rest")
                    return element.type;
                const rest = sourceTypeDescriptorStructure(element.type);
                return rest.kind === "array" ? rest.element : element.type;
            });
            const element = sourceTypeDescriptorUnion(inputs.unions, elements);
            return element === undefined ? undefined : [element];
        }
        if (selected.kind !== "declared")
            return undefined;
        if (selected.declaration === owner || inputs.navigation.mergedDeclarations(selected.declaration).includes(owner)) {
            return selected.typeArguments.length === binders.length ? selected.typeArguments : undefined;
        }
        selected = selected.definition;
    }
    return undefined;
}
/**
 * Matches a generic function value's signature (`formal`) against its destination (`actual`), binding the method
 * `binders` it meets into `bound`. Returns false on a conflict (one binder bound to two different descriptors). Union
 * arms are not paired: Host arm order is authored-first per descriptor, not positional across descriptors.
 */
export function sourceTypeFlowUnifyBinders(binders, formal, actual, bound) {
    let conflict = false;
    const unify = (formal, actual, depth) => {
        if (depth > 8 || conflict)
            return;
        if (formal.kind === "declared" && binders.has(formal.declaration) && formal.typeArguments.length === 0) {
            const previous = bound.get(formal.declaration);
            if (previous === undefined)
                bound.set(formal.declaration, actual);
            else if (!sourceTypeDescriptorsEqual(previous, actual))
                conflict = true;
            return;
        }
        if (formal.kind === "optional") {
            unify(formal.value, actual.kind === "optional" ? actual.value : actual, depth + 1);
            return;
        }
        if (formal.kind === "array" && actual.kind === "array") {
            unify(formal.element, actual.element, depth + 1);
            return;
        }
        if (formal.kind === "tuple" && actual.kind === "tuple" && formal.elements.length === actual.elements.length) {
            formal.elements.forEach((element, index) => unify(element.type, actual.elements[index].type, depth + 1));
            return;
        }
        if (formal.kind === "declared" && actual.kind === "declared" && formal.declaration === actual.declaration &&
            formal.typeArguments.length === actual.typeArguments.length) {
            formal.typeArguments.forEach((argument, index) => unify(argument, actual.typeArguments[index], depth + 1));
            return;
        }
        if ((formal.kind === "callable" || formal.kind === "shape") && (actual.kind === "callable" || actual.kind === "shape") &&
            formal.calls.length === 1 && actual.calls.length === 1) {
            const left = formal.calls[0];
            const right = actual.calls[0];
            left.parameters.forEach((parameter, index) => {
                const other = right.parameters[index];
                if (other !== undefined)
                    unify(parameter.type, other.type, depth + 1);
            });
            unify(left.result, right.result, depth + 1);
        }
        if (formal.kind === "shape" && actual.kind === "shape")
            for (const member of formal.members) {
                const other = actual.members.find(candidate => candidate.name === member.name);
                if (other !== undefined)
                    unify(member.type, other.type, depth + 1);
            }
    };
    unify(formal, actual, 0);
    return !conflict;
}
//# sourceMappingURL=instantiation.js.map