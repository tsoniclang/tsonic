import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { snapshotTargetPlanningSourceNavigation } from "../target-analysis/source-navigation-snapshot.js";
test("class expressions retain exact inherited dispatch and unrelated controls", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    abstract class Base { abstract read(): number; stable(): number { return 1; } static same(): number { return 2; } }
    const Derived = class extends Base {
      stableValue: number; changing: number;
      constructor() { super(); this.stableValue = 1; this.changing = 2; }
      read(): number { return 3; } stable(): number { return 4; }
      update(): void { this.changing = 5; } static same(): number { return 5; }
    };
    const Unrelated = class { read(): number { return 6; } private hidden(): number { return 7; } };
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
    const source = createHostSourceProgramFixture(checked);
    const file = checked.getSourceFile("/src/index.ts");
    assert.ok(file);
    const classes = [];
    const visit = (node) => {
        if (source.ast.is.IsClassDeclaration(node) || source.ast.is.IsClassExpression(node))
            classes.push(node);
        source.ast.forEachChild(node, child => { if (child !== undefined)
            visit(child); });
    };
    visit(file);
    assert.equal(classes.length, 3);
    const [base, derived, unrelated] = classes;
    const member = (owner, name) => {
        assert.ok(owner);
        const selected = source.ast.members(owner).find(candidate => candidate !== undefined && source.ast.text(source.ast.name(candidate)) === name);
        assert.ok(selected);
        return selected;
    };
    const snapshot = snapshotTargetPlanningSourceNavigation(source);
    for (const navigation of [source.navigation, snapshot]) {
        for (const name of ["read", "stable"]) {
            assert.deepEqual(navigation.memberDispatch(member(base, name)), { overridesBase: false, hasDerivedOverride: true });
            assert.deepEqual(navigation.memberDispatch(member(derived, name)), { overridesBase: true, hasDerivedOverride: false });
        }
        assert.deepEqual(navigation.memberDispatch(member(unrelated, "read")), { overridesBase: false, hasDerivedOverride: false });
        assert.equal(navigation.memberDispatch(member(derived, "same")), undefined);
        assert.equal(navigation.memberDispatch(member(unrelated, "hidden")), undefined);
        const contracts = navigation.memberContracts(member(derived, "read"));
        assert.equal(contracts.kind, "resolved");
        if (contracts.kind === "resolved")
            assert.deepEqual(contracts.contracts, [member(base, "read")]);
        const stable = navigation.declarationUseSummary(member(derived, "stableValue"));
        assert.equal(stable.constructorInitialized, true);
        assert.equal(stable.bindingWritten, false);
        assert.equal(stable.mutatedAfterInitialization, false);
        assert.equal(navigation.declarationUseSummary(member(derived, "changing")).mutatedAfterInitialization, true);
    }
});
//# sourceMappingURL=member-dispatch.test.js.map