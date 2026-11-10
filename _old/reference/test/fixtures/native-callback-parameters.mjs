export const nativeCallbackParametersSource = `
import type { uint8 } from "@tsonic/core/types.js";
function consume(action: (value: uint8) => number): number { return action(3); }
export function run(): boolean {
  let captured = 0;
  const fractional = consume((value: number): number => {
    captured += value;
    value += 2;
    return value / 2;
  });
  const integral = consume((value): number => value / 2);
  return fractional === 2.5 && captured === 3 && integral === 1;
}
export function main(): void {
  if (!run()) throw new Error("authored and inferred native callback arithmetic");
}
`;
