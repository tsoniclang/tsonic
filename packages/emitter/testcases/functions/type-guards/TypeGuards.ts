export interface Dog {
  type: "dog";
  bark(): void;
}

export interface Cat {
  type: "cat";
  meow(): void;
}

export type Animal = Dog | Cat;

// Type guard function with 'is' predicate
export function isDog(animal: Animal): animal is Dog {
  return animal.type === "dog";
}

export function isCat(animal: Animal): animal is Cat {
  return animal.type === "cat";
}

// Using type guards
export function makeSound(animal: Animal): void {
  if (isDog(animal)) {
    animal.bark();
  } else if (isCat(animal)) {
    animal.meow();
  }
}

// typeof type guard
export function processValue(value: string | number): string {
  if (typeof value === "string") {
    return value.toUpperCase();
  }
  return value.toString();
}

// instanceof type guard
export class Circle {
  radius: number;
  constructor(radius: number) {
    this.radius = radius;
  }
}

export function getArea(shape: Circle | number): number {
  if (shape instanceof Circle) {
    return Math.PI * shape.radius * shape.radius;
  }
  return shape;
}
