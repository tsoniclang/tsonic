import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCompilerSessionFromFiles,
  createSourceSemanticsExtension,
  formatDiagnostics,
} from "@tsonic/tsts";
import type {
  AstReader,
  CheckedSourceProgram,
  CompilerSession,
  ExtensionFactKey,
  ExtensionFactSubject,
  Node,
  ReadonlySourceFactResolver,
  SourceFile,
} from "@tsonic/tsts";
import {
  tsonicNativePointerOperationFactKey,
  tsonicSafetyBuilderFactKey,
  tsonicUnsafeContextFactKey,
} from "./explicit-safety-facts.js";
import {
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
} from "./identity.js";
import { createTsonicCoreSourceExtension } from "./source-extension.js";
import { tsonicCoreSourceSemanticsModules } from "./source-modules.js";
import { createTsonicCoreVirtualModulesProvider } from "./virtual-modules.js";

test("source-core publishes one exact neutral native-pointer and safety surface", () => {
  const provider = createTsonicCoreVirtualModulesProvider();
  const types = provider.getDeclarationModel(assertResolution(
    provider.resolveModule(tsonicCoreTypesModule, {}),
  ), {
    context: {},
    materialization: { kind: "complete" },
  });
  const lang = provider.getDeclarationModel(assertResolution(
    provider.resolveModule(tsonicCoreLangModule, {}),
  ), {
    context: {},
    materialization: { kind: "complete" },
  });
  assert.ok(!("category" in types));
  assert.ok(!("category" in lang));
  assert.equal(types.exports.filter((entry) => entry.name === "NativePointer").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "unsafeContext").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "safety").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "loadNativePointer").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "storeNativePointer").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "offsetNativePointer").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "__TsonicSafetyBuilder").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "__TsonicSafetyMemberBuilder").length, 1);
});

test("native pointer operations retain exact selected pointee and operand evidence", () => {
  const { checked, sourceFile } = createCleanSession(`
    import type { NativePointer, int32, nativeInt } from "@tsonic/core/types.js";
    import {
      loadNativePointer as load,
      offsetNativePointer,
      storeNativePointer,
    } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";

    declare const pointer: NativePointer<int32>;
    declare const offset: nativeInt;
    const first = load(pointer);
    storeNativePointer(pointer, first + 1);
    const next = offsetNativePointer(pointer, offset);
    const second = core.loadNativePointer(next);
  `);

  const loadFact = fact(
    checked,
    call(checked.ast, sourceFile, "load"),
    tsonicNativePointerOperationFactKey,
  );
  assert.equal(loadFact?.operation, "load");
  assert.ok(loadFact?.pointerExpression !== undefined);
  assert.ok(loadFact?.pointeeType !== undefined);

  const storeFact = fact(
    checked,
    call(checked.ast, sourceFile, "storeNativePointer"),
    tsonicNativePointerOperationFactKey,
  );
  assert.equal(storeFact?.operation, "store");
  assert.ok(storeFact?.valueExpression !== undefined);
  assert.equal(storeFact?.pointeeType, loadFact?.pointeeType);

  const offsetFact = fact(
    checked,
    call(checked.ast, sourceFile, "offsetNativePointer"),
    tsonicNativePointerOperationFactKey,
  );
  assert.equal(offsetFact?.operation, "offset");
  assert.ok(offsetFact?.offsetExpression !== undefined);
  assert.equal(offsetFact?.pointeeType, loadFact?.pointeeType);

  const namespacedLoad = fact(
    checked,
    call(checked.ast, sourceFile, "core.loadNativePointer"),
    tsonicNativePointerOperationFactKey,
  );
  assert.equal(namespacedLoad?.operation, "load");
  assert.equal(namespacedLoad?.pointeeType, loadFact?.pointeeType);
});

test("native pointer operations ignore local same-spelled calls", () => {
  const { checked, sourceFile } = createCleanSession(`
    import type { NativePointer, int32 } from "@tsonic/core/types.js";
    import { loadNativePointer as sourceLoad } from "@tsonic/core/lang.js";
    import { loadNativePointer as localLoad } from "./local.js";

    declare const pointer: NativePointer<int32>;
    sourceLoad(pointer);
    localLoad(pointer);
  `, {
    "/src/local.ts": `
      export function loadNativePointer<T>(pointer: T): T { return pointer; }
    `,
  });

  assert.equal(
    fact(
      checked,
      call(checked.ast, sourceFile, "sourceLoad"),
      tsonicNativePointerOperationFactKey,
    )?.operation,
    "load",
  );
  assert.equal(
    fact(
      checked,
      call(checked.ast, sourceFile, "localLoad"),
      tsonicNativePointerOperationFactKey,
    ),
    undefined,
  );
});

test("unsafe context facts distinguish exact expression and remaining-block forms", () => {
  const { checked, sourceFile } = createCleanSession(`
    import { unsafeContext as unsafeAlias } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    import { unsafeContext as localUnsafe } from "./local.js";

    const direct = unsafeAlias(1 + 2);
    const namespaced = core.unsafeContext(3 + 4);
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
    "/src/local.ts": "export function unsafeContext<T>(value: T): T { return value; }",
  });

  const expression = fact(checked, call(checked.ast, sourceFile, "unsafeAlias", 0), tsonicUnsafeContextFactKey);
  assert.equal(expression?.kind, "expression");
  assert.ok(expression?.expression !== undefined);
  const namespaced = fact(checked, call(checked.ast, sourceFile, "core.unsafeContext"), tsonicUnsafeContextFactKey);
  assert.equal(namespaced?.kind, "expression");
  const block = fact(checked, call(checked.ast, sourceFile, "unsafeAlias", 1), tsonicUnsafeContextFactKey);
  assert.deepEqual(block, { kind: "remaining-block" });
  assert.equal(fact(checked, call(checked.ast, sourceFile, "localUnsafe"), tsonicUnsafeContextFactKey), undefined);
  assert.equal(fact(checked, call(checked.ast, sourceFile, "unsafeAlias", 2), tsonicUnsafeContextFactKey), undefined);
});

test("unsafe block marker rejects every non-leading or non-statement placement", () => {
  const { checked } = createSession(`
    import { unsafeContext } from "@tsonic/core/lang.js";

    {
      const before = 1;
      unsafeContext();
    }
    const invalid = unsafeContext();
  `);
  assert.deepEqual(
    checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode),
    [
      "SOURCE_CORE_UNSAFE_CONTEXT_BLOCK_POSITION_INVALID",
      "SOURCE_CORE_UNSAFE_CONTEXT_BLOCK_POSITION_INVALID",
    ],
  );
});

test("safety facts retain exact function, member, constructor, and accessor subjects", () => {
  const { checked, sourceFile } = createCleanSession(`
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

    safety(read).requiresUnsafe();
    safety<Box>().method(box => box.method).requiresUnsafe();
    safety<Box>().constructor().safe();
    safety<Box>().property(box => box.value).requiresUnsafe();
    safety<Box>().property(box => box.current).getter().safe();
    safety<Box>().property(box => box.current).setter().requiresUnsafe();
    safety<Indexed>().indexer(value => value[""]).getter().requiresUnsafe();
  `);

  const applications = [
    ["requiresUnsafe", 0, "requires-unsafe", "declaration", "read"],
    ["requiresUnsafe", 1, "requires-unsafe", "declaration", "method"],
    ["safe", 0, "safe", "constructor", "Box"],
    ["requiresUnsafe", 2, "requires-unsafe", "declaration", "value"],
    ["safe", 1, "safe", "getter", "current"],
    ["requiresUnsafe", 3, "requires-unsafe", "setter", "current"],
    ["requiresUnsafe", 4, "requires-unsafe", "getter", undefined],
  ] as const;
  for (const [callee, occurrence, contract, placement, selectedName] of applications) {
    const application = fact(
      checked,
      propertyCall(checked.ast, sourceFile, callee, occurrence),
      tsonicSafetyBuilderFactKey,
    );
    assert.equal(application?.kind, "application");
    if (application?.kind !== "application") {
      continue;
    }
    assert.equal(application.contract, contract);
    assert.equal(application.applicationPlacement, placement);
    const selected = application.selectedMember ?? application.applicationTarget;
    if (selectedName !== undefined) {
      assert.equal(typeName(checked.ast, checked.ast.name(selected as Node) ?? selected as Node), selectedName);
    } else {
      assert.ok(checked.ast.is.IsIndexSignatureDeclaration(selected as Node));
    }
    if (application.selectedMember !== undefined) {
      assert.ok(application.selectedMemberDeclaration !== undefined);
      assert.ok(application.selectedMemberDeclarations !== undefined);
      assert.ok(application.selectedMemberDeclarations.length > 0);
      assert.ok(
        application.selectedMemberDeclarations.includes(
          application.selectedMemberDeclaration,
        ),
      );
      assert.ok(Object.isFrozen(application.selectedMemberDeclarations));
    }
  }
});

test("safety facts are shadow-safe and reject unproven selector chains", () => {
  const { checked, sourceFile } = createSession(`
    import { safety as sourceSafety } from "@tsonic/core/lang.js";
    import { safety as localSafety } from "./local.js";

    class Box { value = 1; }
    sourceSafety<Box>().method(box => box.value).requiresUnsafe();
    localSafety<Box>().requiresUnsafe();
    {
      const sourceSafety = <T>(_target: T) => ({ requiresUnsafe(): void {} });
      sourceSafety(new Box()).requiresUnsafe();
    }
  `, {
    "/src/local.ts": "export function safety<T>() { return { requiresUnsafe(): void {} }; }",
  });

  assert.deepEqual(
    checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode),
    ["SOURCE_CORE_SAFETY_SELECTOR_MEMBER_KIND_INVALID"],
  );
  assert.equal(fact(checked, propertyCall(checked.ast, sourceFile, "requiresUnsafe", 1), tsonicSafetyBuilderFactKey), undefined);
  assert.equal(fact(checked, propertyCall(checked.ast, sourceFile, "requiresUnsafe", 2), tsonicSafetyBuilderFactKey), undefined);
});

function createSession(source: string, extraFiles: Readonly<Record<string, string>> = {}): {
  readonly checked: CheckedSourceProgram;
  readonly sourceFile: SourceFile;
} {
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": source, ...extraFiles },
    compilerOptions: {
      module: "esnext",
      moduleResolution: "bundler",
      strict: true,
      target: "es2022",
    },
    extensionHostOptions: {
      extensions: [
        createSourceSemanticsExtension({ modules: tsonicCoreSourceSemanticsModules() }),
        createTsonicCoreSourceExtension(),
      ],
    },
  });
  return checkedSource(session);
}

function createCleanSession(source: string, extraFiles: Readonly<Record<string, string>> = {}) {
  const result = createSession(source, extraFiles);
  const diagnostics = result.checked.diagnostics.filter((entry) => entry !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  assert.deepEqual(result.checked.extensionDiagnostics, []);
  return result;
}

function checkedSource(session: CompilerSession) {
  const checked = session.checkSource();
  const sourceFile = checked.getSourceFile("/src/index.ts");
  assert.ok(sourceFile !== undefined);
  return { checked, sourceFile };
}

function fact<T>(
  checked: CheckedSourceProgram,
  subject: ExtensionFactSubject | undefined,
  key: ExtensionFactKey<T>,
): T | undefined {
  return facts(checked).getFact(subject, key);
}

function facts(checked: CheckedSourceProgram): ReadonlySourceFactResolver {
  assert.ok(checked.sourceFacts !== undefined);
  return checked.sourceFacts;
}

function assertResolution<T>(value: T): Exclude<T, { readonly category: string }> {
  assert.ok(!(typeof value === "object" && value !== null && "category" in value));
  return value as Exclude<T, { readonly category: string }>;
}

function call(ast: AstReader, sourceFile: SourceFile, name: string, occurrence = 0): Node {
  return findOccurrence(sourceFile, ast, occurrence, (node) =>
    ast.is.IsCallExpression(node) && expressionText(ast, ast.as.AsCallExpression(node)?.Expression) === name);
}

function propertyCall(ast: AstReader, sourceFile: SourceFile, name: string, occurrence = 0): Node {
  return findOccurrence(sourceFile, ast, occurrence, (node) => {
    if (!ast.is.IsCallExpression(node)) {
      return false;
    }
    const callee = ast.as.AsCallExpression(node)?.Expression;
    return ast.is.IsPropertyAccessExpression(callee) && ast.text(ast.name(callee)) === name;
  });
}

function findOccurrence(
  sourceFile: SourceFile,
  ast: AstReader,
  occurrence: number,
  predicate: (node: Node) => boolean,
): Node {
  let index = 0;
  const node = find(sourceFile, ast, (candidate) => {
    if (!predicate(candidate)) {
      return false;
    }
    if (index === occurrence) {
      return true;
    }
    index += 1;
    return false;
  });
  assert.ok(node !== undefined, `Missing occurrence ${occurrence}.`);
  return node;
}

function find(
  root: Node,
  ast: AstReader,
  predicate: (node: Node) => boolean,
): Node | undefined {
  if (predicate(root)) {
    return root;
  }
  for (const child of ast.children(root)) {
    if (child === undefined) {
      continue;
    }
    const match = find(child, ast, predicate);
    if (match !== undefined) {
      return match;
    }
  }
  return undefined;
}

function expressionText(ast: AstReader, node: Node | undefined): string {
  if (node === undefined) {
    return "";
  }
  if (ast.is.IsPropertyAccessExpression(node)) {
    const expression = ast.as.AsPropertyAccessExpression(node)?.Expression;
    const left = expressionText(ast, expression);
    const right = ast.text(ast.name(node));
    return left.length === 0 ? right : `${left}.${right}`;
  }
  return ast.text(ast.name(node) ?? node);
}

function typeName(ast: AstReader, node: Node): string {
  if (ast.is.IsTypeReferenceNode(node)) {
    const name = ast.as.AsTypeReferenceNode(node)?.TypeName;
    return name === undefined ? "" : typeName(ast, name);
  }
  if (ast.is.IsQualifiedName(node)) {
    const name = ast.as.AsQualifiedName(node)?.Right;
    return name === undefined ? "" : typeName(ast, name);
  }
  return ast.text(node);
}
