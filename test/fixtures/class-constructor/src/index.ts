import { Console } from "@tsonic/dotnet/System";

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
Console.writeLine(`Name: ${user.name}`);
Console.writeLine(`Email: ${user.email}`);
Console.writeLine(`Auth correct: ${user.authenticate("secret123")}`);
Console.writeLine(`Auth wrong: ${user.authenticate("wrong")}`);
