import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { analyzeSourceConstructorResults, createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import * as construction from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { sourceStorageClassLineages } from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { fixture, constructorResultFixture } from './source-storage-construction-fixtures.mjs';
import { namedDeclaration, namedVariable } from "../fixtures/source-navigation.mjs";

test("native class construction retains only the checked provider-owned constructor identity", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src", compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: {
      "/src/native.d.ts": "export declare class Native { constructor(value: object); } export declare class Foreign { constructor(value: object); } export declare function choose(): typeof Native;",
      "/src/index.ts": `import { Native, Foreign, choose } from "./native.js";
        class Local { constructor(value: object) {} }
        const value = {};
        const native = new Native(value);
        const foreign = new Foreign(value);
        const local = new Local(value);
        const factory = new (choose())(value);`,
    },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const declarations = checked.getSourceFile("/src/native.d.ts");
  assert.equal(file !== undefined && declarations !== undefined, true, "both actual checked files exist");
  const native = namedDeclaration(source.ast, declarations, "Native");
  const foreign = namedDeclaration(source.ast, declarations, "Foreign");
  const local = namedDeclaration(source.ast, file, "Local");
  const constructor = source.ast.members(native).find(member => member !== undefined && source.ast.is.IsConstructorDeclaration(member));
  assert.equal(constructor !== undefined && !source.navigation.isProjectDeclaration(native), true,
    "the actual native class and its declared constructor are nonproject checked evidence");
  const requests = [];
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, [file], budget, {
    nativeConstructorsFor(declaration) {
      requests.push(declaration);
      return declaration === native ? [constructor] : undefined;
    },
  });
  const target = name => {
    const initializer = Node_Initializer(source.ast, namedVariable(source.ast, file, name));
    const construction = source.ast.as.AsNewExpression(initializer);
    assert.equal(construction !== undefined, true, `${name}: the original construction is retained`);
    return transport.subjectFor(construction.Expression);
  };
  const nativeSubject = target("native");
  const constructors = nativeSubject === undefined ? undefined : transport.nativeConstructorsFor(nativeSubject);
  assert.equal(constructors?.length === 1 && constructors[0] === constructor && Object.isFrozen(constructors), true,
    "the exact provider-selected native constructor is retained without a substitute allocation");
  const lineages = sourceStorageClassLineages(source, budget,
    new Set([{ subject: nativeSubject, bindings: transport.substitutions.empty }]), {
      subjectFor: transport.subjectFor, nativeConstructorsFor: transport.nativeConstructorsFor, valuesFor: () => undefined,
    }, "heritage");
  assert.equal(lineages?.length === 1 && lineages[0].complete && lineages[0].nativeBase?.constructors[0] === constructor, true,
    "the canonical lineage carries the same native base identity");
  for (const name of ["foreign", "factory"]) {
    const selected = target(name);
    assert.equal(selected !== undefined && transport.nativeConstructorsFor(selected) === undefined, true,
      `${name}: an unproved class or factory cannot manufacture native evidence`);
  }
  assert.equal(requests.includes(native) && requests.includes(foreign) && !requests.includes(local), true,
    "the native owner decides nonproject class evidence and never receives a project class as native");
  assert.equal(budget.failure() === undefined, true, "ordinary finite resource guards remain unchanged");
});

test("construction storage follows exact immutable and parenthesized copies through its canonical finite domain", () => {
  const current = fixture();
  const original = current.storage.nodes.find(node => current.source.ast.is.IsClassDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "Ready");
  for (const name of ["copied", "parenthesized", "published"]) {
    const selected = current.storage.constructionFor(current.invocation(name));
    assert.equal(selected.kind === "resolved" && selected.alternatives.length === 1 &&
      selected.alternatives[0].root === original, true, name);
  }
  assert.equal("sourceStorageConstructedClass" in construction, false, "The superseded syntax alias selector is removed.");
  assert.equal("sourceStorageClassValue" in construction, false, "No competing singular class-value selector remains.");
  assert.equal("sourceStorageInvokedClass" in construction, false, "Every constructor consumer uses finite actual source values.");
});

for (const [name, text] of [
  ["implicit receiver", "class Owner { value = 1; } const owner = new Owner();"],
  ["fallthrough", "class Owner { value = 1; constructor() { this.value = 2; } } const owner = new Owner();"],
  ["bare return", "class Owner { value = 1; constructor() { return; } } const owner = new Owner();"],
  ["this", "class Owner { value = 1; constructor() { return this; } } const owner = new Owner();"],
  ["receiver alias", "class Owner { value = 1; constructor() { const self = this; return self; } } const owner = new Owner();"],
  ["transparent receiver", "class Owner { value = 1; constructor() { const self: Owner = this; return ((self) as Owner); } } const owner = new Owner();"],
  ["conditional same receiver", "class Owner { value = 1; constructor(flag: boolean) { const self = this; return flag ? self : this; } } const owner = new Owner(true);"],
  ["generic parameter property and default", "class Owner<T> { constructor(readonly value: T, flag = true) { if (flag) { const self = this; return self; } } } const owner = new Owner(1);"],
  ["derived receiver", "class Base { value = 1; } class Owner extends Base { constructor() { super(); const self = this; return self; } } const owner = new Owner();"],
  ["implicit derived", "class Base { constructor(readonly value = 1) {} } class Owner extends Base {} const owner = new Owner();"],
  ["nested non-constructor return", "class Owner { value = 1; constructor() { const nested = () => { return { value: 2 }; }; nested(); return this; } } const owner = new Owner();"],
  ["native declaration", "declare class Owner { readonly value: number; constructor(value: number); } const owner = new Owner(1);"],
  ["checked never result", "function fail(): never { throw 'stop'; } class Owner { value = 1; constructor() { return fail(); } } const owner = new Owner();"],
  ["opaque checked never result", "declare function fail(): never; class Owner { value = 1; constructor() { return fail(); } } const owner = new Owner();"],
  ["aliased checked never result", "function fail(): never { throw 'stop'; } const terminate = fail; class Owner { value = 1; constructor() { return terminate(); } } const owner = new Owner();"],
  ["transparent checked never result", "function fail(): never { throw 'stop'; } class Owner { value = 1; constructor() { return ((fail())); } } const owner = new Owner();"],
  ["receiver or checked never", "function fail(): never { throw 'stop'; } class Owner { value = 1; constructor(flag: boolean) { return flag ? this : fail(); } } const owner = new Owner(true);"],
]){
test(`constructor result admission preserves ${name}`, () => {
    const current = constructorResultFixture(text);
    const issues = analyzeSourceConstructorResults(current.source);
    assert.equal(issues.length, 0, `${name}: no receiver substitution is introduced.`);
    assert.equal(Object.isFrozen(issues), true, `${name}: admission publishes immutable issues.`);
  });
}
