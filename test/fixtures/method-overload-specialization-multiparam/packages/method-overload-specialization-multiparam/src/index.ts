import { Console } from "@tsonic/dotnet/System.js";
import { overloads as O } from "@tsonic/core/lang.js";

class X {}
class Y {}
class P {}
class Q {}

class Overloads {
  Foo(a: X, b: Y): string;
  Foo(a: P, b: Q): string;
  Foo(_p0: any, _p1: any): any {
    throw new Error("stub");
  }

  foo_xy(_a: X, _b: Y): string {
    return "xy";
  }

  foo_pq(_a: P, _b: Q): string {
    return "pq";
  }
}

O<Overloads>()
  .method((x) => x.foo_xy)
  .family((x) => x.Foo);
O<Overloads>()
  .method((x) => x.foo_pq)
  .family((x) => x.Foo);

const o = new Overloads();
Console.WriteLine(o.Foo(new X(), new Y()));
Console.WriteLine(o.Foo(new P(), new Q()));
