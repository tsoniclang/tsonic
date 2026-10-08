export const optionalInvocationInputsSource = `
import type { int32, int64 } from "@tsonic/core/types.js";

let evaluations: int32 = 0;

function evaluationCount(): int32 {
  return evaluations;
}

function integerArgument(): int64 {
  evaluations += 1;
  return 9007199254740993n;
}

function stringArgument(): string {
  evaluations += 1;
  return "native";
}

function invoke(action: ((value: int64) => int64) | null): int64 | null {
  return action?.(integerArgument()) ?? null;
}

function borrowed(action: ((value: string) => boolean) | undefined): boolean | undefined {
  return action?.(stringArgument());
}

export function run(): boolean {
  const absentInteger = invoke(null);
  if (absentInteger !== null || evaluationCount() !== 0) return false;
  const integer = invoke((value: int64): int64 => value);
  if (integer !== 9007199254740993n || evaluationCount() !== 1) return false;
  if (borrowed(undefined) !== undefined || evaluationCount() !== 1) return false;
  const string = borrowed((value: string): boolean => value === "native");
  return string === true && evaluationCount() === 2;
}
`;
