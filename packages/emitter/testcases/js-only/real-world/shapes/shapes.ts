export abstract class Shape {
  constructor(public color: string) {}

  abstract area(): number;
  abstract perimeter(): number;

  describe(): string {
    return `A ${this.color} shape with area ${this.area()} and perimeter ${this.perimeter()}`;
  }
}

export class Circle extends Shape {
  constructor(
    color: string,
    public radius: number
  ) {
    super(color);
  }

  area(): number {
    return Math.PI * this.radius * this.radius;
  }

  perimeter(): number {
    return 2 * Math.PI * this.radius;
  }
}

export class Rectangle extends Shape {
  constructor(
    color: string,
    public width: number,
    public height: number
  ) {
    super(color);
  }

  area(): number {
    return this.width * this.height;
  }

  perimeter(): number {
    return 2 * (this.width + this.height);
  }

  isSquare(): boolean {
    return this.width === this.height;
  }
}

export class Triangle extends Shape {
  constructor(
    color: string,
    public base: number,
    public height: number,
    public side1: number,
    public side2: number
  ) {
    super(color);
  }

  area(): number {
    return (this.base * this.height) / 2;
  }

  perimeter(): number {
    return this.base + this.side1 + this.side2;
  }
}

export function totalArea(shapes: Shape[]): number {
  return shapes.reduce(
    (sum: number, shape: Shape): number => sum + shape.area(),
    0
  );
}

export function findLargestShape(shapes: Shape[]): Shape | undefined {
  if (shapes.length === 0) {
    return undefined;
  }

  let largest = shapes[0];
  for (const shape of shapes) {
    if (shape.area() > largest.area()) {
      largest = shape;
    }
  }
  return largest;
}
