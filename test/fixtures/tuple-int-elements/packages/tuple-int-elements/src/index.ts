// TSN5110: Tuple with int literals where number (double) elements expected
// This should fail because 1 and 2 are integer literals being assigned
// to a tuple type [number, number] which requires doubles.

function acceptPoint(point: [number, number]): number {
  return 0.0;
}

// The tuple literal [1, 2] should fail TSN5110 when passed to function expecting [number, number]
export function main(): number {
  return acceptPoint([1, 2]);
}
