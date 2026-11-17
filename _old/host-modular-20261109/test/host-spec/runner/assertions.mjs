import assert from "node:assert/strict";

/**
 * @param {import("./contracts.d.mts").SpecScalar} actual
 * @param {import("./contracts.d.mts").SpecScalar} expected
 * @param {string} label
 */
export function scalarEqual(actual, expected, label) {
  assert.equal(Object.is(actual, expected), true, label);
}

/**
 * @template Value
 * @param {Value} actual
 * @param {Value} expected
 * @param {string} label
 */
export function sameIdentity(actual, expected, label) {
  assert.equal(Object.is(actual, expected), true, label);
}

/**
 * @template Value
 * @param {readonly Value[]} actual
 * @param {readonly Value[]} expected
 * @param {(actual: Value, expected: Value) => boolean} equal
 * @param {string} label
 */
export function orderedDomain(actual, expected, equal, label) {
  scalarEqual(actual.length, expected.length, `${label}: cardinality`);
  for (let index = 0; index < expected.length; index += 1) {
    assert.equal(Object.hasOwn(actual, index), true, `${label}: actual slot ${index}`);
    assert.equal(Object.hasOwn(expected, index), true, `${label}: expected slot ${index}`);
    assert.equal(equal(actual[index], expected[index]), true, `${label}: slot ${index}`);
  }
}
