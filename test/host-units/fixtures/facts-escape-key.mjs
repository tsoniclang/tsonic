import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePackageId, encodeModuleId, encodeDefId, encodeBodyId, encodeKey } from "../../../packages/host/dist/ids/index.js";
import { verificationAccount, verificationStops } from "./facts-verification.mjs";

export async function escapeKeyCases(suite) {
  const facts = await import("../../../packages/host/dist/ir-facts/index.js");
  const internal = await import("../../../packages/host/dist/ir-facts/escape-key.js");
  const { admitEscapeIdentity } = await import("../../../packages/host/dist/ir-facts/verification.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const { createAccount, refuseAccount, accountFailure } = await import("../../../packages/host/dist/dataflow/index.js");
  const module = encodeModuleId({ package: encodePackageId("escape-key"), path: "main.ts" });
  const definition = encodeDefId({ module, segments: [{ name: "function", ordinal: 0 }] });
  const body = encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
  const library = { module: { providerId: "provider", providerVersion: "1", packageName: "package",
    moduleSpecifier: "library", providerModuleId: "library-id" }, exportId: "api", memberId: "member", signatureId: "signature" };
  const targets = [
    [{ kind: "return" }, ["return"]], [{ kind: "throw" }, ["throw"]],
    ...[null, 0, 1].flatMap(path => [
      [{ kind: "receiver", path }, ["receiver", path]],
      [{ kind: "parameter", index: 0, path }, ["parameter", 0, path]],
      [{ kind: "capture", index: 0, path }, ["capture", 0, path]],
      [{ kind: "shared", definition, path }, ["shared", definition, path]],
    ]),
    [{ kind: "capture", index: 1, path: null }, ["capture", 1, null]],
    [{ kind: "external", boundary: 0 }, ["external", 0]],
    [{ kind: "external", boundary: 1 }, ["external", 1]],
    ...["callback", "suspension"].flatMap(kind => [
      [{ kind, at: { kind: "node", node: { kind: "body", value: { body, node: 2 } } } }, [kind, ["node", "body", body, 2]]],
      [{ kind, at: { kind: "node", node: { kind: "item", value: { owner: definition, node: 2 } } } }, [kind, ["node", "item", definition, 2]]],
      [{ kind, at: { kind: "declared", identity: library, site: 0 } },
        [kind, ["declared", "provider", "1", "package", "library", "library-id", "api", "member", "signature", 0]]],
    ]),
  ];

  await suite.test("one paid implementation preserves complete canonical target identity and existing admission units", () => {
    assert.equal(facts.escapeTargetKey === internal.escapeTargetKey, true);
    for (const [target, data] of targets) {
      const account = verificationAccount();
      const expectedAccount = verificationAccount();
      assert.equal(admitEscapeIdentity(target, expectedAccount), null);
      assert.deepEqual(facts.escapeTargetKey(target, account), { kind: "complete", value: encodeKey(data) });
      const actual = InvocationAccount.stateOf(account);
      const expected = InvocationAccount.stateOf(expectedAccount);
      assert.deepEqual([actual.work, actual.entries, actual.failure], [expected.work, expected.entries, expected.failure]);
    }
  });

  await suite.test("same-position capture, throw, projection and qualified-site ties retain exact existing lexical order", () => {
    const expected = targets.map(([, data]) => encodeKey(data)).sort();
    const actual = targets.map(([target]) => facts.escapeTargetKey(target, verificationAccount()).value).sort();
    assert.deepEqual(actual, expected);
    assert.equal(new Set(actual).size, targets.length);
    for (const [target] of targets) assert.deepEqual(facts.escapeTargetKey(structuredClone(target), verificationAccount()),
      facts.escapeTargetKey(target, verificationAccount()));
  });

  await suite.test("every smaller work/record allowance and original sticky refusal stop before further target reads", () => {
    for (const [target] of targets) {
      const reference = verificationAccount();
      const expected = facts.escapeTargetKey(target, reference);
      const { work, entries } = InvocationAccount.stateOf(reference);
      assert.deepEqual(facts.escapeTargetKey(target, createAccount({ maximumWork: work, maximumResultEntries: entries })), expected);
      verificationStops(account => facts.escapeTargetKey(target, account));
    }
    const account = verificationAccount();
    const refusal = { kind: "refused", diagnostics: [] };
    refuseAccount(account, refusal);
    const unread = new Proxy({}, { get() { assert.fail("An original stop prevents every target read"); } });
    assert.equal(facts.escapeTargetKey(unread, account), refusal);
    assert.equal(accountFailure(account), refusal);
    const exhausted = createAccount({ maximumWork: 0, maximumResultEntries: 0 });
    const stop = facts.escapeTargetKey(unread, exhausted);
    assert.equal(stop, accountFailure(exhausted));
    assert.equal(facts.escapeTargetKey(unread, exhausted), stop);
  });

  await suite.test("fresh public declarations require the same paid reader and reject the unpaid or naked-string form", () => {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const stage = mkdtempSync(resolve(root, ".temp/escape-key-"));
    const compiler = resolve(process.env.TSONIC_HOST_TOOLING_ROOT ?? root, "node_modules/@typescript/native-preview/bin/tsgo.js");
    const write = (name, value) => writeFileSync(resolve(stage, name), typeof value === "string" ? value : JSON.stringify(value));
    const compile = name => {
      const result = spawnSync(process.execPath, [compiler, "--project", resolve(stage, name), "--pretty", "false"],
        { cwd: root, encoding: "utf8", timeout: 90000, maxBuffer: 1048576 });
      write(`${name}.log`, `${result.stdout ?? ""}${result.stderr ?? ""}`);
      assert.equal(result.signal, null);
      if (result.error !== undefined) throw result.error;
      return { status: result.status, output: result.stdout + result.stderr };
    };
    write("package.json", { type: "module", private: true });
    write("producer.json", { extends: resolve(root, "packages/host/tsconfig.json"), compilerOptions: {
      declaration: true, declarationMap: false, sourceMap: false, emitDeclarationOnly: true, noEmit: false,
      noEmitOnError: true, rootDir: resolve(root, "packages/host/src"), outDir: resolve(stage, "declarations"), types: [] },
      files: [resolve(root, "packages/host/src/ir-facts/index.ts")], include: [] });
    assert.deepEqual(compile("producer.json"), { status: 0, output: "" });
    write("reader.ts", 'import { escapeTargetKey } from "./declarations/ir-facts/index.js";\nimport type { EscapeTargetKey, EscapeTarget } from "./declarations/ir-facts/contract.js";\nimport type { DataflowAccount, DataflowResult } from "./declarations/dataflow/contract.js";\nexport const key: EscapeTargetKey = escapeTargetKey;\nexport function read(at: EscapeTarget, account: DataflowAccount): DataflowResult<string> { return key(at, account); }\n');
    write("reader.json", { extends: resolve(root, "tsconfig.base.json"), compilerOptions: { noEmit: true, types: [],
      strict: true, skipLibCheck: false, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true },
      files: [resolve(stage, "reader.ts")], include: [] });
    assert.deepEqual(compile("reader.json"), { status: 0, output: "" });
    write("reader.ts", 'import { escapeTargetKey } from "./declarations/ir-facts/index.js";\nimport type { EscapeTarget } from "./declarations/ir-facts/contract.js";\nimport type { DataflowAccount } from "./declarations/dataflow/contract.js";\nexport function invalid(at: EscapeTarget, account: DataflowAccount): string { escapeTargetKey(at); return escapeTargetKey(at, account); }\n');
    const invalid = compile("reader.json");
    assert.equal(invalid.status, 1, invalid.output.slice(-4000));
    assert.deepEqual([...invalid.output.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])), [2554, 2322]);
  });
}
