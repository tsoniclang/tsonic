import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram, validateSourceBinaryEntry } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, projectSourceFile } from "../fixtures/source-navigation.mjs";

for (const [name, text, expected] of [
  ["uncalled", "export function main(): void {}", true],
  ["direct", "export function main(): void {} main();", false],
  ["parenthesized", "export function main(): void {} (main)();", false],
  ["alias", "export function main(): void {} const start = main; start();", false],
  ["typed alias", "export function main(): void {} const start: () => void = main; start();", false],
  ["typed arrow alias", "export const main: () => void = () => {}; const start: () => void = main; start();", false],
  ["unrelated signature", "type Work = () => void; export const main: Work = () => {}; const other: Work = () => {}; other();", true],
  ["changed alias", "export function main(): void {} let start: () => void = main; start = () => {}; start();", true],
  ["inferred changed alias", "export function main(): void {} let start = main; start = () => {}; start();", true],
  ["renamed export", "function start(): void {} export { start as main }; start();", false],
  ["renamed uncalled export", "function start(): void {} export { start as main };", true],
  ["arrow", "export const main = (): void => {}; main();", false],
  ["uncalled arrow", "export const main = (): void => {};", true],
  ["overload", "export function main(): void; export function main(value?: number): void {} main();", false],
  ["shadow", "export function main(): void {} function run(): void { function main(): void {} main(); } run();", true],
  ["member", "export function main(): void {} const other = { main(): void {} }; other.main();", true],
  ["top level", "export const result = 40 + 2;", false],
  ["noncallable main", "export const main = 42;", false],
]) {
  test(`binary entry ${name} uses checked export and call identity`, async () => {
    const checked = await checkedSource(`binary-entry-${name.replaceAll(" ", "-")}`, { "src/index.ts": text });
    assert.equal(checked.diagnostics.filter(diagnostic => diagnostic !== undefined && diagnostic.category === "error").length, 0);
    const source = createTargetSourceProgram(checked);
    const issues = validateSourceBinaryEntry(source, projectSourceFile(checked, "src/index.ts"));
    assert.equal(issues.length, expected ? 1 : 0);
    assert.equal(Object.isFrozen(issues), true);
    if (expected) {
      assert.equal(issues[0].code, "TSONIC_UNCALLED_BINARY_ENTRY_MAIN");
      assert.equal(issues[0].node !== undefined, true);
    }
  });
}

test("binary entry calls retain exact imported and re-exported declaration identities", async () => {
  const checked = await checkedSource("binary-entry-import", {
    "src/index.ts": 'import "./uncalled.js"; import { start } from "./body.js"; export { start as main } from "./body.js"; start();',
    "src/body.ts": "export function start(): void {}",
    "src/uncalled.ts": "export function main(): void {}",
  });
  const source = createTargetSourceProgram(checked);
  assert.equal(validateSourceBinaryEntry(source, projectSourceFile(checked, "src/index.ts")).length, 0);
  assert.equal(validateSourceBinaryEntry(source, projectSourceFile(checked, "src/uncalled.ts")).length, 1);
});
