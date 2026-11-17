export const closedNativeAbsenceGuardPolicySource = `
function equal(value: unknown): void { if (value === undefined) return; }
function different(value: unknown): void { if (value !== undefined) return; }
function reverseEqual(value: unknown): void { if (null === value) return; }
function reverseDifferent(value: unknown): void { if (null !== value) return; }
`;

export const closedNativeAbsenceGuardSource = `
type Failure = { value: unknown };
interface Control { ended: boolean; error?: Failure; }
let effects = 0;
function invoke(currentError: Failure | undefined): Control {
  let error = currentError;
  if (error === undefined) { effects++; return { ended: true }; }
  return { ended: false, error };
}
function pipeline(): boolean {
  let currentError: Failure | undefined;
  const control = invoke(currentError);
  currentError = control.error;
  if (currentError !== undefined) return false;
  return control.ended;
}
function inspect(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value === "number") return value === 7;
  if (typeof value === "string") return value === "kept";
  if (typeof value === "boolean") return value === false;
  return false;
}
function present(): boolean {
  const control = invoke({ value: 7 });
  if (control.error === undefined) return false;
  return !control.ended && control.error.value === 7;
}
export function run(): boolean {
  return pipeline() && effects === 1 && present() && inspect(undefined) && inspect(null) &&
    inspect(7) && !inspect(8) && inspect("kept") && !inspect("other") && inspect(false) && !inspect(true);
}
export function main(): void { if (!run()) throw new Error("closed native absence guards"); }
`;
