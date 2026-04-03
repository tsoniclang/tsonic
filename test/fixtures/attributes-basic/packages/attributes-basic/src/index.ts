import { attributes as A } from "@tsonic/core/lang.js";
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
A<User>().add(SerializableAttribute);

// Class with Obsolete attribute
export class Config {
  setting!: string;
}
A<Config>().add(ObsoleteAttribute, "Use NewConfig instead");

const user = new User();
user.name = "Alice";
user.age = 30;

Console.WriteLine(`User: ${user.name}, ${user.age}`);
Console.WriteLine("Attributes applied successfully");
