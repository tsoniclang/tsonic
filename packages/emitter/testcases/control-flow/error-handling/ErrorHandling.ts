export function safeDivide(a: number, b: number): number {
  try {
    if (b === 0) {
      throw new Error("Division by zero");
    }
    return a / b;
  } catch (error) {
    console.log(error);
    return 0;
  } finally {
    console.log("Operation complete");
  }
}
