// Tuple cast exemption: explicit casts allow int→double
// These should all PASS because explicit casts indicate user intent

function acceptPoint(point: [number, number]): number {
  return 0.0;
}

// Tuple with explicit cast for first element, double literal for second
const r1 = acceptPoint([1 as number, 2.0]);

// Tuple with both elements having explicit casts
const r2 = acceptPoint([3 as number, 4 as number]);

// Tuple with all double literals
const r3 = acceptPoint([5.0, 6.0]);

export function main(): number {
  return 0.0;
}
