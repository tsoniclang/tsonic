const callbackCompletionBody = `
type Handler = () => Outcome;
function invoke(callback: Handler): Outcome { return callback(); }
export function run(): boolean {
  let calls = 0;
  const empty = invoke(() => { calls++; });
  const early = invoke(() => { calls++; return; });
  const fallback = invoke(() => { calls++; if (calls < 0) return "unreachable"; });
  const present = invoke(() => { calls++; return "present"; });
  const read = (value: Outcome): Outcome => { calls++; return value; };
  const initialCountMatches = calls === 4;
  const emptyMatches = undefined === read(empty);
  const earlyMatches = null === read(early);
  const fallbackMatches = read(fallback) !== "present";
  const finalCountMatches = calls === 7;
  return initialCountMatches && empty === undefined && empty === null &&
    early === undefined && fallback === undefined && present === "present" &&
    emptyMatches && earlyMatches && fallbackMatches && finalCountMatches;
}
`;

export const closedUnionCallbackCompletionSource =
  "type Outcome = void | string | Promise<void>;\n" + callbackCompletionBody;

export const closedUnionValueCallbackCompletionSource =
  "class Later {}\ntype Outcome = void | string | Later;\n" + callbackCompletionBody;
