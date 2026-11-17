export const contextualAsyncCompletionSource = `
class Answer {
  value: number;
  constructor(value: number) { this.value = value; }
}
type Handler = () => void | Answer | Promise<void | Answer>;
async function ready(): Promise<void> { return; }
function make(present: boolean): Handler {
  return async () => {
    await ready();
    if (present) return new Answer(7);
    return;
  };
}
function missing(): Handler {
  return async () => { await ready(); return undefined; };
}
export async function run(): Promise<boolean> {
  const absent = await make(false)();
  const present = await make(true)();
  const missingValue = await missing()();
  return absent === undefined && missingValue === undefined && present instanceof Answer && present.value === 7;
}
`;
