export class User {
  name: string;
  email: string;
  #password: string;

  constructor(name: string, email: string, password: string) {
    this.name = name;
    this.email = email;
    this.#password = password;
  }

  authenticate(input: string): boolean {
    return input === this.#password;
  }
}
