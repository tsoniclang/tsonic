export class Person {
  name!: string;
  age!: number;

  greet(): string {
    return `Hello, I'm ${this.name}`;
  }

  birthday(): void {
    this.age++;
  }
}
