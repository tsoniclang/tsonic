import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable, requiredNode } from "../fixtures/source-navigation.mjs";

function fixture(body, extraFiles = {}) {
  const files = { "/src/index.ts": `export {}; ${body}`, ...extraFiles };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, Object.keys(files).map(name => checked.getSourceFile(name)));
  const variable = name => namedVariable(source.ast, file, name);
  const subject = name => {
    const selected = storage.subjectFor(variable(name));
    assert.equal(selected.kind === "resolved", true, name);
    return selected.subject;
  };
  return { source, storage, subject, initializer: name => Node_Initializer(source.ast, variable(name)) };
}

test("published readonly class fields retain their actual receiver allocations", () => {
  const current = fixture(`
    class Box { constructor(readonly backing: { readonly token: object }) {} }
    const left = {}; const right = {};
    export const first = new Box({ token: left });
    export const second = new Box({ token: right });
    const one = first.backing.token;
    const two = second.backing.token;
  `);
  for (const [name, original, excluded] of [["one", "left", "right"], ["two", "right", "left"]]) {
    const selected = current.storage.closedOriginsFor(current.subject(name));
    assert.equal(selected.kind === "complete", true, `${name}: readonly publication remains closed; ${selected.reason ?? selected.kind}`);
    assert.equal(selected.origins.length === 1 &&
      selected.origins[0].subject.node === current.initializer(original) &&
      selected.origins[0].subject.projection.length === 0, true, `${name}: exact receiver-owned original allocation`);
    assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer(excluded)), false,
      `${name}: another instance cannot contribute its field payload`);
  }
  assert.equal(current.storage.failureReason() === undefined, true, "receiver publication retains the existing finite proof limits");
});

for (const reverse of [false, true]) {
  test(`a stable guarded receiver retains its written member publication (${reverse})`, () => {
    const current = fixture(`
      class Box { constructor(public items: { token: object }) {} }
      declare function consume(value: { token: object }): void;
      const initial = {}; const token = {};
      const backing = { token: initial };
      const original = new Box(backing);
      export function publish(value: Box): void {
        if (value instanceof Box) {
          value.items = { token };
          consume(value.items);
        }
      }
      publish(original);
      const selected = original.items.token;
      const container = original;
    `);
    const { ast } = current.source;
    const file = ast.getSourceFile(current.initializer("selected"));
    const exposure = requiredNode(ast, file, node => ast.is.IsCallExpression(node) &&
      ast.is.IsIdentifier(ast.as.AsCallExpression(node).Expression) &&
      ast.text(ast.as.AsCallExpression(node).Expression) === "consume");
    const inspectValue = () => {
      const selected = current.storage.closedOriginsFor(current.subject("selected"));
      assert.equal(selected.kind === "open", true, `the written member retains its opaque writer; ${selected.reason ?? selected.kind}`);
      assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write" && boundary.exposure === exposure),
        true, "the exact call still writes the assigned member payload");
      assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token") &&
        origin.subject.projection.length === 0), true, "an unchanged receiver binding cannot hide its actual member write");
    };
    const inspectContainer = () => {
      const selected = current.storage.closedOriginsFor(current.subject("container"));
      assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
        selected.origins[0].subject.node === current.initializer("original") &&
        selected.origins[0].subject.projection.length === 0, true, "member writes cannot replace the original receiver allocation");
    };
    for (const inspect of reverse ? [inspectContainer, inspectValue] : [inspectValue, inspectContainer]) inspect();
    assert.equal(current.storage.failureReason() === undefined, true, "member publication preserves the existing finite proof");
  });

  test(`a reassigned guarded entry retains its physical publication (${reverse})`, () => {
    const current = fixture(`
      class Box { constructor(readonly items: { token: object }) {} }
      declare function consume(value: { token: object }): void;
      const token = {};
      const backing = { token };
      const original = new Box(backing);
      export function publish(value: unknown): void {
        value = original;
        if (value instanceof Box) consume(value.items);
      }
      publish(0);
      const selected = original.items.token;
      const container = original.items;
    `);
    const { ast } = current.source;
    const file = ast.getSourceFile(current.initializer("selected"));
    const exposure = requiredNode(ast, file, node => ast.is.IsCallExpression(node) &&
      ast.is.IsIdentifier(ast.as.AsCallExpression(node).Expression) &&
      ast.text(ast.as.AsCallExpression(node).Expression) === "consume");
    const inspectValue = () => {
      const selected = current.storage.closedOriginsFor(current.subject("selected"));
      assert.equal(selected.kind === "open", true, `the actual opaque writer remains; ${selected.reason ?? selected.kind}`);
      assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write" && boundary.exposure === exposure),
        true, "the exact consume call remains the physical writer");
      assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token") &&
        origin.subject.projection.length === 0), true, "the local reassignment preserves its original token producer");
    };
    const inspectContainer = () => {
      const selected = current.storage.closedOriginsFor(current.subject("container"));
      assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
        selected.origins[0].subject.node === current.initializer("backing") &&
        selected.origins[0].subject.projection.length === 0, true, "by-value publication cannot replace the original container");
    };
    for (const inspect of reverse ? [inspectContainer, inspectValue] : [inspectValue, inspectContainer]) inspect();
    assert.equal(current.storage.failureReason() === undefined, true, "both query orders retain finite exact source proof");
  });
}

for (const recursive of [false, true]) for (const access of ["value.items", 'value["items"]']) {
  test(`opaque narrowed publication cannot poison independent private provenance (${recursive}; ${access})`, () => {
    const current = fixture(`
      class Base {}
      class Selected extends Base { constructor(readonly items: { token: {} }) { super(); } }
      declare function lookup(): Base | undefined;
      declare function consume(value: { token: {} }): void;
      function inspect(value: Base): void {
        if (!(value instanceof Selected)) return;
        const fields = ${access};
        ${recursive ? "const child = lookup(); if (child !== undefined) inspect(child);" : ""}
        consume(fields);
      }
      const input = lookup();
      if (input !== undefined) inspect(input);
      const token = {};
    `);
    const selected = current.storage.closedOriginsFor(current.subject("token"));
    assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
      selected.origins[0].subject.node === current.initializer("token"), true,
    "the unrelated private allocation is proven, not a fabricated opaque class field");
    assert.equal(current.storage.failureReason() === undefined, true);
    const opaque = current.storage.closedOriginsFor(current.subject("input"));
    assert.equal(opaque.kind === "open" && opaque.boundaries.some(boundary => boundary.kind === "opaque-result"), true,
      "publication's checked view does not certify the unknown input allocation");
  });
}

for (const reverse of [false, true]) for (const access of ["value.items", 'value["items"]']) {
  test(`actual backing publication survives a separate unknown receiver (${reverse}; ${access})`, () => {
    const current = fixture(`
      class Base {}
      class Selected extends Base { constructor(readonly items: { token: {} }) { super(); } }
      declare function lookup(): Base;
      declare function consume(value: { token: {} }): void;
      function inspect(value: Base): void {
        if (value instanceof Selected) consume(${access});
      }
      const token = {}; const isolated = {};
      const backing = { token }; const privateBacking = { token: isolated };
      const actual = new Selected(backing);
      ${reverse ? "inspect(lookup()); inspect(actual);" : "inspect(actual); inspect(lookup());"}
      const read = actual.items.token; const privateRead = privateBacking.token;
    `);
    const selected = current.storage.closedOriginsFor(current.subject("read"));
    assert.equal(selected.kind === "open", true,
      `the real physical call retains its exposure; ${selected.reason ?? selected.kind}`);
    assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write"), true,
      "the actual opaque invocation is not erased by the unrelated unknown alternative");
    assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true,
      "the actual initial producer remains known beside its writer");
    const privateRead = current.storage.closedOriginsFor(current.subject("privateRead"));
    assert.equal(privateRead.kind === "complete" && privateRead.origins.length === 1 &&
      privateRead.origins[0].subject.node === current.initializer("isolated"), true,
    "a same-shaped private allocation never borrows the exposed backing's writer");
    assert.equal(current.storage.failureReason(), undefined, "observational failures remain local and finite");
  });
}

test("observational checked-member refusal leaves private evidence intact and refuses the same demanded domain", () => {
  const current = fixture(`
    class Base {}
    class Selected extends Base { constructor(readonly items: { token: {} }) { super(); } }
    declare function lookup(): Base;
    declare function consume(value: { token: {} }): void;
    function inspect(value: Base): {} {
      if (value instanceof Selected) {
        const fields = value.items;
        consume(fields);
        return fields;
      }
      return {};
    }
    const input = lookup();
    const result = inspect(input);
    const original = {};
    const privateValue = original;
  `);
  const selected = current.storage.closedOriginsFor(current.subject("privateValue"));
  assert.equal(selected.kind === "complete", true, "publication observation does not poison an independent allocation");
  assert.equal(selected.origins.length === 1 && selected.origins[0].subject.node === current.initializer("original"), true,
    "the original private allocation remains the only checked producer");
  assert.equal(current.storage.failureReason() === undefined, true, "the observed refusal is local until demanded");
  const demanded = current.storage.closedOriginsFor(current.subject("result"));
  assert.equal(demanded.kind === "unresolved", true, "demanding the unknown member cannot publish successful evidence");
  assert.equal(demanded.reason, "Source storage members require exact checked correspondence.", "the precise refusal is retained");
  assert.equal(current.storage.failureReason(), "Source storage members require exact checked correspondence.",
    "the actual demanded-domain owner promotes the original refusal");
});

test("unknown publication alternatives retain known exposed physical backing and exact opaque writers", () => {
  const current = fixture(`
    class Base {}
    class Selected extends Base { constructor(readonly items: { token: {} }) { super(); } }
    declare function lookup(): Base;
    declare function consume(value: { token: {} }): void;
    function inspect(value: Base): void {
      if (value instanceof Selected) consume(value.items);
    }
    const token = {};
    const backing = { token };
    const actual = new Selected(backing);
    inspect(actual);
    inspect(lookup());
    const read = actual.items.token;
  `);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === "opaque-write"), true,
    `a symbolic alternative cannot erase an admitted physical writer; ${selected.kind}; ${selected.kind === "unresolved"
      ? selected.reason : selected.kind === "open" ? selected.boundaries.map(boundary => boundary.kind).join(",") : ""}`);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true,
    "the real constructor and backing origin survive beside unknown alternatives");
  assert.equal(current.storage.failureReason() === undefined, true);
});

for (const read of ["value.items", "value.items.token", "relay(value.items)"]) {
  test(`strict provenance still rejects an opaque nominal field through ${read}`, () => {
    const current = fixture(`
      class Base {}
      class Selected extends Base { constructor(readonly items: { token: {} }) { super(); } }
      declare const external: Base;
      function relay<T>(value: T): T { return value; }
      function inspect(value: Base): {} {
        if (value instanceof Selected) return ${read};
        return {};
      }
      const result = inspect(external);
    `);
    const selected = current.storage.closedOriginsFor(current.subject("result"));
    assert.equal(selected.kind === "unresolved", true, "unknown member evidence cannot become an empty or complete certificate");
    assert.equal(current.storage.failureReason() === "Source storage members require exact checked correspondence.", true,
      "the demanded unknown relationship keeps its original explicit rejection");
  });
}

test("cross-file checked publication views preserve declaration identities without certifying opaque allocations", () => {
  const current = fixture(`
    import { Base, Selected } from "./model.js";
    declare function lookup(): Base;
    declare function consume(value: { token: {} }): void;
    function inspect(value: Base): void {
      if (value instanceof Selected) consume(value.items);
    }
    inspect(lookup());
    const token = {};
  `, { "/src/model.ts": `
    export class Base {}
    export class Selected extends Base { constructor(readonly items: { token: {} }) { super(); } }
  ` });
  const selected = current.storage.closedOriginsFor(current.subject("token"));
  assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
    selected.origins[0].subject.node === current.initializer("token"), true);
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("publication traversal cannot swallow independent resource exhaustion as missing semantic evidence", () => {
  for (const [label, limits] of [
    ["work", { ...defaultSourceStorageLimits, maximumSteps: 8 }],
    ["rows", { ...defaultSourceStorageLimits, maximumTransportRows: 8 }],
  ]) {
    const current = fixture(`
      class Base {}
      class Selected extends Base { constructor(readonly items: { token: {} }) { super(); } }
      declare function lookup(): Base;
      declare function consume(value: { token: {} }): void;
      function inspect(value: Base): void {
        if (value instanceof Selected) consume(value.items);
      }
      inspect(lookup());
      const token = {};
    `);
    const storage = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles, limits);
    assert.equal(storage.failureReason() !== undefined, true, label);
    assert.equal(storage.subjectFor(current.initializer("token")).kind === "unresolved", true,
      `${label}: actual budget failure remains global and fail-closed`);
  }
});

test("unknown accessor execution cannot disappear from a later physical-store proof", () => {
  const current = fixture(`
    const original = {};
    const replacement = {};
    let slot = original;
    class Base {}
    class Selected extends Base { get items(): {} { slot = replacement; return {}; } }
    declare const external: Base;
    function inspect(value: Base): void {
      if (value instanceof Selected) { const ignored = value.items; }
    }
    inspect(external);
    const result = slot;
  `);
  const selected = current.storage.closedOriginsFor(current.subject("result"));
  assert.equal(selected.kind === "unresolved", true,
    "needed execution evidence cannot be erased merely because the getter's returned value is unused");
  assert.equal(current.storage.failureReason() === "Source storage members require exact checked correspondence.", true);
});
