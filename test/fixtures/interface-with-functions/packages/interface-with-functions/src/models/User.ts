/**
 * User model - interface + factory functions with same name as file
 * Tests the __Module suffix when there's a name collision
 */

export interface User {
  id: number;
  name: string;
  email: string;
}

export function createUser(id: number, name: string, email: string): User {
  return { id, name, email };
}

export function formatUser(user: User): string {
  return `${user.name} <${user.email}>`;
}
