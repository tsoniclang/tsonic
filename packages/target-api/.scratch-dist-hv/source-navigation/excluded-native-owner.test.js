// Host fact test (R2 #42): successor of the two baseline excluded-native-owner tests of declaration-symbol.test.ts.
// A declaration in a checked file that the program view excludes from `sourceFiles` still answers its value and instance
// type through the consumer's Host facts, and querying it never widens the published membership.
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
function fixture(nativeText) {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": 'import { Native } from "./native.js";\n' +
                "export function read(value: Native): number { return value.field; }\n" +
                "export function make(): Native { return new Native(); }\n",
            "/src/native.ts": nativeText,
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, "the native declaration and its consumer check");
    const consumer = checked.getSourceFile("/src/index.ts");
    const native = checked.getSourceFile("/src/native.ts");
    const declaration = checked.ast.statements(native).find(node => node !== undefined && checked.ast.is.IsClassDeclaration(node));
    const host = createHostSourceProgramFixture({ ...checked, sourceFiles: Object.freeze([consumer]) });
    const nodes = [];
    const visit = (node) => {
        nodes.push(node);
        host.ast.forEachChild(node, child => { if (child !== undefined)
            visit(child); });
    };
    visit(consumer);
    return { host, consumer, native, declaration, nodes };
}
test("an excluded native owner answers its value and instance type through the consumer's Host facts", () => {
    const { host, declaration, nodes } = fixture("export class Native { field: number = 7; }");
    const { ast, facts } = host;
    const access = nodes.find(node => ast.is.IsPropertyAccessExpression(node));
    const receiver = ast.as.AsPropertyAccessExpression(access).Expression;
    const construction = nodes.find(node => ast.is.IsNewExpression(node));
    for (const [label, node] of [["the parameter read", receiver], ["the construction", construction]]) {
        const outcome = facts.values.type(node);
        assert.equal(outcome.kind !== "refused" && outcome.type.kind === "declared" && outcome.type.declaration === declaration, true, `${label} names the excluded native class as its instance type`);
    }
    const field = facts.values.type(access);
    assert.equal(field.kind !== "refused" && field.type.kind === "primitive" && field.type.primitive === "float64", true, "the member read through the native instance type is the declared number");
});
test("an excluded native owner is not a project declaration and is not published as a source file or document", () => {
    const { host, native, declaration } = fixture("export declare class Native { field: number; }");
    assert.equal(host.navigation.isProjectDeclaration(declaration), false, "a queried native declaration is not a project implementation");
    assert.equal(host.facts.navigation.identity.isProjectDeclaration(declaration), false, "the role model agrees");
    assert.equal(host.sourceFiles.includes(native), false, "the native owner file is not published");
    assert.throws(() => host.documents.forFile(native), /exact source file/u, "no authored source document is created");
});
//# sourceMappingURL=excluded-native-owner.test.js.map