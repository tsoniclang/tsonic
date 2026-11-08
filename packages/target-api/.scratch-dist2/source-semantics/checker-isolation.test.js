// I3: only host-input/ reads checker Type, Signature or Symbol. The source-semantics root services (enum constants,
// enum uses, value-flow guards, interface representation, literal and integer rules, documents) read authored syntax,
// navigation and the published Host facts only. The composition root (target-source-program.ts) and the test fixture
// (host-program-fixtures.ts) receive the checked program and build the host-input instances; they make no checker query.
// local-type-flow/** has its own owner and scan.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const semanticsRoot = here.endsWith(`${path.sep}dist${path.sep}source-semantics`)
    ? path.join(here, "..", "..", "src", "source-semantics") : here;
const compositionRoots = new Set(["target-source-program.ts", "host-program-fixtures.ts"]);
function productionFiles() {
    return fs.readdirSync(semanticsRoot, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".d.ts"))
        .map(entry => entry.name);
}
/** Checker types and query handles: none may be imported from @tsonic/tsts by a root service. */
const checkerImports = /^(Type|Signature|Symbol|TypeCheckerQueries|TypeShapeQueries|SourceFileQueries|SourceProgramQueries|CheckedSourceProgram|Resolved\w+|Symbol\w*|Type\w*Info|IndexInfo|ContextFlags\w*)$/u;
/** Checker queries reached through any handle. */
const checkerQueries = [
    /\bgetSourceFileQueries\b/u, /\.checker\b/u, /\.typeShape\b/u, /\bsemantics\s*\.\s*for(Node|File)\b/u, /\bsemanticsFor\b/u,
    /\bgetSymbolAtLocation\b/u, /\bgetTypeAtLocation\b/u, /\bgetTypeOfSymbol\b/u, /\bgetResolved\w+Info\b/u, /\bgetConstantValue\b/u,
    /\bgetContextualType\b/u, /\bdeclarationSymbol\b/u, /\.types\.(expressionType|is\w+|callSignatures|constructSignatures)\b/u,
];
test("I3: source-semantics root services import no checker Type, Signature, Symbol or query handle", () => {
    const files = productionFiles();
    assert.equal(files.length > 25, true, "the scan sees the root services");
    const violations = [];
    for (const file of files) {
        const text = fs.readFileSync(path.join(semanticsRoot, file), "utf8");
        for (const match of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@tsonic\/tsts"/gu)) {
            for (const entry of match[1].split(",")) {
                const name = entry.trim().replace(/^type\s+/u, "").split(/\s+as\s+/u)[0].trim();
                if (name.length === 0 || !checkerImports.test(name))
                    continue;
                if (compositionRoots.has(file) && name === "CheckedSourceProgram")
                    continue;
                violations.push(`${file}: imports ${name}`);
            }
        }
        if (/import\s+\*\s+as\s+\w+\s+from\s+"@tsonic\/tsts"/u.test(text))
            violations.push(`${file}: namespace import of @tsonic/tsts`);
    }
    assert.deepEqual(violations, []);
});
test("I3: source-semantics root services make no checker query and import no host-input module", () => {
    const violations = [];
    for (const file of productionFiles()) {
        const text = fs.readFileSync(path.join(semanticsRoot, file), "utf8").replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//gu, "");
        for (const pattern of checkerQueries) {
            if (pattern.test(text))
                violations.push(`${file}: ${pattern.source}`);
        }
        if (compositionRoots.has(file))
            continue;
        for (const match of text.matchAll(/from\s+"((?:\.\.\/)+host-input\/[^"]+)"/gu)) {
            violations.push(`${file}: imports ${match[1]}`);
        }
    }
    assert.deepEqual(violations, []);
});
test("I3: HostSourceProgram carries no checker service", () => {
    const text = fs.readFileSync(path.join(semanticsRoot, "types.ts"), "utf8");
    const body = /export interface HostSourceProgram \{([\s\S]*?)\n\}/u.exec(text)?.[1];
    assert.ok(body, "types.ts declares HostSourceProgram");
    assert.equal(/\bsemantics\b\s*:/u.test(body), false, "no `semantics` member");
    assert.equal(/SourceProgramSemantics|SourceFileSemantics|host-input/u.test(text), false, "types.ts names no checker view");
});
//# sourceMappingURL=checker-isolation.test.js.map