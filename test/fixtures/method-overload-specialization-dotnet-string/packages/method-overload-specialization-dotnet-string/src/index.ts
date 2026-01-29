import { Console } from "@tsonic/dotnet/System.js";
import type { String as DotnetString } from "@tsonic/dotnet/System.js";
import { isType } from "@tsonic/core/lang.js";

class Overloads {
  Foo(value: DotnetString): string;
  Foo(value: boolean): string;
  Foo(p0: unknown): unknown {
    if (isType<string>(p0)) {
      return `s:${p0}`;
    }

    if (isType<boolean>(p0)) {
      return p0 ? "t" : "f";
    }

    throw new Error("unreachable");
  }
}

const o = new Overloads();
Console.WriteLine(o.Foo("hi" as unknown as DotnetString));
Console.WriteLine(o.Foo(true));
