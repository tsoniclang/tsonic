import { byteArraysEqual, toNodeBytes } from "../../nodebytes.js";
import * as nodeFs from "node:fs";
export function Assert(t, actual, path) {
    const expected = toNodeBytes(nodeFs.readFileSync(path));
    const actualBytes = toNodeBytes(actual);
    if (!byteArraysEqual(expected, actualBytes)) {
        t.Fatal(`golden mismatch for ${path}`);
    }
}
//# sourceMappingURL=golden.js.map