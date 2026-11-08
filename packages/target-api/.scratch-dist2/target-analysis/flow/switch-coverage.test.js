// Switch coverage (ruling Q79): units from the Host sum and relation of the switch subject; an optional discriminant
// is not covered (its absence arm has no case unit), as at baseline.
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createHostSourceProgramFixture } from "../../source-semantics/host-program-fixtures.js";
import { createSourceSwitchCoverage } from "./switch-coverage.js";
function coverage(text) {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": text },
        compilerOptions: { strict: true, target: "esnext", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, "switch fixture is a checked program");
    const source = createHostSourceProgramFixture(checked);
    const covered = createSourceSwitchCoverage(source);
    const result = new Map();
    const visit = (node, owner) => {
        const name = source.ast.is.IsFunctionDeclaration(node) ? source.ast.text(source.ast.name(node)) : owner;
        if (source.ast.is.IsSwitchStatement(node) && name !== undefined)
            result.set(name, covered(node));
        source.ast.forEachChild(node, child => { if (child !== undefined)
            visit(child, name); });
    };
    visit(checked.getSourceFile("/src/index.ts"), undefined);
    return result;
}
test("a discriminant member over a union is covered from the per-arm member literals", () => {
    const result = coverage(`
    interface Circle { kind: "circle"; radius: number }
    interface Square { kind: "square"; side: number }
    type Shape = Circle | Square;
    export function area(shape: Shape): number { switch (shape.kind) { case "circle": return 1; case "square": return 2; } }
    export function partial(shape: Shape): number { switch (shape.kind) { case "circle": return 1; } return 0; }`);
    assert.equal(result.get("area"), true);
    assert.equal(result.get("partial"), false);
});
test("literal-union, boolean and enum discriminants are covered; optional ones are not", () => {
    const result = coverage(`
    enum E { A, B }
    export function literal(k: "a" | "b"): number { switch (k) { case "a": return 1; case "b": return 2; } }
    export function flag(b: boolean): number { switch (b) { case true: return 1; case false: return 2; } }
    export function enumerated(e: E): number { switch (e) { case E.A: return 1; case E.B: return 2; } }
    export function optional(k?: "a" | "b"): number { switch (k) { case "a": return 1; case "b": return 2; } return 0; }
    export function optionalEnum(e?: E): number { switch (e) { case E.A: return 1; case E.B: return 2; } return 0; }
    interface Tagged { kind?: "x" | "y" }
    export function optionalMember(o: Tagged): number { switch (o.kind) { case "x": return 1; case "y": return 2; } return 0; }`);
    assert.equal(result.get("literal"), true);
    assert.equal(result.get("flag"), true);
    assert.equal(result.get("enumerated"), true);
    assert.equal(result.get("optional"), false);
    assert.equal(result.get("optionalEnum"), false);
    assert.equal(result.get("optionalMember"), false);
});
//# sourceMappingURL=switch-coverage.test.js.map