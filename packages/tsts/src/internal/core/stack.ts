import type { int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/stack.go::type::Stack","kind":"type","status":"implemented","sigHash":"9d1be24c631f29b706bab32914ea56ae89c3d5623ac175d48d0ff6fbd5147637","bodyHash":"fb7e51fb9997ab5b2bd0f184942b2c3764b1abde5f44fe477c4e984c3a187e3a"}
 *
 * Go source:
 * Stack[T any] struct {
 * 	data []T
 * }
 */
export interface Stack<T = unknown> {
  data: GoSlice<T>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/stack.go::method::Stack.Push","kind":"method","status":"implemented","sigHash":"8a4599063484d54e2a2d6e772b2f6300334f87c7b02eafc1c870a4220839ecfc","bodyHash":"cba7e9aa1a0f95c38f1eb3743a946b98af01b9b94365c42c2dd21a0586b96192"}
 *
 * Go source:
 * func (s *Stack[T]) Push(item T) {
 * 	s.data = append(s.data, item)
 * }
 */
export function Stack_Push<T>(receiver: GoPtr<Stack<T>>, item: T): void {
  receiver!.data.push(item);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/stack.go::method::Stack.Pop","kind":"method","status":"implemented","sigHash":"8634b7af0499b86c21a63984e12f5d28788cdd725888b5ddbfa4dd83e747b0e6","bodyHash":"e317648ff592fbc3d337db53fb0cc478a653738dc123b412b90506fa63b057de"}
 *
 * Go source:
 * func (s *Stack[T]) Pop() T {
 * 	l := len(s.data)
 * 	if l == 0 {
 * 		panic("stack is empty")
 * 	}
 * 	item := s.data[l-1]
 * 	var zero T
 * 	s.data[l-1] = zero
 * 	s.data = s.data[:l-1]
 * 	return item
 * }
 */
export function Stack_Pop<T>(receiver: GoPtr<Stack<T>>): T {
  const s = receiver!;
  const l = s.data.length;
  if (l === 0) {
    throw new globalThis.Error("stack is empty");
  }
  const item = s.data[l - 1]!;
  const zero = undefined as T;
  s.data[l - 1] = zero;
  s.data.length = l - 1;
  return item;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/stack.go::method::Stack.Peek","kind":"method","status":"implemented","sigHash":"14651de82facf867d364d2725a0d5033f86d8d75c385b5935284b70641c503c0","bodyHash":"ff645e41a9d0b04373999eea28f1407eebfe8fac9865c641b0bbdb6d02a6c01d"}
 *
 * Go source:
 * func (s *Stack[T]) Peek() T {
 * 	l := len(s.data)
 * 	if l == 0 {
 * 		panic("stack is empty")
 * 	}
 * 	return s.data[l-1]
 * }
 */
export function Stack_Peek<T>(receiver: GoPtr<Stack<T>>): T {
  const s = receiver!;
  const l = s.data.length;
  if (l === 0) {
    throw new globalThis.Error("stack is empty");
  }
  return s.data[l - 1]!;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/stack.go::method::Stack.Len","kind":"method","status":"implemented","sigHash":"23b64f1ee9fc92caa3912c3b2bceaaf7e87c0a78a9b0f2b6a583de8d8b8edab9","bodyHash":"5a7b4798a74a8a39948eb079ba0cf6867479ed43e0bef4348d12b6b6d75f6d72"}
 *
 * Go source:
 * func (s *Stack[T]) Len() int {
 * 	return len(s.data)
 * }
 */
export function Stack_Len<T>(receiver: GoPtr<Stack<T>>): int {
  return receiver!.data.length;
}
