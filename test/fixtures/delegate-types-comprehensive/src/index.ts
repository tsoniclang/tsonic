import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Action types (void return)
function runAction(action: () => void): void {
  action();
}

function runActionWithArg(action: (x: int) => void, value: int): void {
  action(value);
}

// Func types (with return)
function applyFunc<T, R>(fn: (arg: T) => R, value: T): R {
  return fn(value);
}

function applyFunc2<T1, T2, R>(fn: (a: T1, b: T2) => R, a: T1, b: T2): R {
  return fn(a, b);
}

// Composing functions
function compose<A, B, C>(f: (a: A) => B, g: (b: B) => C): (a: A) => C {
  return (a: A): C => g(f(a));
}

export function main(): void {
  runAction((): void => Console.writeLine("Action ran"));

  runActionWithArg((x: int): void => Console.writeLine(`Got: ${x}`), 42 as int);

  const result = applyFunc((x: int): int => (x * 2) as int, 21 as int);
  Console.writeLine(`Result: ${result}`);

  const sum = applyFunc2(
    (a: int, b: int): int => (a + b) as int,
    10 as int,
    20 as int
  );
  Console.writeLine(`Sum: ${sum}`);

  const addThenDouble = compose(
    (x: int): int => (x + 10) as int,
    (x: int): int => (x * 2) as int
  );
  Console.writeLine(`Composed: ${addThenDouble(5 as int)}`);
}
