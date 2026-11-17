export const rejectedErrorFlowSource = `
async function fail(): Promise<void> { throw new Error("failed"); }
export async function run(): Promise<boolean> {
  let observed = false;
  await fail().catch(error => {
    const selected = error instanceof Error ? error : new Error("unknown");
    observed = selected.message === "failed";
  });
  return observed;
}
`;
