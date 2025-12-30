import { Console } from "@tsonic/dotnet/System";

class Animal {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  makeSound(): string {
    return "Some sound";
  }
}

class Dog extends Animal {
  breed: string;

  constructor(name: string, breed: string) {
    super(name);
    this.breed = breed;
  }

  makeSound(): string {
    return "Woof!";
  }
}

const animal = new Animal("Generic");
const dog = new Dog("Buddy", "Golden Retriever");

Console.writeLine(`Animal: ${animal.name}, Sound: ${animal.makeSound()}`);
Console.writeLine(`Dog: ${dog.name}, Breed: ${dog.breed}, Sound: ${dog.makeSound()}`);
