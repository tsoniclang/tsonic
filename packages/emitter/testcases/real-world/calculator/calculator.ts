export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error("Division by zero");
    }
    return a / b;
  }
}

export function runCalculatorTests(): void {
  const calc = new Calculator();

  console.log("5 + 3 =", calc.add(5, 3));
  console.log("10 - 4 =", calc.subtract(10, 4));
  console.log("6 * 7 =", calc.multiply(6, 7));
  console.log("20 / 5 =", calc.divide(20, 5));
}
