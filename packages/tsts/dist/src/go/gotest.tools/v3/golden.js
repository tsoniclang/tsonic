import * as nodeFs from "node:fs";
export function Assert(t, actual, path) {
    const expected = nodeFs.readFileSync(path);
    const actualBuffer = typeof actual === "string" ? Buffer.from(actual) : Buffer.from(actual);
    if (!expected.equals(actualBuffer)) {
        t.Fatal(`golden mismatch for ${path}`);
    }
}
//# sourceMappingURL=golden.js.map