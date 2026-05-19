import { attributes as A } from "@tsonic/core/lang.js";
import {
  ObsoleteAttribute,
  SerializableAttribute,
} from "@tsonic/dotnet/System.js";

export class User {
  #nameField!: string;

  get name(): string {
    return this.#nameField;
  }

  set name(value: string) {
    this.#nameField = value;
  }

  save(): void {}
}

A<User>().add(SerializableAttribute);
A<User>().ctor.add(ObsoleteAttribute, "ctor");
A<User>()
  .method((u) => u.save)
  .add(ObsoleteAttribute, "method");
A<User>()
  .prop((u) => u.name)
  .add(ObsoleteAttribute, "prop");

export class NoCtor {
  value!: number;
}

A<NoCtor>().ctor.add(ObsoleteAttribute, "implicit");
