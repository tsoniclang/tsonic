export const classUnionUpcastSource = `
class Base<T> {
  value: T;
  constructor(value: T) { this.value = value; }
  label(): string { return "base"; }
}
class First<T> extends Base<T> { first: boolean = true; label(): string { return "first"; } }
class Second<T> extends Base<T> { second: boolean = true; label(): string { return "second"; } }
class Third<T> extends Base<T> { third: boolean = true; label(): string { return "third"; } }
type Selected = First<number> | Second<number> | Third<number>;
let calls = 0;
function observed(value: Selected): Selected { calls++; return value; }
function accept(value: Base<number>): Base<number> { value.value += 1; return value; }
function forward(value: Selected): Base<number> { return accept(observed(value)); }
function optional(value: Base<number> | undefined): string { return value === undefined ? "absent" : value.label(); }
function optionalUnion(value: Selected): string { return optional(value); }
function returned(value: Selected): Base<number> { return value; }
export function run(): boolean {
  const first = new First<number>(1);
  const second = new Second<number>(2);
  const third = new Third<number>(3);
  calls = 0;
  const firstView = forward(first);
  const secondView = forward(second);
  const thirdView = forward(third);
  return calls === 3 && firstView === first && secondView === second && thirdView === third &&
    first.value === 2 && second.value === 3 && third.value === 4 &&
    firstView.label() === "first" && secondView.label() === "second" && thirdView.label() === "third" &&
    optionalUnion(first) === "first" && optionalUnion(second) === "second" && optionalUnion(third) === "third" &&
    optional(undefined) === "absent" && returned(first) === first;
}
`;

export const anonymousClassUnionUpcastSource = `
class Base { value: number; constructor(value: number) { this.value = value; } }
class First extends Base { first: number = 1; }
class Second extends Base { second: number = 2; }
class Third extends Base { third: number = 3; }
class Receiver { take(value: Base): Base { value.value += 1; return value; } }
let calls = 0;
function forward(receiver: Receiver, value: First | Second | Third): Base {
  calls++;
  return receiver.take(value);
}
export function run(): boolean {
  const receiver = new Receiver();
  const first = new First(1);
  const second = new Second(2);
  const third = new Third(3);
  calls = 0;
  return forward(receiver, first) === first && forward(receiver, second) === second &&
    forward(receiver, third) === third && calls === 3 &&
    first.value === 2 && second.value === 3 && third.value === 4;
}
`;
