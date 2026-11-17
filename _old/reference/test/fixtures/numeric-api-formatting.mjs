const values = [
  0, -0, 1.25, -1.25, 12.5, -12.5, 0.125, 999.5, 9.999999999999998,
  Number.MIN_VALUE, 2.2250738585072014e-308, Number.MAX_VALUE,
  9007199254740992, 1e21, 1e-7, 1e-6,
];
let state = 0x123456789abcdef0n;
const bytes = new ArrayBuffer(8);
const view = new DataView(bytes);
for (let index = 0; index < 24; index++) {
  state = BigInt.asUintN(64, state * 6364136223846793005n + 1442695040888963407n);
  view.setBigUint64(0, state);
  const value = view.getFloat64(0);
  if (Number.isFinite(value)) values.push(value);
}

export const numericApiFormattingCases = values.flatMap(value =>
  [1, 3, 17, 100].flatMap(precision =>
    ["toFixed", "toExponential", "toPrecision"].map(method => ({
      expression: `(${Object.is(value, -0) ? "-0" : value.toString()}).${method}(${precision})`,
      expected: value[method](precision),
    })),
  ),
);

export const numericApiFormattingSource = `
export function numericApiFormattingFailures(): string {
  let failures = "";
${numericApiFormattingCases.map(({ expression, expected }, index) =>
  `  const formatted${index} = ${expression};\n  if (formatted${index} !== ${JSON.stringify(expected)}) failures += "${index + 1}: " + formatted${index} + "\\n";`).join("\n")}
  return failures;
}
`;
