import { Console } from "@tsonic/dotnet/System.js";
import { istype } from "@tsonic/core/lang.js";

class Overloads {
  Foo(value: string): string;
  Foo(value: boolean): string;
  Foo(p0: unknown): unknown {
    if (istype<string>(p0)) {
      return `s:${p0}`;
    }

    if (istype<boolean>(p0)) {
      return p0 ? "t" : "f";
    }

    throw new Error("unreachable");
  }
}

const o = new Overloads();
Console.WriteLine(o.Foo("hi"));
Console.WriteLine(o.Foo(true));
Console.WriteLine(o.Foo(false));
