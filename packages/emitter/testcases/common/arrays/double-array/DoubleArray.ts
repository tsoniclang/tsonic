// Test that number[] correctly emits as double[]
// This guards against regression where integer literals might incorrectly emit as int[]
// Key invariant: number[] MUST emit double[] even when elements are integer literals
export function createDoubleArray(): number[] {
  const arr: number[] = [1, 2, 3];  // Integer literals, but number[] annotation → double[]
  return arr;
}

export function returnDoubleArray(): number[] {
  return [4, 5, 6];  // Return type provides context → double[]
}
