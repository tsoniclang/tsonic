export function compareCaseValues(actual, expected) {
  if (!closedValue(actual) || !closedValue(expected)) return false;
  const pending = [[actual, expected]];
  while (pending.length > 0) {
    const [actual, expected] = pending.pop();
    if (Object.is(actual, expected)) continue;
    if (typeof actual !== typeof expected || actual === null || expected === null || typeof actual !== "object") return false;
    if (Array.isArray(actual) !== Array.isArray(expected)) return false;
    const left = Object.keys(actual).sort();
    const right = Object.keys(expected).sort();
    if (left.length !== right.length || left.some((key, index) => key !== right[index])) return false;
    if (Array.isArray(actual) && actual.length !== expected.length) return false;
    for (const key of left) pending.push([actual[key], expected[key]]);
  }
  return true;
}

function closedValue(root) {
  const active = new Set();
  const pending = [{ value: root, exit: false }];
  while (pending.length > 0) {
    const { value, exit } = pending.pop();
    if (exit) { active.delete(value); continue; }
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "bigint") continue;
    if (typeof value === "number") { if (!Number.isFinite(value)) return false; continue; }
    if (typeof value !== "object" || active.has(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(value).filter(key => key !== "length" || !Array.isArray(value));
    if (keys.some(key => typeof key !== "string")) return false;
    if (Array.isArray(value) && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) return false;
    active.add(value);
    pending.push({ value, exit: true });
    for (const key of keys) {
      const property = Object.getOwnPropertyDescriptor(value, key);
      if (property === undefined || !Object.hasOwn(property, "value") || !property.enumerable) return false;
      pending.push({ value: property.value, exit: false });
    }
  }
  return true;
}
