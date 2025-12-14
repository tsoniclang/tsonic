// Cast exemption: explicit 'as number' allows int→double
// These should all PASS because explicit casts indicate user intent

function acceptDouble(x: number): number {
  return x * 2.0;
}

// Variable initialization with explicit cast
const x: number = 42 as number;

// Function call with explicit cast
const result: number = acceptDouble(42 as number);

// Double literal (42.0) is also allowed
const y: number = 42.0;

export function main(): number {
  return x;
}
