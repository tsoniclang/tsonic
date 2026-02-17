declare module "@tsonic/core/lang.js" {
  export type Ctor<T = unknown, Args extends readonly any[] = readonly any[]> = new (
    ...args: Args
  ) => T;

  export type InstanceOf<C extends Ctor<any, any>> = C extends Ctor<infer I, any>
    ? I
    : never;

  export type MethodKeys<T> = {
    [K in keyof T]-?: T[K] extends (...args: any[]) => any ? K : never;
  }[keyof T];

  export type PropertyKeys<T> = {
    [K in keyof T]-?: T[K] extends (...args: any[]) => any ? never : K;
  }[keyof T];

  export interface AttributeTargets {
    readonly assembly: "assembly";
    readonly module: "module";
    readonly type: "type";
    readonly method: "method";
    readonly property: "property";
    readonly field: "field";
    readonly event: "event";
    readonly param: "param";
    readonly return: "return";
  }

  export declare const AttributeTargets: AttributeTargets;

  export type AttributeTarget = AttributeTargets[keyof AttributeTargets];

  export interface AttributeTargetBuilder {
    target(target: AttributeTarget): AttributeTargetBuilder;
    add(ctor: any, ...args: any[]): void;
    add(descriptor: any): void;
  }

  export interface OnBuilder<T> {
    type: AttributeTargetBuilder;
    ctor: AttributeTargetBuilder;
    method<K extends MethodKeys<T>>(
      selector: (t: T) => T[K]
    ): AttributeTargetBuilder;
    prop<K extends PropertyKeys<T>>(
      selector: (t: T) => T[K]
    ): AttributeTargetBuilder;
  }

  export interface AttributesApi {
    on<C extends Ctor<any, any>>(ctor: C): OnBuilder<InstanceOf<C>>;
    attr(ctor: any, ...args: any[]): any;
  }

  export declare const attributes: AttributesApi;
}
