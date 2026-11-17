export const nativeErrorCatchFunctionSource = `
export function invoke(callback: () => void): string {
  try { callback(); }
  catch (error) {
    const failure = error instanceof Error ? error : new Error("fallback");
    return failure.message;
  }
  return "success";
}
`;

export const nativeErrorCatchSource = `${nativeErrorCatchFunctionSource}
export function run(): boolean {
  const original = new Error("original");
  return invoke(() => { throw original; }) === "original" && invoke(() => {}) === "success";
}
`;
