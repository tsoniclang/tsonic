// NEGATIVE TEST: These JS built-ins should NOT compile in dotnet mode
// In dotnet mode with noLib, these types/methods don't exist

import { Console } from "System";
import { List } from "System.Collections.Generic";

export function main(): void {
  const numbers = new List<number>();
  numbers.Add(1);
  numbers.Add(2);
  numbers.Add(3);

  // ERROR: .length is a JS array property, not available on List<T> in noLib mode
  const len = numbers.length;

  // ERROR: .some() is a JS array method, not available in dotnet mode
  const hasPositive = numbers.some((x: number) => x > 0);

  // ERROR: .map() is a JS array method, not available in dotnet mode
  const doubled = numbers.map((x: number) => x * 2);

  // ERROR: .filter() is a JS array method, not available in dotnet mode
  const filtered = numbers.filter((x: number) => x > 1);

  Console.WriteLine("This should never compile");
}
