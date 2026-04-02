import { Console } from "@tsonic/dotnet/System.js";
import type { String as DotnetString } from "@tsonic/dotnet/System.js";
import { asinterface, overloads as O } from "@tsonic/core/lang.js";

class Overloads {
  Foo(value: DotnetString): string;
  Foo(value: boolean): string;
  Foo(_value: any): any {
    throw new Error("stub");
  }

  foo_string(value: DotnetString): string {
    return `s:${value}`;
  }

  foo_boolean(value: boolean): string {
    return value ? "t" : "f";
  }
}

O<Overloads>().method(x => x.foo_string).family(x => x.Foo);
O<Overloads>().method(x => x.foo_boolean).family(x => x.Foo);

const o = new Overloads();
Console.WriteLine(o.Foo(asinterface<DotnetString>("hi")));
Console.WriteLine(o.Foo(true));
