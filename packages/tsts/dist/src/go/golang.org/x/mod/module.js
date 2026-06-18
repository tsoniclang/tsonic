export function CheckFilePath(path) {
    if (path === "") {
        return new globalThis.Error("malformed file path: empty string");
    }
    if (path.startsWith("/") || path.includes("\\") || path.includes("//")) {
        return new globalThis.Error(`malformed file path ${path}`);
    }
    for (const part of path.split("/")) {
        if (part === "" || part === "." || part === "..") {
            return new globalThis.Error(`malformed file path ${path}`);
        }
    }
    return undefined;
}
//# sourceMappingURL=module.js.map