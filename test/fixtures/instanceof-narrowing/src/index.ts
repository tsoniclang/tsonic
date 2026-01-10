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
    Console.writeLine(a.value);
  }

  if (!(c instanceof StrValue)) {
    Console.writeLine(0);
  } else {
    Console.writeLine(c.value.length);
  }

  if (b instanceof BoolValue && b.value) {
    Console.writeLine(123);
  } else {
    Console.writeLine(456);
  }

  let m: TemplateValue = new BoolValue(false);
  if (m instanceof BoolValue) {
    Console.writeLine(m.value);
    m = new StrValue("x");
  }

  let n: TemplateValue = new BoolValue(true);
  if (!(n instanceof BoolValue)) {
    Console.writeLine(0);
  } else {
    Console.writeLine(n.value);
    n = new StrValue("y");
  }

  Console.writeLine(888);
  Console.writeLine(999);
}
