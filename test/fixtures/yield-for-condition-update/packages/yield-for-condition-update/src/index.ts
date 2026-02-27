import { Console, InvalidOperationException } from "@tsonic/dotnet/System.js";

function* forConditionOnly(): Generator<number, number, boolean> {
  let i = 0;
  for (; yield i; i = i + 1) {
    if (i > 10) {
      break;
    }
  }
  return i;
}

function* forUpdateOnly(): Generator<number, number, number> {
  let i = 0;
  let count = 0;
  for (; i < 3; yield i) {
    count = count + 1;
    i = i + 1;
    if (count === 2) {
      continue;
    }
  }
  return count;
}

function* forConditionAndUpdate(): Generator<boolean, number, boolean> {
  let i = 0;
  let seen = 0;
  for (; yield i < 3; yield i < 3) {
    i = i + 1;
    if (i === 2) {
      continue;
    }
    seen = seen + 1;
  }
  return seen;
}

export function main(): void {
  const cond = forConditionOnly();
  void cond.next(false);
  void cond.next(true);
  void cond.next(true);
  void cond.next(false);

  const upd = forUpdateOnly();
  void upd.next(0);
  void upd.next(0);
  void upd.next(0);
  void upd.next(0);

  const both = forConditionAndUpdate();
  void both.next(false);
  void both.next(true);
  void both.next(false);
  void both.next(true);
  void both.next(false);
  void both.next(true);
  void both.next(false);
  const doneStep = both.next(false);
  if (!doneStep.done) {
    throw new InvalidOperationException("expected completion step b8");
  }

  Console.WriteLine("OK");
}
