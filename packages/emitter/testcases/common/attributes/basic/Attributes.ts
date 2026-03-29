// Test: type-level attributes using A.on(X).type.add(Y) pattern
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
A.on(User).type.add(SerializableAttribute);

// Class with attribute and positional argument
export class Config {
  setting!: string;
}
A.on(Config).type.add(ObsoleteAttribute, "Use NewConfig instead");

// Class with multiple attributes
export class AnnotatedService {
  data!: string;
}
A.on(AnnotatedService).type.add(SerializableAttribute);
A.on(AnnotatedService).type.add(ObsoleteAttribute, "Deprecated");
