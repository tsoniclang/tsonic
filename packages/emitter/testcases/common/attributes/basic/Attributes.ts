// Test: declaration-level attributes using A<T>().add(...) pattern
import { attributes as A } from "@tsonic/core/lang.js";
import {
  SerializableAttribute,
  ObsoleteAttribute,
} from "@tsonic/dotnet/System.js";

// Class with single attribute
export class User {
  name!: string;
  age!: number;
}
A<User>().add(SerializableAttribute);

// Class with attribute and positional argument
export class Config {
  setting!: string;
}
A<Config>().add(ObsoleteAttribute, "Use NewConfig instead");

// Class with multiple attributes
export class AnnotatedService {
  data!: string;
}
A<AnnotatedService>().add(SerializableAttribute);
A<AnnotatedService>().add(ObsoleteAttribute, "Deprecated");
