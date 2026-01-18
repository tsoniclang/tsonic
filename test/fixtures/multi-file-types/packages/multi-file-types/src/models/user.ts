// User model
export interface User {
  name: string;
  age: number;
}

export function createUser(name: string, age: number): User {
  return { name: name, age: age };
}

export function formatUser(user: User): string {
  return `${user.name} (${user.age})`;
}
