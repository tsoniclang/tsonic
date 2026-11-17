export const capturedLiteralFlowSource = `
function select(value: string | Error | undefined): string {
  let control: string | Error | undefined;
  const change = (next: string | Error | undefined): void => { control = next; };
  change(value);
  if (control === "route" || control === "router") return control;
  return "other";
}
export function run(): boolean {
  return select("route") === "route" && select("router") === "router" &&
    select("unknown") === "other" && select(undefined) === "other" &&
    select(new Error("failed")) === "other" && initialized("route").control === "route" &&
    initialized("router").control === "router" && initialized(new Error("failed")).control === undefined;
}
function initialized(value: string | Error | undefined): { control?: "route" | "router" } {
  let control: string | Error | undefined = undefined;
  const change = (next: string | Error | undefined): void => { control = next; };
  change(value);
  if (control === "route" || control === "router") return { control };
  return {};
}
`;
