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
} from "../pointers/facts.js";
import {
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
} from "../identity.js";
import { createTsonicCoreSourceExtension } from "../extension/source-extension.js";
import { tsonicCoreSourceSemanticsModules } from "../extension/source-modules.js";
import { createTsonicCoreVirtualModulesProvider } from "../extension/virtual-modules.js";

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
  assert.equal(lang.exports.filter((entry) => entry.name === "unsafecontext").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "safety").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "loadnativeptr").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "storenativeptr").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "offsetnativeptr").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "__TsonicSafetyBuilder").length, 1);
  assert.equal(lang.exports.filter((entry) => entry.name === "__TsonicSafetyMemberBuilder").length, 1);
});

test("native pointer operations retain exact selected pointee and operand evidence", () => {
  const { checked, sourceFile } = createCleanSession(`
    import type { NativePointer, int32, nativeInt } from "@tsonic/core/types.js";
    import {
      loadnativeptr as load,
      offsetnativeptr,
      storenativeptr,
    } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";

    declare const pointer: NativePointer<int32>;
    declare const offset: nativeInt;
    const first = load(pointer);
    storenativeptr(pointer, first + 1);
    const next = offsetnativeptr(pointer, offset);
    const second = core.loadnativeptr(next);
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
    call(checked.ast, sourceFile, "storenativeptr"),
    tsonicNativePointerOperationFactKey,
  );
  assert.equal(storeFact?.operation, "store");
  assert.ok(storeFact?.valueExpression !== undefined);
  assert.equal(storeFact?.pointeeType, loadFact?.pointeeType);

  const offsetFact = fact(
    checked,
    call(checked.ast, sourceFile, "offsetnativeptr"),
    tsonicNativePointerOperationFactKey,
  );
  assert.equal(offsetFact?.operation, "offset");
  assert.ok(offsetFact?.offsetExpression !== undefined);
  assert.equal(offsetFact?.pointeeType, loadFact?.pointeeType);

  const namespacedLoad = fact(
    checked,
    call(checked.ast, sourceFile, "core.loadnativeptr"),
    tsonicNativePointerOperationFactKey,
  );
  assert.equal(namespacedLoad?.operation, "load");
  assert.equal(namespacedLoad?.pointeeType, loadFact?.pointeeType);
});

test("native pointer operations ignore local same-spelled calls", () => {
  const { checked, sourceFile } = createCleanSession(`
    import type { NativePointer, int32 } from "@tsonic/core/types.js";
    import { loadnativeptr as sourceLoad } from "@tsonic/core/lang.js";
    import { loadnativeptr as localLoad } from "./local.js";

    declare const pointer: NativePointer<int32>;
    sourceLoad(pointer);
    localLoad(pointer);
  `, {
    "/src/local.ts": `
      export function loadnativeptr<T>(pointer: T): T { return pointer; }
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
