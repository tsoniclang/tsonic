import { DeepEqual } from "../../../reflect.js";
export function AllowUnexported(...types) {
    return { kind: "AllowUnexported", args: types };
}
export function Diff(x, y, ..._opts) {
    if (DeepEqual(x, y)) {
        return "";
    }
    return `- ${stableStringify(x)}\n+ ${stableStringify(y)}`;
}
export function FilterPath(filter, opt) {
    return { kind: "FilterPath", args: [filter, opt] };
}
export function Ignore() {
    return { kind: "Ignore", args: [] };
}
function stableStringify(value) {
    const seen = new WeakSet();
    return JSON.stringify(value, (_key, current) => {
        if (typeof current === "bigint") {
            return current.toString();
        }
        if (current !== null && typeof current === "object") {
            if (seen.has(current)) {
                return "[Circular]";
            }
            seen.add(current);
            if (!Array.isArray(current)) {
                const ordered = {};
                for (const key of Object.keys(current).sort()) {
                    ordered[key] = current[key];
                }
                return ordered;
            }
        }
        return current;
    }, 2) ?? String(value);
}
//# sourceMappingURL=cmp.js.map