import assert from "node:assert/strict";
import test from "node:test";
import { getTargetCompilationPaths, resolveProjectPaths } from "../../packages/host/dist/index.js";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

function fixture(sourceText, files = {}) {
  const targetPack = createCsharpTargetPack();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const project = { entryPoint: "index.ts", rootDir: ".", targets: [target] };
  const paths = getTargetCompilationPaths(resolveProjectPaths({ projectFilePath: "/src/tsonic.json", project }), target);
  const checked = checkSourceProgramFixture({
    project, projectDirectory: "/src", currentDirectory: "/src", target, targetPack, paths,
    selectedCapabilities: [], selectedSurfaces: [],
    files: { "/src/index.ts": sourceText, ...files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  });
  assert.equal(checked.kind === "resolved", true, checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  const source = checked.value;
  const file = source.sourceFiles.find(node => source.ast.getFileName(node) === "/src/index.ts");
  assert.equal(file !== undefined, true, "the actual normal entry retains the original project file");
  const nodes = source.facts.navigation.nodesForFiles([file]);
  const expressionText = node => source.ast.is.IsPropertyAccessExpression(node)
    ? expressionText(source.ast.as.AsPropertyAccessExpression(node).Expression) + "." + source.ast.text(source.ast.name(node))
    : source.ast.text(source.ast.name(node) ?? node);
  const call = (name, occurrence = 0) => {
    const selected = nodes.filter(node => source.ast.is.IsCallExpression(node) &&
      expressionText(source.ast.as.AsCallExpression(node).Expression) === name);
    assert.equal(selected[occurrence] !== undefined, true, name + ": the exact original call exists");
    return selected[occurrence];
  };
  const propertyCall = (name, occurrence = 0) => {
    const selected = nodes.filter(node => source.ast.is.IsCallExpression(node) &&
      source.ast.is.IsPropertyAccessExpression(source.ast.as.AsCallExpression(node).Expression) &&
      source.ast.text(source.ast.name(source.ast.as.AsCallExpression(node).Expression)) === name);
    assert.equal(selected[occurrence] !== undefined, true, name + ": the exact original member call exists");
    return selected[occurrence];
  };
  const fact = occurrence => {
    const selected = source.facts.protocols.safety(occurrence);
    assert.equal(selected.kind === "resolved", true, "the original safety query resolves without recoding");
    return selected.value.kind === "none" ? undefined : selected.value.value;
  };
  return { source, call, propertyCall, fact };
}

test("unsafe context facts distinguish exact expression and remaining-block forms", () => {
  const current = fixture(`
    import { unsafecontext as unsafeAlias } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    import { unsafecontext as localUnsafe } from "./local.js";

    const direct = unsafeAlias(1 + 2);
    const namespaced = core.unsafecontext(3 + 4);
    {
      unsafeAlias();
      const inside = 5;
    }
    localUnsafe(6);
    {
      const unsafeAlias = <T>(value: T): T => value;
      unsafeAlias(7);
    }
  `, {
    "/src/local.ts": "export function unsafecontext<T>(value: T): T { return value; }",
  });
  const expressionCall = current.call("unsafeAlias", 0);
  const expression = current.fact(expressionCall);
  assert.equal(expression?.kind, "unsafe-context");
  assert.equal(expression?.fact.kind, "expression");
  assert.equal(expression?.fact.expression === current.source.ast.as.AsCallExpression(expressionCall).Arguments[0], true,
    "the expression receipt retains the exact authored operand");
  assert.equal(current.fact(current.call("core.unsafecontext"))?.fact.kind, "expression");
  assert.deepEqual(current.fact(current.call("unsafeAlias", 1))?.fact, { kind: "remaining-block" });
  assert.equal(current.fact(current.call("localUnsafe")), undefined);
  assert.equal(current.fact(current.call("unsafeAlias", 2)), undefined);
  assert.equal(current.source.facts.protocols.safety(expressionCall) === current.source.facts.protocols.safety(expressionCall), true);
  assert.throws(() => current.source.facts.protocols.safety({ ...expressionCall }), /original/i);
});

test("unsafe block marker rejects every non-leading or non-statement placement", () => {
  const current = fixture(`
    import { unsafecontext } from "@tsonic/core/lang.js";

    {
      const before = 1;
      unsafecontext();
    }
    const invalid = unsafecontext();
  `);
  for (const ordinal of [0, 1]) {
    const occurrence = current.call("unsafecontext", ordinal);
    const selected = current.source.facts.protocols.safety(occurrence);
    assert.equal(selected.kind === "refused" && selected.source === "tsonic" &&
      selected.code === "SOURCE_CORE_UNSAFE_CONTEXT_BLOCK_POSITION_INVALID" && selected.site === occurrence, true,
      "the Source owner preserves the exact original block-position negative and site");
    assert.equal(current.source.facts.protocols.safety(occurrence) === selected, true);
  }
});

test("safety facts retain exact function, member, constructor, and accessor subjects", () => {
  const current = fixture(`
    import { safety } from "@tsonic/core/lang.js";
    import type { int32 } from "@tsonic/core/types.js";

    function read(value: int32): int32 { return value; }
    class Box {
      value: int32 = 0;
      constructor(value: int32) { this.value = value; }
      method(value: int32): int32 { return value; }
      get current(): int32 { return this.value; }
      set current(value: int32) { this.value = value; }
    }
    interface Indexed {
      [key: string]: int32;
    }

    safety(read).requiresunsafe();
    safety<Box>().method(box => box.method).requiresunsafe();
    safety<Box>().constructor().safe();
    safety<Box>().property(box => box.value).requiresunsafe();
    safety<Box>().property(box => box.current).getter().safe();
    safety<Box>().property(box => box.current).setter().requiresunsafe();
    safety<Indexed>().indexer(value => value[""]).getter().requiresunsafe();
  `);
  const applications = [
    ["requiresunsafe", 0, "requires-unsafe", "declaration", "read"],
    ["requiresunsafe", 1, "requires-unsafe", "declaration", "method"],
    ["safe", 0, "safe", "constructor", "Box"],
    ["requiresunsafe", 2, "requires-unsafe", "declaration", "value"],
    ["safe", 1, "safe", "getter", "current"],
    ["requiresunsafe", 3, "requires-unsafe", "setter", "current"],
    ["requiresunsafe", 4, "requires-unsafe", "getter", undefined],
  ];
  const { ast } = current.source;
  const typeName = node => ast.is.IsTypeReferenceNode(node) ? typeName(ast.as.AsTypeReferenceNode(node).TypeName)
    : ast.is.IsQualifiedName(node) ? typeName(ast.as.AsQualifiedName(node).Right) : ast.text(node);
  for (const [callee, occurrence, contract, placement, selectedName] of applications) {
    const operation = current.fact(current.propertyCall(callee, occurrence));
    assert.equal(operation?.kind === "safety-builder" && operation.fact.kind === "application", true);
    const application = operation.fact;
    assert.equal(application.contract, contract);
    assert.equal(application.placement, placement);
    const selected = application.selectedDeclaration.kind === "present"
      ? application.selectedDeclaration.value : application.applicationTarget;
    if (selectedName !== undefined) assert.equal(typeName(ast.name(selected) ?? selected), selectedName);
    else assert.equal(ast.is.IsIndexSignatureDeclaration(selected), true);
    if (application.selectedDeclaration.kind === "present") {
      assert.equal(application.selectedDeclarations.length > 0, true);
      assert.equal(application.selectedDeclarations.includes(application.selectedDeclaration.value), true);
      assert.equal(Object.isFrozen(application.selectedDeclarations), true);
      assert.equal(application.selectedDeclarations.every(node => current.source.facts.navigation.includes(node)), true);
    }
  }
});

test("safety facts are shadow-safe and reject unproven selector chains", () => {
  const current = fixture(`
    import { safety as sourceSafety } from "@tsonic/core/lang.js";
    import { safety as localSafety } from "./local.js";

    class Box { value = 1; }
    sourceSafety<Box>().method(box => box.value).requiresunsafe();
    localSafety<Box>().requiresunsafe();
    {
      const sourceSafety = <T>(_target: T) => ({ requiresunsafe(): void {} });
      sourceSafety(new Box()).requiresunsafe();
    }
  `, {
    "/src/local.ts": "export function safety<T>() { return { requiresunsafe(): void {} }; }",
  });
  const selector = current.propertyCall("method");
  const rejected = current.source.facts.protocols.safety(selector);
  assert.equal(rejected.kind === "refused" && rejected.code === "SOURCE_CORE_SAFETY_SELECTOR_MEMBER_KIND_INVALID" &&
    rejected.site === selector, true, "the original wrong-member-kind predicate remains a Source refusal");
  assert.equal(current.source.facts.protocols.safety(current.propertyCall("requiresunsafe", 0)) === rejected, true,
    "the terminal propagates its identical predecessor refusal rather than dropping the recognized chain");
  assert.equal(current.fact(current.propertyCall("requiresunsafe", 1)), undefined);
  assert.equal(current.fact(current.propertyCall("requiresunsafe", 2)), undefined);
});

test("requiresunsafe is the sole safety terminal spelling on both original normal-entry builders", () => {
  const current = fixture(`
    import { safety as declareSafety } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    interface Worker { execute(): void; value: number; }
    declareSafety<Worker>().requiresunsafe();
    core.safety<Worker>().method(worker => worker.execute).requiresunsafe();
  `);
  for (const index of [0, 1]) {
    const operation = current.fact(current.propertyCall("requiresunsafe", index));
    assert.equal(operation?.kind === "safety-builder" && operation.fact.kind === "application" &&
      operation.fact.contract === "requires-unsafe", true);
  }
});
