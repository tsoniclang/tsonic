import { attributes as A } from "@tsonic/core/attributes.js";
import { ObsoleteAttribute, SerializableAttribute } from "@tsonic/dotnet/System.js";

export class User {
  private _nameField!: string;

  get name(): string {
    return this._nameField;
  }

  set name(value: string) {
    this._nameField = value;
  }

  save(): void {}
}

A.on(User).type.add(SerializableAttribute);
A.on(User).ctor.add(ObsoleteAttribute, "ctor");
A.on(User).method((u) => u.save).add(ObsoleteAttribute, "method");
A.on(User).prop((u) => u.name).add(ObsoleteAttribute, "prop");

export class NoCtor {
  value!: number;
}

A.on(NoCtor).ctor.add(ObsoleteAttribute, "implicit");
