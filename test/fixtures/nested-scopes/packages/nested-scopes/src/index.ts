import { Console } from "@tsonic/dotnet/System.js";

function nestedScopes(x: number): number {
  const a = 10;
  {
    const b = 20;
    {
      const c = 30;
      return a + b + c + x;
    }
  }
}

Console.WriteLine(`Nested scopes result: ${nestedScopes(5)}`);
Console.WriteLine(`Nested scopes result: ${nestedScopes(0)}`);
