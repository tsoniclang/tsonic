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
  runAction(() => Console.WriteLine("Action ran"));

  runActionWithArg((x) => Console.WriteLine(`Got: ${x}`), 42);

  const result = applyFunc((x) => x * 2, 21);
  Console.WriteLine(`Result: ${result}`);

  const sum = applyFunc2((a, b) => a + b, 10, 20);
  Console.WriteLine(`Sum: ${sum}`);

  const addThenDouble = compose(
    (x: int) => x + 10,
    (x) => x * 2
  );
  Console.WriteLine(`Composed: ${addThenDouble(5)}`);
}
