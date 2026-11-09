import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { orderedDomain } from "./runner/assertions.mjs";
import { withSpecProject } from "./runner/project.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const modelPath = resolve(repository, "packages/host/src/model/contract.ts");
const contextPath = resolve(repository, "packages/host/src/context/contract.ts");
const compiler = resolve(repository, "node_modules/.bin/tsgo");
const strictArguments = Object.freeze(["--ignoreConfig", "--strict", "--noUncheckedIndexedAccess",
  "--exactOptionalPropertyTypes", "--skipLibCheck", "false", "--noEmitOnError",
  "--module", "nodenext", "--target", "es2022", "--types", "node"]);

function compile(argumentsToAdd) {
  const result = spawnSync(compiler, [...strictArguments, ...argumentsToAdd], {
    cwd: repository, encoding: "utf8", timeout: 30_000, maxBuffer: 131_072,
  });
  assert.equal(result.error === undefined, true, "actual strict compiler completed");
  assert.equal(result.signal, null, "actual strict compiler was not killed");
  assert.equal(result.stderr, "", "compiler has no launcher or internal error");
  return result;
}

function imports(model = modelPath, context = contextPath) {
  return `import type * as Model from ${JSON.stringify(model)};
import type * as Port from ${JSON.stringify(context)};
declare const context: Port.Context;
declare const scope: Port.ResourceScope;
declare const identity: Model.Identity;
declare const original: Model.Original;
declare const programIdentity: Model.ProgramIdentity;
declare const site: Model.SourceSite;
declare const stringQuestion: Port.Question<string, string>;
declare const bigintQuestion: Port.Question<bigint, bigint>;
`;
}

function positive(model = modelPath, context = contextPath) {
  return `${imports(model, context)}
const none: Model.Presence<Model.SourceSite> = {kind: 'none'};
const present: Model.Presence<Model.SourceSite> = {kind: 'present', value: site};
const evidence: readonly Model.DiagnosticEvidence[] = [
  {name: 'text', value: 'value'}, {name: 'number', value: 1.5},
  {name: 'integer', value: 9007199254740993n}, {name: 'boolean', value: true},
];
const categories: readonly Model.Diagnostic['category'][] = ['error', 'warning', 'message'];
const diagnostic: Model.Diagnostic = {category: 'error', code: 'TYPE_CASE', source: 'host',
  owner: 'type-case', message: 'type-only data', site: present, related: [site], evidence};
const limit: Model.ResourceLimit = {dimension: 'work', limit: 131072n};
const domain: Model.ResourceDomain = {name: 'type-case', limits: [limit]};
const options: Port.ContextOptions = {resourceDomains: [domain]};
const usage: Model.ResourceUsage = {domain: 'type-case', owner: identity, dimension: 'work',
  charged: 1n, temporary: 0n, retained: 1n, peak: 1n};
const parts: readonly [Model.Identity, string, number, bigint, boolean, null, readonly Port.QuestionKeyPart[]]
  = [original, 'component', 2, 3n, true, null, [identity, ['nested']]];
const questionIdentity: Port.QuestionIdentity = {scope, parts};
const stringDefinition: Port.QuestionDefinition<string, string> = {
  owner: 'type-case', name: 'string', retention: 'immutable',
  authenticate: input => ({scope, parts: [input, identity]}),
};
const bigintDefinition: Port.QuestionDefinition<bigint, bigint> = {
  owner: 'type-case', name: 'bigint', retention: 'immutable',
  authenticate: input => ({scope, parts: [input]}),
};
const stringRegistration: Port.Registration<string, string> = context.register(stringDefinition);
const bigintRegistration: Port.Registration<bigint, bigint> = context.register(bigintDefinition);
const stringHandle: Port.Question<string, string> = stringRegistration.question;
const bigintHandle: Port.Question<bigint, bigint> = bigintRegistration.question;
stringRegistration.provide((input, actualScope) => {
  actualScope.charge('work', 1n);
  return input.toUpperCase();
});
bigintRegistration.provide((input, actualScope) => actualScope.withDepth('depth', () => input + 1n));
type Pending = {readonly kind: 'pending'; readonly dependencies: readonly Model.Identity[]};
type Answer = Model.Presence<string> | Pending;
const retention: Port.QuestionRetention<Answer> = 'completed-outcome';
const presenceRetention: Port.QuestionRetention<Model.Presence<string>> = 'completed-outcome';
const primitiveRetention: Port.QuestionRetention<string | bigint | null | undefined> = 'immutable';
const recordRetention: Port.QuestionRetention<{readonly value: bigint}> = 'immutable';
type ClosedOutcome = {readonly kind:'resolved'; readonly value:string}
  | {readonly kind:'refused'; readonly diagnostic:Model.Diagnostic}
  | {readonly kind:'pending'; readonly dependencies:readonly Model.Identity[]}
  | {readonly kind:'unresolved'; readonly reason:string}
  | {readonly kind:'partial'; readonly completed:readonly Model.Identity[]};
const closedRetention: Port.QuestionRetention<ClosedOutcome> = 'completed-outcome';
const outcomes: readonly Answer[] = [{kind: 'none'}, {kind: 'present', value: 'value'},
  {kind: 'pending', dependencies: [identity]}];
const outcomeRegistration = context.register<string, Answer>({owner: 'type-case', name: 'outcome',
  retention, authenticate: input => ({scope, parts: [input]})});
declare const suppliedAnswer: Answer;
outcomeRegistration.provide(() => suppliedAnswer);
context.sealRegistration();
const text: string = context.query(stringHandle, 'input');
const integer: bigint = context.query(bigintHandle, 9007199254740993n);
const answer: Answer = context.query(outcomeRegistration.question, 'input');
if (answer.kind === 'present') { const exact: string = answer.value; void exact; }
if (answer.kind === 'pending') { const exact: readonly Model.Identity[] = answer.dependencies; void exact; }
const actualScope: Port.ResourceScope = context.resourceScope('type-case', identity, none);
const temporary: Port.Reservation = actualScope.reserve('rows', 1n, 'temporary');
const retained: Port.Reservation = actualScope.reserve('rows', 1n, 'retained');
const depthResult: bigint = actualScope.withDepth('depth', () => 1n);
temporary.release(); retained.release(); actualScope.close();
const questionUsage: Port.QuestionUsage = {owner: 'type-case', name: 'question',
  calls: 1n, completed: 1n, hits: 0n, active: 0n};
const contextUsage: Port.ContextUsage = {questions: [questionUsage], resources: [usage]};
const observedUsage: Port.ContextUsage = context.queryUsage;
const sameProgram: Model.ProgramIdentity = context.programIdentity;
const maybeUsage: Port.QuestionUsage | undefined = observedUsage.questions[0];
const maybeResource: Model.ResourceUsage | undefined = observedUsage.resources[0];
context.close();
void diagnostic; void categories; void options; void questionIdentity; void presenceRetention;
void primitiveRetention; void recordRetention; void closedRetention; void outcomes; void text; void integer;
void depthResult; void contextUsage; void sameProgram; void maybeUsage; void maybeResource;
`;
}

test("actual Model and noncallable Context contracts compile with every exported type", async () => {
  await withSpecProject([{ path: "positive.mts", text: positive() }], project => {
    const result = compile(["--noEmit", resolve(project.root, "positive.mts")]);
    assert.equal(result.status, 0, `strict actual-contract positives: ${result.stdout.slice(0, 8192)}`);
    assert.equal(result.stdout, "");
  });
});

test("the complete types-only closure emits fresh checked declarations and compiles without implementation sources", async () => {
  await withSpecProject([], async project => {
    const declarations = resolve(project.root, "declarations");
    const emitted = compile(["--declaration", "--emitDeclarationOnly", "--rootDir",
      resolve(repository, "packages/host/src"), "--outDir", declarations, modelPath, contextPath]);
    assert.equal(emitted.status, 0, `fresh checked declaration emit: ${emitted.stdout.slice(0, 8192)}`);
    orderedDomain((await readdir(declarations)).sort(), ["context", "model"], Object.is, "complete declaration modules");
    for (const owner of ["context", "model"]) {
      orderedDomain(await readdir(resolve(declarations, owner)), ["contract.d.ts"], Object.is, `${owner} declaration only`);
    }
    const contextDeclaration = await readFile(resolve(declarations, "context/contract.d.ts"), "utf8");
    assert.equal(contextDeclaration.includes('from "../model/contract.js"'), true, "only the explicit lower Model port");
    const probe = resolve(project.root, "isolated.mts");
    await writeFile(probe, positive(resolve(declarations, "model/contract.js"),
      resolve(declarations, "context/contract.js")), "utf8");
    const isolated = compile(["--noEmit", "--listFiles", probe]);
    assert.equal(isolated.status, 0, `fresh declaration-only consumer: ${isolated.stdout.slice(0, 8192)}`);
    assert.equal(isolated.stdout.includes(modelPath), false, "no Model implementation source redirect");
    assert.equal(isolated.stdout.includes(contextPath), false, "no Context implementation source redirect");
    assert.equal(isolated.stdout.includes(resolve(declarations, "model/contract.d.ts")), true);
    assert.equal(isolated.stdout.includes(resolve(declarations, "context/contract.d.ts")), true);
  });
});

test("all invalid contract boundaries reject with exact compiler codes and counts", async () => {
  const cases = [
    { name: "direct-handle-call", code: 2349, text: "stringQuestion(context, 'input');" },
    { name: "wrong-input", code: 2345, text: "context.query(stringQuestion, 1n);" },
    { name: "wrong-provider-answer", code: 2322,
      text: "declare const registration: Port.Registration<string,string>; registration.provide(() => 1n);" },
    { name: "wrong-provider-input", code: 2345,
      text: "declare const registration: Port.Registration<string,string>; registration.provide((input: bigint) => 'value');" },
    { name: "cross-question-answer", code: 2322, text: "const result: bigint = context.query(stringQuestion, 'input');" },
    { name: "input-invariant", code: 2375, text: "const other: Port.Question<string | number,string> = stringQuestion;" },
    { name: "answer-invariant", code: 2375, text: "const other: Port.Question<string,string | bigint> = stringQuestion;" },
    { name: "input-invariant-reverse", code: 2375,
      text: "declare const wide: Port.Question<string | number,string>; const other: Port.Question<string,string> = wide;" },
    { name: "answer-invariant-reverse", code: 2375,
      text: "declare const wide: Port.Question<string,string | bigint>; const other: Port.Question<string,string> = wide;" },
    { name: "presence-retention", code: 2322,
      text: "const invalid: Port.QuestionRetention<Model.Presence<string>> = 'immutable';" },
    { name: "presence-pending-retention", code: 2322,
      text: "const invalid: Port.QuestionRetention<Model.Presence<string> | {readonly kind:'pending'}> = 'immutable';" },
    { name: "primitive-tagged-mix", code: 2322,
      text: "const invalid: Port.QuestionRetention<string | {readonly kind:'pending'}> = 'immutable';" },
    { name: "record-tagged-mix", code: 2322,
      text: "const invalid: Port.QuestionRetention<{readonly value:string} | {readonly kind:'pending'}> = 'completed-outcome';" },
    { name: "optional-kind", code: 2322,
      text: "const invalid: Port.QuestionRetention<{readonly kind?:'resolved'; readonly value:string}> = 'immutable';" },
    { name: "widened-kind", code: 2322,
      text: "const invalid: Port.QuestionRetention<{readonly kind:string}> = 'completed-outcome';" },
    { name: "nonstr-kind", code: 2322,
      text: "const invalid: Port.QuestionRetention<{readonly kind:1}> = 'completed-outcome';" },
    { name: "unknown-answer", code: 2322, text: "const invalid: Port.QuestionRetention<unknown> = 'immutable';" },
    { name: "object-answer", code: 2322, text: "const invalid: Port.QuestionRetention<object> = 'immutable';" },
    { name: "never-answer", code: 2322, text: "const invalid: Port.QuestionRetention<never> = 'immutable';" },
    { name: "wrong-primitive-retention", code: 2322,
      text: "const invalid: Port.QuestionRetention<bigint> = 'completed-outcome';" },
    { name: "invalid-key-part", code: 2322, text: "const invalid: Port.QuestionKeyPart = undefined;" },
    { name: "sparse-key-parts", code: 2322, text: "const invalid: readonly Port.QuestionKeyPart[] = [,];" },
    { name: "wrong-authentication", code: 2739,
      text: "const invalid: Port.QuestionDefinition<string,string> = {owner:'test', name:'test', retention:'immutable', authenticate: () => identity};" },
    { name: "wrong-retention-definition", code: 2322,
      text: "const invalid: Port.QuestionDefinition<string,Model.Presence<string>> = {owner:'test',name:'test',retention:'immutable',authenticate:()=>({scope,parts:[]})};" },
    { name: "reservation-retention", code: 2345, text: "scope.reserve('rows', 1n, 'forever');" },
    { name: "resource-number", code: 2345, text: "scope.charge('work', 1);" },
    { name: "malformed-limit", code: 2322, text: "const invalid: Model.ResourceLimit = {dimension:'work',limit:1};" },
    { name: "missing-limit", code: 2741, text: "const invalid: Model.ResourceDomain = {name:'work',limits:[{dimension:'work'}]};" },
    { name: "malformed-site", code: 2322,
      text: "const invalid: Model.SourceSite = {original,document:'input.ts',start:1n,length:1};" },
    { name: "malformed-diagnostic", code: 2741,
      text: "const invalid: Model.Diagnostic = {category:'error',code:'test',source:'host',owner:'test',message:'test',site:{kind:'none'},related:[]};" },
    { name: "diagnostic-category", code: 2322,
      text: "declare const diagnostic: Model.Diagnostic; const invalid: Model.Diagnostic = {...diagnostic,category:'fatal'};" },
    { name: "malformed-evidence", code: 2322, text: "const invalid: Model.DiagnosticEvidence = {name:'test',value:{}};" },
    { name: "missing-present-value", code: 2322, text: "const invalid: Model.Presence<string> = {kind:'present'};" },
    { name: "undeclared-api", code: 2339, text: "context.lookup('question');" },
    { name: "old-service-locator", code: 2339, text: "context.services.get('question');" },
    { name: "handle-dispatch", code: 2339, text: "stringQuestion.query(context, 'input');" },
    { name: "unexported-phantom", code: 2459,
      text: `import type {questionTypes} from ${JSON.stringify(contextPath)};` },
    { name: "undeclared-factory", code: 2305,
      text: `import type {createContext} from ${JSON.stringify(contextPath)};` },
    { name: "private-context-import", code: 2307,
      text: `import type {Context} from ${JSON.stringify(resolve(repository, "packages/host/src/context/private.js"))};` },
    { name: "private-model-import", code: 2307,
      text: `import type {Identity} from ${JSON.stringify(resolve(repository, "packages/host/src/model/private.js"))};` },
  ];
  const records = [
    ["Model.ProgramIdentity", ["kind"]],
    ["Model.Identity", ["programIdentity", "owner"]],
    ["Model.Original", ["kind", "programIdentity", "owner"]],
    ["Model.SourceSite", ["original", "document", "start", "length"]],
    ["Model.DiagnosticEvidence", ["name", "value"]],
    ["Model.Diagnostic", ["category", "code", "source", "owner", "message", "site", "related", "evidence"]],
    ["Model.ResourceLimit", ["dimension", "limit"]],
    ["Model.ResourceDomain", ["name", "limits"]],
    ["Model.ResourceUsage", ["domain", "owner", "dimension", "charged", "temporary", "retained", "peak"]],
    ["Port.QuestionIdentity", ["scope", "parts"]],
    ["Port.Question<string,string>", ["owner", "name"]],
    ["Port.QuestionDefinition<string,string>", ["owner", "name", "retention", "authenticate"]],
    ["Port.Registration<string,string>", ["question"]],
    ["Port.ResourceScope", ["programIdentity", "domain", "owner"]],
    ["Port.QuestionUsage", ["owner", "name", "calls", "completed", "hits", "active"]],
    ["Port.ContextUsage", ["questions", "resources"]],
    ["Port.ContextOptions", ["resourceDomains"]],
    ["Port.Context", ["programIdentity", "queryUsage"]],
  ];
  for (const [type, fields] of records) {
    for (const field of fields) {
      cases.push({ name: `readonly-${type.replaceAll(/[^a-z0-9]/giu, "-")}-${field}`, code: 2540,
        text: `declare const record: ${type}; record.${field} = record.${field};` });
    }
  }
  cases.push(
    { name: "readonly-presence-kind", code: 2540,
      text: "declare const record: Model.Presence<string>; record.kind = 'none';" },
    { name: "readonly-presence-value", code: 2540,
      text: "declare const record: Extract<Model.Presence<string>,{kind:'present'}>; record.value = 'changed';" },
  );
  for (const [name, type, vector] of [
    ["question-parts", "Port.QuestionIdentity", "parts"],
    ["diagnostic-related", "Model.Diagnostic", "related"],
    ["diagnostic-evidence", "Model.Diagnostic", "evidence"],
    ["resource-limits", "Model.ResourceDomain", "limits"],
    ["question-usage", "Port.ContextUsage", "questions"],
    ["resource-usage", "Port.ContextUsage", "resources"],
    ["resource-domains", "Port.ContextOptions", "resourceDomains"],
  ]) {
    cases.push({ name: `readonly-vector-${name}`, code: 2339,
      text: `declare const record: ${type}; record.${vector}.push();` });
  }
  assert.equal(cases.length, 103, "complete expected negative boundary domain");
  const names = cases.map(entry => `${entry.name}.mts`);
  assert.equal(new Set(names).size, cases.length, "each negative has one distinct source file");
  await withSpecProject(cases.map(entry => ({ path: `${entry.name}.mts`, text: imports() + entry.text })), project => {
    const result = compile(["--noEmit", ...names.map(name => resolve(project.root, name))]);
    assert.equal(result.status, 1, "real strict compiler rejects invalid contract programs");
    assert.equal((result.stdout.match(/\berror TS\d+:/gu) ?? []).length, cases.length,
      "complete compiler diagnostic count includes every file and any global error");
    const actual = new Map();
    for (const match of result.stdout.matchAll(/^(.*)\(\d+,\d+\): error TS(\d+):/gmu)) {
      const name = basename(match[1]);
      const codes = actual.get(name) ?? [];
      codes.push(Number(match[2]));
      actual.set(name, codes);
    }
    orderedDomain([...actual.keys()].sort(), [...names].sort(), Object.is, "every expected and only expected negative failed");
    const mismatches = cases.flatMap(entry => {
      const codes = actual.get(`${entry.name}.mts`);
      return codes.length === 1 && codes[0] === entry.code ? []
        : [`${entry.name}: expected [${entry.code}], actual [${codes.join(",")}]`];
    });
    assert.equal(mismatches.length, 0, mismatches.join("\n"));
  });
});
