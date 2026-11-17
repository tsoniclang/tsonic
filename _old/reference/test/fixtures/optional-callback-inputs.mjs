export const optionalCallbackInputsSource = `
type Control = string | Error | null | undefined;
type Next = (value?: Control) => void;
function invoke(next: Next, value?: Control): void { next(value); }
export function run(): boolean {
  let called = false;
  let control: Control = undefined;
  const next = (value?: Control): void => { called = true; control = value; };
  invoke(next);
  if (!called || control !== undefined) return false;
  const original = new Error("native identity");
  invoke(next, original);
  if (control !== original) return false;
  invoke(next, "route");
  if (control !== "route") return false;
  invoke(next, null);
  if (control !== undefined) return false;
  invoke(next, undefined);
  return control === undefined;
}
`;

export const optionalAsyncCallbackInputsSource = `
type Control = string | Error | null | undefined;
type Next = (value?: Control) => void | Promise<void>;
async function invoke(next: Next, value?: Control): Promise<void> { await next(value); }
export async function run(): Promise<boolean> {
  let called = false;
  let control: Control = undefined;
  const next = (value?: Control): Promise<void> => {
    called = true;
    control = value;
    return Promise.resolve(undefined);
  };
  await invoke(next);
  if (!called || control !== undefined) return false;
  const original = new Error("native identity");
  await invoke(next, original);
  if (control !== original) return false;
  await invoke(next, "route");
  if (control !== "route") return false;
  await invoke(next, null);
  if (control !== undefined) return false;
  await invoke(next, undefined);
  return control === undefined;
}
`;
