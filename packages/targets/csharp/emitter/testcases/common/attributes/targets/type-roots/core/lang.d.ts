declare module "@tsonic/core/lang.js" {
  export type AttributeArgument =
    | string
    | number
    | boolean
    | null
    | readonly AttributeArgument[];

  export type Ctor<
    T = object,
    Args extends readonly AttributeArgument[] = readonly AttributeArgument[],
  > = new (...args: Args) => T;

  export type AttributeCtor = Ctor<object, readonly AttributeArgument[]>;

  export interface AttributeDescriptor {
    readonly kind: "attribute";
    readonly ctor: AttributeCtor;
    readonly args: readonly AttributeArgument[];
  }

  export declare function asinterface<T>(value: object): T;

  export type MethodKeys<T> = {
    [K in keyof T]-?: T[K] extends (...args: infer _Args) => infer _Result
      ? K
      : never;
  }[keyof T];

  export type PropertyKeys<T> = {
    [K in keyof T]-?: T[K] extends (...args: infer _Args) => infer _Result
      ? never
      : K;
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
    add(ctor: AttributeCtor, ...args: readonly AttributeArgument[]): void;
    add(descriptor: AttributeDescriptor): void;
  }

  export interface TypeAttributeBuilder<T> extends AttributeTargetBuilder {
    readonly ctor: AttributeTargetBuilder;
    method<K extends MethodKeys<T>>(
      selector: (t: T) => T[K]
    ): AttributeTargetBuilder;
    prop<K extends PropertyKeys<T>>(
      selector: (t: T) => T[K]
    ): AttributeTargetBuilder;
  }

  export interface FunctionAttributeBuilder {
    add(ctor: AttributeCtor, ...args: readonly AttributeArgument[]): void;
    add(descriptor: AttributeDescriptor): void;
  }

  export interface AttributesApi {
    <T>(): TypeAttributeBuilder<T>;
    <F extends Function>(fn: F): FunctionAttributeBuilder;
    attr(
      ctor: AttributeCtor,
      ...args: readonly AttributeArgument[]
    ): AttributeDescriptor;
  }

  export declare const attributes: AttributesApi;

  /**
   * Overload-family marker API.
   *
   * Examples:
   *   O<Parser>().method(x => x.parse_string).family(x => x.Parse);
   *   O(parse_bytes).family(parse);
   */
  export interface OverloadMethodFamilyBuilder<T> {
    family<K extends MethodKeys<T>>(selector: (t: T) => T[K]): void;
  }

  export interface OverloadTypeBuilder<T> {
    method<K extends MethodKeys<T>>(
      selector: (t: T) => T[K]
    ): OverloadMethodFamilyBuilder<T>;
  }

  export interface OverloadFunctionFamilyBuilder {
    family<F extends Function>(fn: F): void;
  }

  export interface OverloadsApi {
    <T>(): OverloadTypeBuilder<T>;
    <F extends Function>(fn: F): OverloadFunctionFamilyBuilder;
  }

  export declare const overloads: OverloadsApi;
}
