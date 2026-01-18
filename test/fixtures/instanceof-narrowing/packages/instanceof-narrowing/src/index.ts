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

  Console.WriteLine(888);
  Console.WriteLine(999);
}
