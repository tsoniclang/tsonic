const m = "  hi  ".trim().toUpperCase();
const hasNeedle = m.includes("H");
const nums = [1, 2, 3, 4];
const doubled = nums.map((x) => x * 2);
const filtered = doubled.filter((x) => x > 2);
const total = filtered.reduce((a, b) => a + b, 0);
console.log(hasNeedle);
console.log(nums.length, doubled.join(","), total, m);
export const ok = parseInt("42");
