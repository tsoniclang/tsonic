import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test, { before } from "node:test";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const emittedRoot = resolve(repository, "packages/host/dist");
const moved = [
  ["DeclarationRequest", "ir-types"], ["SignatureRequest", "ir-types"], ["DeclarationAttributes", "ir-hir"],
];
let evidenceDirectory;

before(() => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined && process.env.TSONIC_TEST_ADMISSION_OWNER !== undefined,
    true, "all owner tests and compiler children require the admitted aggregate process-group guard");
  const parent = resolve(repository, ".temp/host-record-moves");
  mkdirSync(parent, { recursive: true });
  evidenceDirectory = mkdtempSync(resolve(parent, "proof-"));
});

test("each moved record has exactly one declaring contract and decls imports its owner", () => {
  const declaration = name => new RegExp(`^export (?:interface|type) ${name}\\b`, "mu");
  const contracts = hostCatalogue.filter(module => module.directory.startsWith("packages/host/src/"))
    .map(module => [module.name, readFileSync(resolve(repository, module.contract), "utf8")]);
  for (const [name, owner] of moved) {
    assert.deepEqual(contracts.filter(([, text]) => declaration(name).test(text)).map(([module]) => module), [owner], name);
  }
  const decls = hostCatalogue.find(module => module.name === "decls");
  for (const [, owner] of moved) assert.equal(decls.imports.includes(owner), true, `decls may import ${owner}`);
  const text = readFileSync(resolve(repository, decls.contract), "utf8");
  assert.equal(/^export (?:type )?\{/mu.test(text) || /^export \*/mu.test(text), false, "decls re-exports nothing");
});

test("fresh genuine emitted declarations admit the moved records at their owners and reject every old-owner form exactly", () => {
  const stage = mkdtempSync(resolve(evidenceDirectory, "consumer-"));
  cpSync(emittedRoot, stage, { recursive: true, filter: source => !source.endsWith(".js") && !source.endsWith(".map") });
  writeFileSync(resolve(stage, "package.json"), JSON.stringify({ type: "module", private: true }));
  const types = 'import type { DeclarationRequest, SignatureRequest } from "./ir-types/contract.js";\n';
  const hir = 'import type { DeclarationAttributes } from "./ir-hir/contract.js";\n';
  const same = 'type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;\n';
  const positive = 'import type { Result } from "./diag/contract.js";\n' + types +
    'import type { DeclarationAttributes, HirAttribute } from "./ir-hir/contract.js";\n' +
    'import type { AttributesOf, HeritageOf, SignatureOfDeclaration } from "./decls/contract.js";\n' + same +
    'export const signatureRequest: Same<Parameters<SignatureOfDeclaration>[1], SignatureRequest> = true;\n' +
    'export const heritageRequest: Same<Parameters<HeritageOf>[1], DeclarationRequest> = true;\n' +
    'export const attributesRequest: Same<Parameters<AttributesOf>[1], DeclarationRequest> = true;\n' +
    'export const attributesResult: Same<ReturnType<AttributesOf>, Result<DeclarationAttributes>> = true;\n' +
    'export function endpoint(request: SignatureRequest): "advertised" | "api-signature" | "api-body" { return request.endpoint; }\n' +
    'export function ordinal(request: SignatureRequest): number { return request.ordinal; }\n' +
    'export function declarationOf(request: SignatureRequest): DeclarationRequest { return { definition: request.definition, bindings: request.bindings }; }\n' +
    'export function attributes(value: DeclarationAttributes): readonly HirAttribute[] { return value.attributes; }\n';
  writeFileSync(resolve(stage, "consumer.ts"), positive);
  const compiler = resolve(tooling, "node_modules/@typescript/native-preview/bin/tsgo.js");
  const configuration = files => ({ compilerOptions: {
    strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true,
    noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true,
    skipLibCheck: false, noEmit: true, target: "ES2022", lib: ["ES2022"], types: [],
    module: "NodeNext", moduleResolution: "NodeNext", verbatimModuleSyntax: true,
  }, files });
  const run = (name, files) => {
    writeFileSync(resolve(stage, name), JSON.stringify(configuration(files)));
    const result = spawnSync(process.execPath, [compiler, "--project", resolve(stage, name), "--pretty", "false", "--listFiles"], {
      cwd: stage, encoding: "utf8", maxBuffer: 4_194_304, timeout: 120_000,
    });
    assert.equal(result.error === undefined, true, "the real consumer compiler completes without application error");
    assert.equal(result.signal, null);
    const text = `${result.stdout}${result.stderr}`;
    writeFileSync(resolve(stage, `${name}.log`), text);
    return { status: result.status, text };
  };
  const accepted = run("positive.json", ["consumer.ts"]);
  assert.equal(accepted.status, 0, accepted.text);
  const loaded = accepted.text.split(/\r?\n/u).filter(path => path.startsWith(stage))
    .map(path => relative(stage, path).split(sep).join("/"));
  for (const required of ["consumer.ts", "decls/contract.d.ts", "ir-types/contract.d.ts", "ir-hir/contract.d.ts", "diag/contract.d.ts"])
    assert.equal(loaded.includes(required), true, `${required} is loaded`);
  const negatives = [
    ["old-declaration-request.ts", 'import type { DeclarationRequest } from "./decls/contract.js";\nexport type Old = DeclarationRequest;', 2459],
    ["old-signature-request.ts", 'import type { SignatureRequest } from "./decls/contract.js";\nexport type Old = SignatureRequest;', 2459],
    ["old-declaration-attributes.ts", 'import type { DeclarationAttributes } from "./decls/contract.js";\nexport type Old = DeclarationAttributes;', 2459],
    ["attributes-from-types.ts", 'import type { DeclarationAttributes } from "./ir-types/contract.js";\nexport type Wrong = DeclarationAttributes;', 2305],
    ["request-from-hir.ts", 'import type { SignatureRequest } from "./ir-hir/contract.js";\nexport type Wrong = SignatureRequest;', 2305],
    ["distinct-records.ts", `${types}import type { HeritageOf } from "./decls/contract.js";\n${same}export const wrong: Same<Parameters<HeritageOf>[1], SignatureRequest> = true;\nexport type Kept = DeclarationRequest;`, 2322],
    ["readonly-ordinal.ts", `${types}export function update(request: SignatureRequest): DeclarationRequest { request.ordinal = 1; return request; }`, 2540],
    ["foreign-endpoint.ts", `${types}export function replace(request: SignatureRequest): SignatureRequest | DeclarationRequest { const next: SignatureRequest = { ...request, endpoint: "body" }; return next; }`, 2322],
    ["readonly-attributes.ts", `${hir}export function grow(value: DeclarationAttributes): void { value.attributes.push(); }`, 2339],
  ];
  for (const [name, text] of negatives) writeFileSync(resolve(stage, name), text);
  const refused = run("negative.json", negatives.map(([name]) => name));
  assert.equal(refused.status, 1, refused.text);
  const actual = [...refused.text.matchAll(/^(.+)\(\d+,\d+\): error TS(\d+):/gmu)]
    .map(match => [basename(match[1]), Number(match[2])]).sort(([left], [right]) => left.localeCompare(right));
  assert.equal([...refused.text.matchAll(/error TS\d+:/gu)].length, actual.length, refused.text);
  const expected = negatives.map(([name, , code]) => [name, code]).sort(([left], [right]) => left.localeCompare(right));
  assert.deepEqual(actual, expected, refused.text);
});
