import { Console } from "@tsonic/dotnet/System.js";
import { isType } from "@tsonic/core/lang.js";

class X {}
class Y {}
class P {}
class Q {}

class Overloads {
  Foo(a: X, b: Y): string;
  Foo(a: P, b: Q): string;
  Foo(p0: unknown, p1: unknown): unknown {
    if (isType<X>(p0) && isType<Y>(p1)) {
      return "xy";
    }

    if (isType<P>(p0) && isType<Q>(p1)) {
      return "pq";
    }

    throw new Error("unreachable");
  }
}

const o = new Overloads();
Console.WriteLine(o.Foo(new X(), new Y()));
Console.WriteLine(o.Foo(new P(), new Q()));
