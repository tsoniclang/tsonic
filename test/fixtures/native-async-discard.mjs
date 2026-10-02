export function nativeAsyncDiscardSource(expectedExecutions) {
  return `
let executions = 0;
let argumentsSeen = 0;
function argument(): number { argumentsSeen++; return 7; }
async function produce(value: number): Promise<number> { executions++; return value; }
export async function run(): Promise<boolean> {
  executions = 0;
  argumentsSeen = 0;
  produce(argument());
  (produce(argument()));
  void produce(argument());
  const retained = produce(argument());
  void (retained);
  const category = typeof retained;
  const value = await retained;
  for (let index = 0; index < 2; produce(argument()), index++) {}
  return value === 7 && category === "object" && argumentsSeen === 6 && executions === ${expectedExecutions};
}
`;
}
