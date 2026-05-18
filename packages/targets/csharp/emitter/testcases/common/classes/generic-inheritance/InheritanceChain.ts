import { int } from "@tsonic/core/types.js";

// Level 1: Base
export class Entity<TId> {
  id: TId;
  constructor(id: TId) {
    this.id = id;
  }
}

// Level 2: Extends with same param
export class NamedEntity<TId> extends Entity<TId> {
  name: string;
  constructor(id: TId, name: string) {
    super(id);
    this.name = name;
  }
}

// Level 3: Extends with concrete type
export class User extends NamedEntity<int> {
  email: string;
  constructor(id: int, name: string, email: string) {
    super(id, name);
    this.email = email;
  }
}
