export const integerRemainderCases = Object.freeze([
  { name: "constant", body: "const value = 2147483647; const divisor = 97; return value % divisor;", selected: 1, args: [] },
  { name: "counted", body: "let total = 0; for (let value = 0; value < 20; value++) { total += value % 3; } return total;", selected: 1, args: [] },
  { name: "nested", body: "let total = 0; for (let value = 2; value <= 100; value++) { for (let divisor = 2; divisor * divisor <= value; divisor++) { total += value % divisor; } } return total;", selected: 1, args: [] },
  { name: "arithmetic", body: "const left = 100; const right = 7; return (left * right + 2) % (right - 1);", selected: 1, args: [] },
  { name: "branch", parameters: "flag: boolean", body: "let divisor = 2; if (flag) divisor = 3; return 17 % divisor;", selected: 1, args: [[true], [false]] },
  { name: "shadowed", body: "const value = 9; let total = 0; { const value = 8; total += value % 3; } return total + value % 3;", selected: 2, args: [] },
  { name: "unknown", parameters: "value: number", body: "return value % 3;", selected: 0, args: [[8.5], [-6], [2147483648]] },
  { name: "wide", body: "const value = 2147483648; return value % 3;", selected: 0, args: [] },
  { name: "fractional", body: "const value = 8.5; return value % 3;", selected: 0, args: [] },
  { name: "zeroDivisor", body: "const divisor = 0; const value = 7; return value % divisor;", selected: 0, args: [] },
  { name: "negativeZero", body: "const value = -0; return value % 3;", selected: 0, args: [] },
  { name: "parenthesizedNegativeZero", body: "const value = -(0); return value % 3;", selected: 0, args: [] },
  { name: "negatedDifference", parameters: "left: number, right: number", body: "const value = -(left - right); return value % 3;", selected: 0, args: [[1, 1], [2, 1]] },
  { name: "negativeRemainder", body: "const value = -6; return value % 3;", selected: 0, args: [] },
  { name: "negativeProductZero", body: "const value = -3; const zero = 0; return (value * zero) % 3;", selected: 0, args: [] },
  { name: "overflow", body: "const value = 9007199254740991; return (value + 2) % 3;", selected: 0, args: [] },
  { name: "division", body: "const value = 17; return (value / 2) % 3;", selected: 0, args: [] },
  { name: "mutated", parameters: "input: number", body: "let value = 8; value = input; return value % 3;", selected: 0, args: [[8.5]] },
  { name: "zeroBranch", parameters: "flag: boolean", body: "let divisor = 3; if (flag) divisor = 0; return 9 % divisor;", selected: 0, args: [[true], [false]] },
  { name: "carried", body: "let divisor = 3; let total = 0; for (let value = 1; value < 4; value++) { total += value % divisor; divisor--; } return total;", selected: 0, args: [] },
  { name: "initializerRestoredZero", body: "let divisor = 2; let total = 0; for (let value = (divisor = 1); value < 4; value++) { total += value % divisor; divisor = 0; } return total;", selected: 0, args: [] },
  { name: "initializerRestoredFraction", body: "let divisor = 2; let total = 0; for (let value = (divisor = 1); value < 4; value++) { total += value % divisor; divisor = 1.5; } return total;", selected: 0, args: [] },
  { name: "initializerCondition", body: "let divisor = 2; let total = 0; for (let value = (divisor = 1); value < (5 % divisor) + 3; value++) { total += value; divisor = 0; } return total;", selected: 0, args: [] },
  { name: "conditionWrites", body: "let divisor = 2; let total = 0; for (let value = (divisor = 1); value < 10 + (6 % divisor) + (divisor = 0); value++) total += value; return total;", selected: 0, args: [] },
  { name: "conditionCounterMutation", body: "let total = 0; for (let value = 0; value < ((value = 2147483648) - 2147483640); value++) total += value % 3; return total;", selected: 0, args: [] },
  { name: "initializerStable", body: "let divisor = 0; let total = 0; for (let value = (divisor = 3); value < 6; value++) { total += value % divisor; } return total;", selected: 1, args: [] },
  { name: "counterMutation", body: "let total = 0; for (let value = 1; value < 4; value++) { value += 0.5; total += value % 2; } return total;", selected: 0, args: [] },
  { name: "captured", body: "let value = 6; const mutate = () => { value = 8.5; }; mutate(); return value % 3;", selected: 0, args: [] },
  { name: "property", body: "const box = { value: 8 }; return box.value % 3;", selected: 0, args: [] },
  { name: "wrappedWrite", body: "let divisor = 3; (divisor) = 0; return 9 % divisor;", selected: 0, args: [] },
  { name: "shortCircuit", parameters: "flag: boolean", body: "let divisor = 0; flag && ((divisor = 3) > 0); return 9 % divisor;", selected: 0, args: [[false], [true]] },
  { name: "singleEvaluation", body: "let value = 8; const result = value++ % 3; return result + value;", selected: 1, args: [] },
  { name: "upperBoundary", body: "let total = 0; for (let value = 2147483646; value <= 2147483647; value++) total += value % 3; return total;", selected: 1, args: [] },
  { name: "unknownBound", parameters: "limit: number", body: "let total = 0; for (let value = 1; value <= limit; value++) total += value % 3; return total;", selected: 0, args: [[5], [5.5]] },
  { name: "mutatedBound", body: "let limit = 5; let total = 0; for (let value = 1; value < limit; value++) { total += value % 3; limit--; } return total;", selected: 0, args: [] },
  { name: "infinite", body: "const value = Number.POSITIVE_INFINITY; return value % 3;", selected: 0, args: [] },
  { name: "notANumber", body: "const value = Number.NaN; return value % 3;", selected: 0, args: [] },
].map(Object.freeze));

export const integerRemainderSource = integerRemainderCases.map(entry =>
  `export function ${entry.name}(${entry.parameters ?? ""}): number { ${entry.body} }`).join("\n");

export function integerRemainderExecutionSource() {
  const checks = integerRemainderCases.flatMap(entry => {
    const parameterNames = (entry.parameters ?? "").split(",").filter(Boolean).map(parameter => parameter.split(":")[0].trim());
    const reference = new Function(...parameterNames, entry.body);
    return (entry.args.length === 0 ? [[]] : entry.args).map(args => {
      const expected = reference(...args);
      const expression = `${entry.name}(${args.map(value => JSON.stringify(value)).join(", ")})`;
      const comparison = Number.isNaN(expected) ? `Number.isNaN(${expression})`
        : Object.is(expected, -0) ? `1 / ${expression} === Number.NEGATIVE_INFINITY` : `${expression} === ${expected}`;
      return `if (!(${comparison})) throw new Error(${JSON.stringify(entry.name)});`;
    });
  });
  return `import type { int32, float32 } from "@tsonic/core/types.js";
${integerRemainderSource}
export function integerZero(): int32 { return -0; }
export function singlePrecisionZero(): float32 { return -0; }
export function run(): boolean {
  ${checks.join("\n")}
  if (integerZero() !== 0) throw new Error("integerZero");
  if (1 / Number(singlePrecisionZero()) !== Number.NEGATIVE_INFINITY) throw new Error("singlePrecisionZero");
  return true;
}`;
}
