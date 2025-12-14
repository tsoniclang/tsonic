// TSN5110: Ternary branch with int literal where number expected
// This should fail because '1' is an integer literal without explicit widening
// while 2.0 is a double literal. The overall expected type is number (double).

const cond = true;

// One branch is int (1), other is double (2.0) - int branch needs explicit cast
const x: number = cond ? 1 : 2.0;

export function main(): number {
  return x;
}
