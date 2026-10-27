import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";

export function fixture(sourceText: string) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": sourceText },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)).slice(0, 2048));
  assert.equal(checked.extensionDiagnostics.length, 0, "the actual source has no extension rejection");
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The checked fixture source file is required.");
  const source = createTargetSourceProgram(checked);
  const queries = checked.getSourceFileQueries(file);
  const literals: Node[] = [];
  const declarations: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsObjectLiteralExpression(node) || source.ast.is.IsArrayLiteralExpression(node)) literals.push(node);
    if (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsParameterDeclaration(node)) declarations.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const literal = literals[0];
  if (literal === undefined) throw new Error("The checked fixture requires an actual object or array literal.");
  return { checked, file, source, queries, literals, literal, declarations };
}

export const unannotated = [
  ["object", 'const { key } = { key: "value" };'],
  ["parenthesized object", 'const { key } = (({ key: "value" }));'],
  ["const-asserted object", 'const { key } = { key: "value" } as const;'],
  ["parenthesized const-asserted object", 'const { key } = ((({ key: "value" }) as const));'],
  ["angle const-asserted object", 'const { key } = <const>{ key: "value" };'],
  ["parenthesized angle const-asserted object", 'const { key } = ((<const>({ key: "value" })));'],
  ["array", 'const [key] = ["value"];'],
  ["parenthesized array", 'const [key] = ((["value"]));'],
  ["const-asserted array", 'const [key] = ["value"] as const;'],
  ["parenthesized const-asserted array", 'const [key] = (((["value"]) as const));'],
  ["angle const-asserted array", 'const [key] = <const>["value"];'],
  ["parenthesized angle const-asserted array", 'const [key] = ((<const>(["value"])));'],
  ["object parameter", 'export function read({ key } = ({ key: "value" } as const)): string { return key; }'],
  ["array parameter", 'export function read([key] = (["value"] as const)): string { return key; }'],
] as const;

export const authoredDestinations = [
  ["annotated object", 'const { key }: { readonly key: string } = { key: "value" } as const;'],
  ["annotated array", 'const [key]: readonly [string] = ["value"] as const;'],
  ["typed object assertion", 'const { key } = ({ key: "value" } as { key: string });'],
  ["typed array assertion", 'const [key] = (["value"] as [string]);'],
  ["angle typed object assertion", 'const { key } = <{ key: string }>{ key: "value" };'],
  ["angle typed array assertion", 'const [key] = <[string]>["value"];'],
  ["satisfies object", 'const { key } = ({ key: "value" } satisfies { key: string });'],
  ["satisfies array", 'const [key] = (["value"] satisfies [string]);'],
  ["annotated object parameter", 'export function read({ key }: { readonly key: string } = { key: "value" } as const): string { return key; }'],
  ["annotated array parameter", 'export function read([key]: readonly [string] = ["value"] as const): string { return key; }'],
] as const;

export const propagatedPatterns = [
  ["object conditional true branch", 'declare const flag: boolean; const { key } = flag ? { key: "a" } : { key: "b" };', 0],
  ["object conditional false branch", 'declare const flag: boolean; const { key } = flag ? { key: "a" } : { key: "b" };', 1],
  ["array conditional true branch", 'declare const flag: boolean; const [key] = flag ? ["a"] : ["b"];', 0],
  ["array conditional false branch", 'declare const flag: boolean; const [key] = flag ? ["a"] : ["b"];', 1],
  ["object logical-and right operand", 'declare const flag: true; const { key } = flag && { key: "a" };', 0],
  ["array logical-and right operand", 'declare const flag: true; const [key] = flag && ["a"];', 0],
  ["object comma right operand", 'declare function tick(): void; const { key } = (tick(), { key: "a" });', 0],
  ["array comma right operand", 'declare function tick(): void; const [key] = (tick(), ["a"]);', 0],
  ["object logical-or left operand", 'declare const flag: boolean; const { key } = (flag ? { key: "a" } : undefined) || { key: "b" };', 0],
  ["array logical-or left operand", 'declare const flag: boolean; const [key] = (flag ? ["a"] : undefined) || ["b"];', 0],
  ["object nullish left operand", 'declare const flag: boolean; const { key } = (flag ? { key: "a" } : undefined) ?? { key: "b" };', 0],
  ["array nullish left operand", 'declare const flag: boolean; const [key] = (flag ? ["a"] : undefined) ?? ["b"];', 0],
  ["object non-null operand", 'const { key } = { key: "a" }!;', 0],
  ["array non-null operand", 'const [key] = ["a"]!;', 0],
  ["nested object binding default", 'const { inner: { key } = { key: "a" } } = {};', 0],
  ["nested array binding default", 'const [[key] = ["a"]] = [];', 0],
  ["nested object property", 'const { inner: { key } } = { inner: { key: "a" } };', 1],
  ["nested array element", 'const [[key]] = [["a"]];', 1],
  ["object spread operand", 'const { key } = { ...{ key: "a" } };', 1],
  ["composed object contexts", 'declare const flag: boolean; declare function tick(): void; const { key } = (tick(), (flag ? ({ key: "a" } as const) : ({ key: "b" } as const)))!;', 0],
  ["composed array contexts", 'declare const flag: boolean; declare function tick(): void; const [key] = (tick(), (flag ? (["a"] as const) : (["b"] as const)))!;', 1],
] as const;

export const propagatedDestinations = [
  ["annotated object conditional true branch", 'declare const flag: boolean; const { key }: { key: string } = flag ? { key: "a" } : { key: "b" };', 0],
  ["annotated object conditional false branch", 'declare const flag: boolean; const { key }: { key: string } = flag ? { key: "a" } : { key: "b" };', 1],
  ["annotated array conditional true branch", 'declare const flag: boolean; const [key]: readonly [string] = flag ? ["a"] : ["b"];', 0],
  ["annotated array conditional false branch", 'declare const flag: boolean; const [key]: readonly [string] = flag ? ["a"] : ["b"];', 1],
  ["annotated object logical-and right operand", 'declare const flag: true; const { key }: { key: string } = flag && { key: "a" };', 0],
  ["annotated array logical-and right operand", 'declare const flag: true; const [key]: readonly [string] = flag && ["a"];', 0],
  ["annotated object comma right operand", 'declare function tick(): void; const { key }: { key: string } = (tick(), { key: "a" });', 0],
  ["annotated array comma right operand", 'declare function tick(): void; const [key]: readonly [string] = (tick(), ["a"]);', 0],
  ["annotated object logical-or left operand", 'declare const flag: boolean; const { key }: { key: string } = (flag ? { key: "a" } : undefined) || { key: "b" };', 0],
  ["annotated array logical-or left operand", 'declare const flag: boolean; const [key]: readonly [string] = (flag ? ["a"] : undefined) || ["b"];', 0],
  ["annotated object nullish left operand", 'declare const flag: boolean; const { key }: { key: string } = (flag ? { key: "a" } : undefined) ?? { key: "b" };', 0],
  ["annotated array nullish left operand", 'declare const flag: boolean; const [key]: readonly [string] = (flag ? ["a"] : undefined) ?? ["b"];', 0],
  ["annotated object non-null operand", 'const { key }: { key: string } = { key: "a" }!;', 0],
  ["annotated array non-null operand", 'const [key]: readonly [string] = ["a"]!;', 0],
  ["typed nested object default", 'const { inner: { key } = { key: "a" } }: { inner?: { key: string } } = {};', 0],
  ["typed nested array default", 'const { inner: [key] = ["a"] }: { inner?: readonly [string] } = {};', 0],
  ["checked object binding default", 'const { inner: { key } = { key: "a" } } = {} as { inner?: { key: string } };', 0],
  ["checked array binding default", 'const { inner: [key] = ["a"] } = {} as { inner?: readonly [string] };', 0],
  ["logical-or right operand", 'declare const prior: { key: string } | undefined; const { key } = prior || { key: "a" };', 0],
  ["nullish right operand", 'declare const prior: readonly [string] | undefined; const [key] = prior ?? ["a"];', 0],
  ["contextual arrow object parameter default", 'declare function apply(callback: (value?: { key: string }) => void): void; apply(({ key } = { key: "a" }) => { void key; });', 0],
  ["contextual arrow array parameter default", 'declare function apply(callback: (value?: readonly [string]) => void): void; apply(([key] = ["a"]) => { void key; });', 0],
  ["contextual function object parameter default", 'declare function apply(callback: (value?: { key: string }) => void): void; apply(function ({ key } = { key: "a" }) { void key; });', 0],
  ["contextual function array parameter default", 'declare function apply(callback: (value?: readonly [string]) => void): void; apply(function ([key] = ["a"]) { void key; });', 0],
  ["contextual array callback parameter default", 'declare const values: readonly { key: string }[]; values.forEach(({ key } = { key: "a" }) => { void key; });', 0],
  ["authored callback return object", 'const build: () => { key: string } = () => ({ key: "a" });', 0],
  ["authored callback return array", 'const build: () => readonly [string] = () => ["a"];', 0],
] as const;
