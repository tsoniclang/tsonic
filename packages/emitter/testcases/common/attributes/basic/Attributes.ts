// Test: type-level attributes using A.on(X).type.add(Y) pattern
import { attributes as A } from "@tsonic/core/attributes.js";

// Declare attribute types (these would come from @tsonic/dotnet in real usage)
declare class SerializableAttribute {}
declare class ObsoleteAttribute {
  constructor(message?: string);
}

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
export class LegacyService {
  data!: string;
}
A.on(LegacyService).type.add(SerializableAttribute);
A.on(LegacyService).type.add(ObsoleteAttribute, "Deprecated");
