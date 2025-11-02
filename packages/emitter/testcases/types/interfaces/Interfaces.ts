export interface User {
  name: string;
  email: string;
  age: number;
}

export function greetUser(user: User): string {
  return `Hello ${user.name}, age ${user.age}`;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}
