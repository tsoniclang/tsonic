import { int } from "@tsonic/core/types.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

export class User {
  id: int;
  constructor(id: int) {
    this.id = id;
  }
}

export function makeInts(): List<int> {
  return new List<int>([1, 2, 3]);
}

export function makeStrings(): List<string> {
  return new List<string>(["a", "b"]);
}

export function makeUsers(): List<User> {
  const u1 = new User(1);
  const u2 = new User(2);
  return new List<User>([u1, u2]);
}
