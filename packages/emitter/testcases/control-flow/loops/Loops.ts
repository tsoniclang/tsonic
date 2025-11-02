export function sumEven(numbers: number[]): number {
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] % 2 !== 0) {
      continue;
    }
    sum += numbers[i];
  }
  return sum;
}

export function findFirst(numbers: number[], target: number): number {
  let i = 0;
  while (i < numbers.length) {
    if (numbers[i] === target) {
      break;
    }
    i++;
  }
  return i;
}
