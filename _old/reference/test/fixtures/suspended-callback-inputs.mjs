export const suspendedCallbackInputsSource = `
export async function sum(left: () => Promise<number>, right: () => Promise<number>): Promise<number> {
  return await left() + await right();
}
class Reader {
  async sum(left: () => Promise<number>, right: () => Promise<number>): Promise<number> {
    return await left() + await right();
  }
}
export async function main(): Promise<void> {
  let reads = 0;
  const left = async (): Promise<number> => { reads += 1; return reads; };
  const right = async (): Promise<number> => { reads += 1; return reads; };
  const first = await sum(left, right);
  const second = await new Reader().sum(left, right);
  const third = await sum(right, left);
  if (first !== 3 || second !== 7 || third !== 11 || reads !== 6) throw new Error("native input loans");
}
`;
