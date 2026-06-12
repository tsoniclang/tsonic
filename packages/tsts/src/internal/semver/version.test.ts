import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TryParseVersion,
  Version_Compare,
  Version_String,
  comparisonEqualTo,
  comparisonGreaterThan,
  comparisonLessThan,
} from "./version.js";
import type { Version } from "./version.js";

function assertVersion(actual: Version, expected: Version): void {
  assert.equal(actual.major, expected.major);
  assert.equal(actual.minor, expected.minor);
  assert.equal(actual.patch, expected.patch);
  assert.deepEqual(actual.prerelease, expected.prerelease);
  assert.deepEqual(actual.build, expected.build);
}

function parseVersion(text: string): Version {
  const [version, error] = TryParseVersion(text);
  assert.equal(error, undefined, text);
  return version;
}

test("TryParseVersion mirrors upstream parse cases", () => {
  const cases: Array<{ input: string; expected: Version }> = [
    { input: "1.2.3-pre.4+build.5", expected: { major: 1, minor: 2, patch: 3, prerelease: ["pre", "4"], build: ["build", "5"] } },
    { input: "1.2.3-pre.4", expected: { major: 1, minor: 2, patch: 3, prerelease: ["pre", "4"], build: [] } },
    { input: "1.2.3+build.4", expected: { major: 1, minor: 2, patch: 3, prerelease: [], build: ["build", "4"] } },
    { input: "1.2.3", expected: { major: 1, minor: 2, patch: 3, prerelease: [], build: [] } },
  ];

  for (const testCase of cases) {
    assertVersion(parseVersion(testCase.input), testCase.expected);
  }
});

test("Version_String mirrors upstream cases", () => {
  const cases: Array<{ input: Version; expected: string }> = [
    { input: { major: 1, minor: 2, patch: 3, prerelease: ["pre", "4"], build: ["build", "5"] }, expected: "1.2.3-pre.4+build.5" },
    { input: { major: 1, minor: 2, patch: 3, prerelease: ["pre", "4"], build: ["build"] }, expected: "1.2.3-pre.4+build" },
    { input: { major: 1, minor: 2, patch: 3, prerelease: [], build: ["build"] }, expected: "1.2.3+build" },
    { input: { major: 1, minor: 2, patch: 3, prerelease: ["pre", "4"], build: [] }, expected: "1.2.3-pre.4" },
    { input: { major: 1, minor: 2, patch: 3, prerelease: [], build: ["build", "4"] }, expected: "1.2.3+build.4" },
    { input: { major: 1, minor: 2, patch: 3, prerelease: [], build: [] }, expected: "1.2.3" },
  ];

  for (const testCase of cases) {
    assert.equal(Version_String(testCase.input), testCase.expected);
  }
});

test("Version_Compare mirrors upstream precedence cases", () => {
  const cases = [
    ["1.0.0", "2.0.0", comparisonLessThan],
    ["1.0.0", "1.1.0", comparisonLessThan],
    ["1.0.0", "1.0.1", comparisonLessThan],
    ["2.0.0", "1.0.0", comparisonGreaterThan],
    ["1.1.0", "1.0.0", comparisonGreaterThan],
    ["1.0.1", "1.0.0", comparisonGreaterThan],
    ["1.0.0", "1.0.0", comparisonEqualTo],
    ["1.0.0", "1.0.0-pre", comparisonGreaterThan],
    ["1.0.1-pre", "1.0.0", comparisonGreaterThan],
    ["1.0.0-pre", "1.0.0", comparisonLessThan],
    ["1.0.0-0", "1.0.0-1", comparisonLessThan],
    ["1.0.0-1", "1.0.0-0", comparisonGreaterThan],
    ["1.0.0-2", "1.0.0-10", comparisonLessThan],
    ["1.0.0-10", "1.0.0-2", comparisonGreaterThan],
    ["1.0.0-0", "1.0.0-0", comparisonEqualTo],
    ["1.0.0-a", "1.0.0-b", comparisonLessThan],
    ["1.0.0-a-2", "1.0.0-a-10", comparisonGreaterThan],
    ["1.0.0-b", "1.0.0-a", comparisonGreaterThan],
    ["1.0.0-a", "1.0.0-a", comparisonEqualTo],
    ["1.0.0-A", "1.0.0-a", comparisonLessThan],
    ["1.0.0-0", "1.0.0-alpha", comparisonLessThan],
    ["1.0.0-alpha", "1.0.0-0", comparisonGreaterThan],
    ["1.0.0-alpha", "1.0.0-alpha", comparisonEqualTo],
    ["1.0.0-alpha", "1.0.0-alpha.0", comparisonLessThan],
    ["1.0.0-alpha.0", "1.0.0-alpha", comparisonGreaterThan],
    ["1.0.0-a.0.b.1", "1.0.0-a.0.b.2", comparisonLessThan],
    ["1.0.0-a.0.b.1", "1.0.0-b.0.a.1", comparisonLessThan],
    ["1.0.0-a.0.b.2", "1.0.0-a.0.b.1", comparisonGreaterThan],
    ["1.0.0-b.0.a.1", "1.0.0-a.0.b.1", comparisonGreaterThan],
    ["1.0.0+build", "1.0.0", comparisonEqualTo],
    ["1.0.0+build.stuff", "1.0.0", comparisonEqualTo],
    ["1.0.0", "1.0.0+build", comparisonEqualTo],
    ["1.0.0+build", "1.0.0+stuff", comparisonEqualTo],
    ["1.0.0-alpha.99999", "1.0.0-alpha.100000", comparisonLessThan],
    ["1.0.0-alpha.beta", "1.0.0-alpha.alpha", comparisonGreaterThan],
  ] as const;

  for (const [left, right, expected] of cases) {
    assert.equal(Version_Compare(parseVersion(left), parseVersion(right)), expected, `${left} <=> ${right}`);
  }
});
