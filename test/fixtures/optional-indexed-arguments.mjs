export const optionalIndexedArgumentsSource = `
let reads = 0;
function index(value: number): number { reads++; return value; }
function accept(value: string | undefined): string { return value === undefined ? "absent" : value; }
function optional(value?: string): string { return accept(value); }
function defaulted(value: string = "default"): string { return value; }
function required(value: string): string { return value; }
class Data { values: string[] = ["first"]; }
class Receiver { accept(value: string | undefined): string { return accept(value); } }
export function run(): boolean {
  const data = new Data();
  const receiver = new Receiver();
  reads = 0;
  const present = accept(data.values[index(0)]);
  const missing = accept(data.values[index(9)]);
  return present === "first" && missing === "absent" && reads === 2 &&
    accept((data.values[0])) === "first" && accept((data.values[9])) === "absent" &&
    accept(data.values[9] satisfies string) === "absent" &&
    optional(data.values[0]) === "first" && optional(data.values[9]) === "absent" &&
    defaulted(data.values[0]) === "first" && defaulted(data.values[9]) === "default" &&
    receiver.accept(data.values[0]) === "first" && receiver.accept(data.values[9]) === "absent" &&
    required(data.values[0]) === "first";
}
`;
