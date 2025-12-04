// Basic tuple types
export type Point2D = [number, number];
export type Point3D = [number, number, number];
export type NamedPoint = [x: number, y: number];
export type StringPair = [string, string];
export type MixedTuple = [string, number, boolean];

// Pure variadic tuple (converts to array)
export type NumberArray = [...number[]];

// Functions returning tuples
export function createPoint(x: number, y: number): Point2D {
  return [x, y];
}

export function create3DPoint(x: number, y: number, z: number): Point3D {
  return [x, y, z];
}

export function createMixed(): MixedTuple {
  return ["hello", 42, true];
}

// Function taking tuple parameter
export function distance(point: Point2D): number {
  const [x, y] = point;
  return Math.sqrt(x * x + y * y);
}

// Tuple in generic context
export interface Container<T> {
  value: T;
}

export function wrapPoint(point: Point2D): Container<Point2D> {
  return { value: point };
}
