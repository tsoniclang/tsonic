export class User {
  constructor(public name: string, public email: string, private password: string) {}

  authenticate(input: string): boolean {
    return input === this.password;
  }
}
