# Basic Examples

Get started with simple Tsonic programs.

## Hello World

```typescript
// hello.ts
export function main() {
  console.log("Hello, Tsonic!");
}
```

```bash
$ tsonic build hello.ts
$ ./hello
Hello, Tsonic!
```

## Variables

```typescript
export function main() {
  const name = "Alice";
  const age = 30;
  const active = true;

  console.log(`${name} is ${age} years old`);
  console.log(`Active: ${active}`);
}
```

## Functions

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

function add(a: number, b: number): number {
  return a + b;
}

export function main() {
  console.log(greet("Bob"));
  console.log(add(5, 3));
}
```

## Classes

```typescript
class Person {
  constructor(
    public name: string,
    public age: number
  ) {}

  greet(): string {
    return `Hi, I'm ${this.name}`;
  }
}

export function main() {
  const person = new Person("Alice", 30);
  console.log(person.greet());
}
```

## Interfaces

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

function displayUser(user: User) {
  console.log(`User: ${user.name} (${user.id})`);
  if (user.email) {
    console.log(`Email: ${user.email}`);
  }
}

export function main() {
  const user: User = {
    id: 1,
    name: "Bob",
    email: "bob@example.com",
  };
  displayUser(user);
}
```

## Control Flow

```typescript
export function main() {
  // If/else
  const x = 10;
  if (x > 5) {
    console.log("Greater than 5");
  } else {
    console.log("5 or less");
  }

  // For loop
  for (let i = 0; i < 5; i++) {
    console.log(i);
  }

  // While loop
  let count = 0;
  while (count < 3) {
    console.log(count);
    count++;
  }
}
```

## See Also

- [Arrays](arrays.md)
- [.NET Integration](dotnet.md)
- [Imports](imports.md)
