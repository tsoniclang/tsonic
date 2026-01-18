import { Console } from "@tsonic/dotnet/System.js";

class User {
  constructor(
    public name: string,
    public email: string,
    private password: string
  ) {}

  authenticate(input: string): boolean {
    return input === this.password;
  }
}

const user = new User("Alice", "alice@example.com", "secret123");
Console.WriteLine(`Name: ${user.name}`);
Console.WriteLine(`Email: ${user.email}`);
Console.WriteLine(`Auth correct: ${user.authenticate("secret123")}`);
Console.WriteLine(`Auth wrong: ${user.authenticate("wrong")}`);
