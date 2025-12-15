export class Animal {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  makeSound(): string {
    return "Some sound";
  }
}

export class Dog extends Animal {
  breed: string;

  constructor(name: string, breed: string) {
    super(name);
    this.breed = breed;
  }

  makeSound(): string {
    return "Woof!";
  }
}
