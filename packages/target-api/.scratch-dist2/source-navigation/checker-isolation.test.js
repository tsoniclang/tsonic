// I3: only host-input/ reads checker Type, Signature or Symbol. source-navigation reads authored syntax and the
// Node-keyed host-input navigation records (host-input/navigation.ts) only.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const navigationRoot = here.endsWith(`${path.sep}dist${path.sep}source-navigation`)
    ? path.join(here, "..", "..", "src", "source-navigation") : here;
function productionFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory())
            return productionFiles(file);
        return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".d.ts") ? [file] : [];
    });
}
/** Checker types and query handles: none may be imported from @tsonic/tsts by navigation. */
const checkerImports = /^(Type|Signature|Symbol|TypeCheckerQueries|TypeShapeQueries|SourceFileQueries|SourceProgramQueries|CheckedSourceProgram|Resolved\w+|Symbol\w*|Type\w*Info|IndexInfo)$/u;
/** Checker queries reached through any handle. */
const checkerQueries = [
    /\bgetSourceFileQueries\b/u, /\.checker\b/u, /\.typeShape\b/u, /\bsemantics\s*\.\s*for(Node|File)\b/u, /\bsemanticsFor\b/u,
    /\bgetSymbolAtLocation\b/u, /\bgetTypeAtLocation\b/u, /\bgetTypeOfSymbol\b/u, /\bgetResolved\w+Info\b/u,
    /\bdeclarationSymbol\b/u, /\bresolveModuleSourceFile\b/u, /\.types\.(expressionType|is\w+|callSignatures|constructSignatures)\b/u,
];
test("I3: source-navigation production files import no checker Type, Signature, Symbol or query handle", () => {
    const files = productionFiles(navigationRoot);
    assert.equal(files.length > 40, true, "the scan sees the navigation sources");
    const violations = [];
    for (const file of files) {
        const text = fs.readFileSync(file, "utf8");
        for (const match of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@tsonic\/tsts"/gu)) {
            for (const entry of match[1].split(",")) {
                const name = entry.trim().replace(/^type\s+/u, "").split(/\s+as\s+/u)[0].trim();
                if (name.length > 0 && checkerImports.test(name))
                    violations.push(`${path.relative(navigationRoot, file)}: imports ${name}`);
            }
        }
        if (/import\s+\*\s+as\s+\w+\s+from\s+"@tsonic\/tsts"/u.test(text)) {
            violations.push(`${path.relative(navigationRoot, file)}: namespace import of @tsonic/tsts`);
        }
    }
    assert.deepEqual(violations, []);
});
test("I3: source-navigation production files make no checker query and reach host-input only through navigation.ts", () => {
    const violations = [];
    for (const file of productionFiles(navigationRoot)) {
        const text = fs.readFileSync(file, "utf8").replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//gu, "");
        for (const pattern of checkerQueries) {
            if (pattern.test(text))
                violations.push(`${path.relative(navigationRoot, file)}: ${pattern.source}`);
        }
        for (const match of text.matchAll(/from\s+"((?:\.\.\/)+host-input\/[^"]+)"/gu)) {
            if (!match[1].endsWith("/host-input/navigation.js")) {
                violations.push(`${path.relative(navigationRoot, file)}: imports ${match[1]}`);
            }
        }
    }
    assert.deepEqual(violations, []);
});
//# sourceMappingURL=checker-isolation.test.js.map