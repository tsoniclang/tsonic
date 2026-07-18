export function substituteTargetParameter(parameter, substitutions) {
    const type = substituteTargetTypeRef(parameter.type, substitutions);
    return type === parameter.type
        ? parameter
        : Object.freeze({ ...parameter, type });
}
export function substituteTargetTypeRef(root, substitutions) {
    if (substitutions.size === 0) {
        return root;
    }
    const results = new WeakMap();
    const visiting = new WeakSet();
    const stack = [{ stage: "enter", type: root }];
    while (stack.length !== 0) {
        const frame = stack.pop();
        const type = frame.type;
        if (frame.stage === "enter") {
            if (results.has(type)) {
                continue;
            }
            if (type.kind === "type-parameter") {
                results.set(type, substitutions.get(type.name) ?? type);
                continue;
            }
            if (visiting.has(type)) {
                throw new Error("Selected target signature contains a cyclic TargetTypeRef.");
            }
            visiting.add(type);
            stack.push({ stage: "exit", type });
            for (const child of targetTypeRefChildren(type)) {
                if (!results.has(child)) {
                    stack.push({ stage: "enter", type: child });
                }
            }
            continue;
        }
        visiting.delete(type);
        results.set(type, rebuildTargetTypeRef(type, results));
    }
    return results.get(root);
}
function targetTypeRefChildren(type) {
    switch (type.kind) {
        case "source-global":
        case "target-named":
            return type.typeArguments ?? [];
        case "array":
            return [type.element];
        case "tuple":
            return type.elements;
        case "pointer":
            return [type.pointee];
        case "function-pointer":
            return [...type.args, type.result];
        case "associated-type":
            return [type.owner];
        default:
            return [];
    }
}
function rebuildTargetTypeRef(type, results) {
    switch (type.kind) {
        case "source-global":
            return rebuildTypeArguments(type, results);
        case "target-named":
            return rebuildTypeArguments(type, results);
        case "array": {
            const element = results.get(type.element);
            return element === type.element ? type : Object.freeze({ ...type, element });
        }
        case "tuple": {
            const elements = rebuildTargetTypeRefArray(type.elements, results);
            return elements === type.elements ? type : Object.freeze({ ...type, elements });
        }
        case "pointer": {
            const pointee = results.get(type.pointee);
            return pointee === type.pointee ? type : Object.freeze({ ...type, pointee });
        }
        case "function-pointer": {
            const args = rebuildTargetTypeRefArray(type.args, results);
            const result = results.get(type.result);
            return args === type.args && result === type.result ? type : Object.freeze({ ...type, args, result });
        }
        case "associated-type": {
            const owner = results.get(type.owner);
            return owner === type.owner ? type : Object.freeze({ ...type, owner });
        }
        default:
            return type;
    }
}
function rebuildTypeArguments(type, results) {
    if (type.typeArguments === undefined) {
        return type;
    }
    const typeArguments = rebuildTargetTypeRefArray(type.typeArguments, results);
    return typeArguments === type.typeArguments ? type : Object.freeze({ ...type, typeArguments });
}
function rebuildTargetTypeRefArray(types, results) {
    let changed = false;
    const rebuilt = types.map((type) => {
        const result = results.get(type);
        changed ||= result !== type;
        return result;
    });
    return changed ? Object.freeze(rebuilt) : types;
}
//# sourceMappingURL=target-type-ref-substitution.js.map