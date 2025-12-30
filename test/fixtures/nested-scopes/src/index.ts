import { Console } from "@tsonic/dotnet/System";

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

Console.writeLine(`Nested scopes result: ${nestedScopes(5)}`);
Console.writeLine(`Nested scopes result: ${nestedScopes(0)}`);
