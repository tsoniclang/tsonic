import { Console } from "@tsonic/dotnet/System.js";

type Shape =
  | { kind: "square"; side: number }
  | { kind: "circle"; radius: number };

function describe(s: Shape): string {
  if (s.kind === "circle") {
    return "C:" + s.radius * s.radius;
  }
  // Post-if narrowing: if-then returns, remainder is the other union member.
  return "S:" + s.side * s.side;
}

function describe2(s: Shape): string {
  if (s.kind !== "circle") {
    return "S2:" + s.side * s.side;
  } else {
    return "C2:" + s.radius * s.radius;
  }
}

type Result = { ok: true; value: number } | { ok: false; error: string };

function unwrap(r: Result): string {
  if (r.ok === true) {
    return "V:" + r.value;
  }
  return "E:" + r.error;
}

function tern(s: Shape): number {
  // Ternary narrowing (positive)
  return s.kind === "circle" ? s.radius : 0;
}

function tern2(s: Shape): number {
  // Ternary narrowing (negative)
  return s.kind !== "circle" ? 0 : s.radius;
}

export function main(): void {
  Console.WriteLine(describe({ kind: "circle", radius: 2 }));
  Console.WriteLine(describe({ kind: "square", side: 3 }));
  Console.WriteLine(describe2({ kind: "square", side: 4 }));
  Console.WriteLine(describe2({ kind: "circle", radius: 5 }));
  Console.WriteLine(unwrap({ ok: true, value: 7 }));
  Console.WriteLine(unwrap({ ok: false, error: "oops" }));
  Console.WriteLine("T:" + tern({ kind: "circle", radius: 6 }));
  Console.WriteLine("T2:" + tern2({ kind: "circle", radius: 7 }));
}
