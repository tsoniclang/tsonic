import { attributes as A } from "@tsonic/core/attributes.js";
import {
  Console,
  ObsoleteAttribute,
  SerializableAttribute,
} from "@tsonic/dotnet/System.js";

// Class with Serializable attribute
export class User {
  name!: string;
  age!: number;
}
A.on(User).type.add(SerializableAttribute);

// Class with Obsolete attribute
export class Config {
  setting!: string;
}
A.on(Config).type.add(ObsoleteAttribute, "Use NewConfig instead");

const user = new User();
user.name = "Alice";
user.age = 30;

Console.writeLine(`User: ${user.name}, ${user.age}`);
Console.writeLine("Attributes applied successfully");
