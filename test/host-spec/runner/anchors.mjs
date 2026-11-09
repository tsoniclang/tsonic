import assert from "node:assert/strict";

/**
 * @template Record
 * @param {readonly Record[]} records
 * @param {(record: Record) => boolean} matches
 * @param {string} label
 * @returns {Record}
 */
export function uniqueAnchor(records, matches, label) {
  let count = 0;
  /** @type {{record: Record} | undefined} */
  let selected;
  for (const record of records) {
    if (matches(record)) {
      count += 1;
      selected = { record };
    }
  }
  if (selected === undefined || count !== 1) {
    assert.fail(`${label}: expected exactly one anchor; found ${count}`);
  }
  return selected.record;
}
