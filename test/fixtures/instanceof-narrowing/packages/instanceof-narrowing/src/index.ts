import { Console } from "@tsonic/dotnet/System.js";

export class TemplateValue {}

export class BoolValue extends TemplateValue {
  public readonly value: boolean;

  constructor(value: boolean) {
    super();
    this.value = value;
  }
}

export class StrValue extends TemplateValue {
  public readonly value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }
}

// Type predicate used by predicate-guard narrowing (frontend + emitter).
export type TemplateUnion = BoolValue | StrValue;

export function isBoolValue(v: TemplateUnion): v is BoolValue {
  return v instanceof BoolValue;
}

// In-guard + predicate-guard narrowing for union shapes.
export class KindA {
  public readonly kind: string;

  constructor() {
    this.kind = "a";
  }
}

export class KindB {
  public readonly other: number;

  constructor() {
    this.other = 123;
  }
}

export type KindUnion = KindA | KindB;

export function isKindA(v: KindUnion): v is KindA {
  return "kind" in v;
}

export function main(): void {
  const a: TemplateValue = new BoolValue(true);
  const b: TemplateValue = new BoolValue(true);
  const c: TemplateValue = new StrValue("hello");

  if (a instanceof BoolValue) {
    Console.WriteLine(a.value);
  }

  if (!(c instanceof StrValue)) {
    Console.WriteLine(0);
  } else {
    Console.WriteLine(c.value.Length);
  }

  if (b instanceof BoolValue && b.value) {
    Console.WriteLine(123);
  } else {
    Console.WriteLine(456);
  }

  let m: TemplateValue = new BoolValue(false);
  if (m instanceof BoolValue) {
    Console.WriteLine(m.value);
    m = new StrValue("x");
  }

  let n: TemplateValue = new BoolValue(true);
  if (!(n instanceof BoolValue)) {
    Console.WriteLine(0);
  } else {
    Console.WriteLine(n.value);
    n = new StrValue("y");
  }

  // Shadowing + instanceof: this triggers C# CS0136 rename logic.
  // Ensure the instanceof guard uses the renamed identifier (not the outer `shadow`).
  const shadow = 42;
  {
    const shadow = new BoolValue(false);
    if (shadow instanceof BoolValue) {
      Console.WriteLine(shadow.value);
    }
  }
  Console.WriteLine(shadow);

  // Shadowing + in-guard: ensure the guard uses the renamed identifier.
  // This also tests that the narrowed binding is applied to the renamed variable.
  {
    const u = new KindA();
    Console.WriteLine(u.kind);
  }
  const u: KindUnion = new KindA();
  if ("kind" in u) {
    Console.WriteLine(u.kind);
  }

  // Shadowing + predicate-guard in an if-statement.
  {
    const pred = new KindB();
    Console.WriteLine(pred.other);
  }
  const pred: KindUnion = new KindA();
  if (isKindA(pred)) {
    Console.WriteLine(pred.kind);
  }

  // Shadowing + predicate-guard in a ternary expression.
  {
    const tv: TemplateUnion = new BoolValue(false);
    Console.WriteLine(isBoolValue(tv) ? tv.value : false);
  }
  const tv: TemplateUnion = new BoolValue(true);
  Console.WriteLine(isBoolValue(tv) ? tv.value : false);

  // Shadowing + destructuring default initializer.
  // Ensure the default expression uses the renamed identifier (not the inner `fallback`).
  {
    const fallback = "inner";
    Console.WriteLine(fallback);
  }
  const fallback = "outer";
  const arr: (string | undefined)[] = [undefined];
  const [x = fallback] = arr;
  Console.WriteLine(x);

  Console.WriteLine(888);
  Console.WriteLine(999);
}
