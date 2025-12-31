import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Level 1: Base
class Entity<TId> {
  id: TId;
  constructor(id: TId) {
    this.id = id;
  }
}

// Level 2: Extends with same param
class NamedEntity<TId> extends Entity<TId> {
  name: string;
  constructor(id: TId, name: string) {
    super(id);
    this.name = name;
  }
}

// Level 3: Extends with concrete type
class User extends NamedEntity<int> {
  email: string;
  constructor(id: int, name: string, email: string) {
    super(id, name);
    this.email = email;
  }
}

// Level 3 alt: Still generic
class GenericUser<T> extends NamedEntity<T> {
  role: string;
  constructor(id: T, name: string, role: string) {
    super(id, name);
    this.role = role;
  }
}

// Test 3-level chain
export function main(): void {
  const user = new User(1, "Alice", "alice@example.com");
  Console.writeLine(`User ${user.id}: ${user.name} (${user.email})`);

  const admin = new GenericUser("admin-001", "Bob", "admin");
  Console.writeLine(`Admin ${admin.id}: ${admin.name} [${admin.role}]`);
}
