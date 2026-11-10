export const explicitErrorStackSource = `
class Failure extends Error { constructor() { super("failure"); } }
function expect(value: boolean): void { if (!value) throw new Error("explicit stack contract"); }
export function run(): boolean {
  const error = new Error("failure");
  const alias = error;
  expect(error.stack === undefined && alias.stack === undefined);
  Error.captureStackTrace(alias);
  expect(error.stack !== undefined && alias.stack === error.stack);
  const previous = error.stack;
  Error.captureStackTrace(error);
  expect(error.stack !== undefined && alias.stack === error.stack);
  const derived = new Failure();
  const derivedAlias = derived;
  expect(derived.stack === undefined);
  Error.captureStackTrace(derivedAlias);
  expect(derived.stack !== undefined && derived.stack === derivedAlias.stack);
  const other = new Error("failure");
  try { throw derived; } catch (caught) {
    expect(caught !== error && error !== caught && caught === derived && derived === caught);
  }
  try { throw error; } catch (caught) {
    expect(caught === error && error === caught && caught !== other && other !== caught);
    try { throw caught; } catch (again) {
      return again === error && error === again && error.stack !== undefined && previous !== undefined;
    }
  }
}
`;

export const invalidErrorStackSources = Object.freeze([
  "Error.captureStackTrace();",
  "Error.captureStackTrace(1);",
  "Error.captureStackTrace(undefined);",
  "Error.captureStackTrace(new Error(), new Error());",
]);
