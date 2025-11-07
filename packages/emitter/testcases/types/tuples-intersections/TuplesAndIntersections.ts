// Tuple types
export type Point2D = [number, number];
export type Point3D = [number, number, number];
export type NamedPoint = [x: number, y: number];

// Variadic tuples
export type Coords = [...number[]];
export type StringWithNumbers = [string, ...number[]];

// Intersection types
export interface Named {
  name: string;
}

export interface Aged {
  age: number;
}

export type Person = Named & Aged;

// Complex intersection
export interface Serializable {
  toJSON(): string;
}

export type SerializablePerson = Person & Serializable;

// Functions using tuples
export function distance(point: Point2D): number {
  const [x, y] = point;
  return Math.sqrt(x * x + y * y);
}

export function createPoint(x: number, y: number): Point2D {
  return [x, y];
}

// Function using intersection
export function greetPerson(person: Person): string {
  return `${person.name} is ${person.age} years old`;
}

// Rest elements with tuples
export function sum(...nums: [...number[]]): number {
  return nums.reduce((a, b) => a + b, 0);
}
