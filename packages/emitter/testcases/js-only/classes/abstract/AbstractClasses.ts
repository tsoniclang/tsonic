// Abstract base class
export abstract class Shape {
  abstract getArea(): number;
  abstract getPerimeter(): number;

  // Concrete method in abstract class
  describe(): string {
    return `Area: ${this.getArea()}, Perimeter: ${this.getPerimeter()}`;
  }
}

// Concrete implementation
export class Rectangle extends Shape {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    super();
    this.width = width;
    this.height = height;
  }

  getArea(): number {
    return this.width * this.height;
  }

  getPerimeter(): number {
    return 2 * (this.width + this.height);
  }
}

// Another concrete implementation
export class Circle extends Shape {
  radius: number;

  constructor(radius: number) {
    super();
    this.radius = radius;
  }

  getArea(): number {
    return Math.PI * this.radius * this.radius;
  }

  getPerimeter(): number {
    return 2 * Math.PI * this.radius;
  }
}

// Function using abstract class
export function calculateTotalArea(shapes: Shape[]): number {
  return shapes.reduce(
    (total: number, shape: Shape): number => total + shape.getArea(),
    0
  );
}
