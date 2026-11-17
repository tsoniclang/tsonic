export const capturedCallbackAritySource = `
type Handler = (first: number, second: number, third: number) => void;
function invoke(handler: Handler): void { handler(1, 2, 7); }
function make(): () => number {
  let result = 0;
  const pending: Handler = () => { result += later; };
  const later = 3;
  invoke(pending);
  invoke(() => { result += later; });
  invoke((first, second) => { result += first + second; });
  invoke(function(first) { result += first; });
  invoke((first, second, third) => { result += first + second + third; });
  return () => result;
}
export function run(): boolean { return make()() === 20; }
`;
