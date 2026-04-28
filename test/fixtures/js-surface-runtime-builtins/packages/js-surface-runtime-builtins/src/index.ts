export function main(): void {
  const value = "  hello,world  ".trim();
  const upper: string = value.toUpperCase();
  const parsed = JSON.parse<{ value: number }>('{"value":42}');
  const now = new Date();
  const rounded = Math.round(3.6);
  const regex = new RegExp("HELLO");
  const matched = regex.test(upper);
  const regexLiteral = /^[A-Z, ]+$/;
  const matchedLiteral = regexLiteral.test(upper);
  const map = new Map<string, number>();
  map.set("value", rounded);
  const set = new Set<string>();
  set.add(upper);
  const p = parseInt("123");
  const nums = [1, 2, 3, 4];
  nums.push(5);
  const spreadCopy = [...nums, 6];
  const chars = Array.from("abcd");
  const more = Array.of(6, 7, 8);
  const joinedNumber = rounded.toString();
  const error = new Error("core");
  const rangeError = new RangeError("range");
  const doubled = nums.map((x) => x * 2);
  const filtered = doubled.filter((x) => x > 2);
  const total = filtered.reduce((a, b) => a + b, 0);
  const totalFromRight = filtered.reduceRight((a, b) => a + b, 0);
  const joined = filtered.join(",");
  const joinedDefault = filtered.join();

  console.log(...spreadCopy);
  console.log(
    upper,
    parsed.value,
    now.toISOString(),
    matched,
    matchedLiteral,
    map.get("value"),
    set.has(upper),
    p,
    chars.join("-"),
    more.join("-"),
    spreadCopy.join("-"),
    joinedNumber,
    error.message,
    rangeError.message,
    nums.length,
    joined,
    joinedDefault,
    total,
    totalFromRight
  );
}
