import { Console } from "@tsonic/dotnet/System.js";
import { istype } from "@tsonic/core/lang.js";

class X {}
class Y {}
class P {}
class Q {}

class Overloads {
  Foo(a: X, b: Y): string;
  Foo(a: P, b: Q): string;
  Foo(p0: unknown, p1: unknown): unknown {
    if (istype<X>(p0) && istype<Y>(p1)) {
      return "xy";
    }

    if (istype<P>(p0) && istype<Q>(p1)) {
      return "pq";
    }

    throw new Error("unreachable");
  }
}

const o = new Overloads();
Console.WriteLine(o.Foo(new X(), new Y()));
Console.WriteLine(o.Foo(new P(), new Q()));
