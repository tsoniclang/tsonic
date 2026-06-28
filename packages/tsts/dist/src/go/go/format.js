import { Sprint } from "../fmt.js";
export function Node(dst, _fset, node) {
    const text = typeof node === "string" ? node : Sprint(node);
    const [, err] = dst.Write(Array.from(new TextEncoder().encode(text)));
    return err;
}
export function Source(src) {
    if (typeof src === "string") {
        return [Array.from(new TextEncoder().encode(src)), undefined];
    }
    return [Array.from(src), undefined];
}
//# sourceMappingURL=format.js.map