---

title: TypeScript Generics Without the Mystery
description: A gradual tour of TypeScript generics — why they exist, how inference and constraints work, and when a generic is the wrong tool.
pubDate: 2026-11-13
---

Generics have a reputation problem. The syntax is familiar from other
languages, but TypeScript generics are not templates and not runtime
constructs. They are a way of describing a _relationship between types_ that
the compiler can check without you repeating yourself.

The fastest way to demystify them is to start from a function that does not use
them, notice what breaks, and add the minimum that fixes it.

## The problem generics solve

Suppose you need the first element of an array.

```ts
function first(items: string[]): string {
  return items[0];
}
```

That works until you have numbers. Widening to `any` fixes the compile error
and throws away the thing you wanted:

```ts
function first(items: any[]): any {
  return items[0];
}

const value = first([1, 2, 3]); // any
value.toUpperCase(); // compiles, fails at runtime
```

A union of every type you might pass does not scale either. What you actually
mean is: _whatever the element type is, the return type is the same one._ That
is a generic.

```ts
function first<T>(items: T[]): T {
  return items[0];
}

const number = first([1, 2, 3]); // number
const word = first(["a", "b"]); // string
```

`T` is a type parameter — a placeholder the compiler fills in. You never write
`first<number>(...)` here, because TypeScript infers it from the argument.

> A generic is not "a type I forgot to specify." It is a variable that ranges
> over types, introduced so one declaration can describe many call sites
> correctly.

## Inference does most of the work

Explicit type arguments are usually unnecessary and often harmful, because they
override what the compiler would have figured out.

```ts
const pair = <T>(a: T, b: T): [T, T] => [a, b];

const inferred = pair(1, 2); // [number, number]
const explicit = pair<number | string>(1, 2); // [number | string, number | string]
```

The explicit version is wider than the data warrants. Inference is not a
convenience; it is the mechanism that keeps types narrow.

### The `<T,>` oddity in `.tsx`

In `.tsx` files, `<T>` at the start of an arrow function is parsed as JSX. The
trailing comma — `<T,>` — tells the parser it is a type parameter list. Function
declarations (`function pair<T>(...)`) are unaffected, which is one reason to
prefer them for generic helpers.

## Generic types and interfaces

Type parameters are not limited to functions. A generic type describes a
structure whose shape depends on another type.

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

function parseJson<T>(text: string, validate: (value: unknown) => value is T): Result<T> {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!validate(parsed)) {
      return { ok: false, error: new Error("Unexpected shape") };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
```

`Result<T>` is not a new runtime value. It is a union that carries the success
payload's type. When you check `result.ok`, TypeScript narrows `value` for you —
the same narrowing it does for any discriminated union.

Generic interfaces behave the same way and are often clearer when the type is
primarily an object shape.

```ts
interface Page<T> {
  items: readonly T[];
  total: number;
  cursor: string | null;
}

function nextPage<T>(page: Page<T>): Page<T> | null {
  if (page.cursor === null) return null;
  return { ...page, cursor: null };
}
```

## Constraints with `extends`

A bare `T` can be anything, so you can do almost nothing with it. Constraints
state the minimum capability your implementation needs.

```ts
function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

const users = [{ id: 1, name: "Ada" }];
const names = pluck(users, "name"); // string[]
const ids = pluck(users, "id"); // number[]
```

`K extends keyof T` is doing real work here. It restricts `key` to actual keys
of `T`, and `T[K]` — an indexed access type — resolves to the type at that key.
Ask for `"email"` and the call fails at compile time:

```ts
pluck(users, "email"); // Error: Argument of type '"email"' is not assignable to
// parameter of type '"id" | "name"'
```

The same idea appears in the standard library. `Pick<T, K>` and `Record<K, V>`
are both constrained on their second parameter.

### Constraints are not validation

`extends` narrows what types are allowed. It does not check values. A function
constrained to `{ id: string }` still receives objects whose `id` might be an
empty string. Runtime validation and type constraints solve different problems
and both are usually needed at a boundary.

## Patterns worth knowing

**Constraining to a shape.** `T extends { id: string }` lets you rely on `.id`
without demanding an exact type, so callers can pass objects with extra fields.

**Defaulting a parameter.** `type Box<T = string>` supplies a fallback when the
argument is omitted. Use sparingly; defaults make call sites read differently
depending on whether they pass a type.

**Mapping over a union.** A conditional type can transform each member:

```ts
type Awaited<T> = T extends Promise<infer U> ? U : T;

type A = Awaited<Promise<number>>; // number
type B = Awaited<string>; // string
```

`infer` introduces a type variable inside a conditional type. It is powerful
and easy to overuse — most application code needs it far less than library code
does.

**Keyed lookups.** Combining `keyof` with indexed access produces small,
precise helpers:

```ts
function groupBy<T, K extends keyof T>(items: readonly T[], key: K): Map<T[K], T[]> {
  const groups = new Map<T[K], T[]>();
  for (const item of items) {
    const group = groups.get(item[key]) ?? [];
    group.push(item);
    groups.set(item[key], group);
  }
  return groups;
}
```

## When generics hurt

Generics add a reading cost. Every type parameter is a thing the next reader
has to hold in their head. Some cases where that cost is not worth paying:

- **A single call site.** If a helper has one caller and the type is known,
  write the concrete type. Generality you do not use is indirection.
- **A type parameter that appears once.** `function log<T>(value: T)` is
  equivalent to `function log(value: unknown)` with less machinery. A parameter
  that appears in one position constrains nothing.
- **Replacing a union.** If there are three known variants, a discriminated
  union models them better than a generic that must accept all three.
- **Type gymnastics at application level.** Deep conditional types belong in
  libraries that amortize the cost across many consumers. In product code they
  usually encode a design that would be clearer with plain types.

A useful test: if you cannot name a second call site with a different type,
the generic is speculative.

## Common mistakes

**Writing `<T>` where `unknown` belongs.** A generic that is never related to
another position is just `unknown` with extra syntax.

**Over-constraining.** `T extends string` when any `PropertyKey` would do
rejects valid callers for no reason.

**Assuming generics erase at the wrong time.** Type parameters are erased
entirely. `function is<T>(value: unknown): value is T` cannot work — at runtime
there is no `T` to test against. That is why validators are passed in, as in
`parseJson` above.

**Fighting inference with explicit arguments.** If you find yourself writing
`foo<MyType>(...)` everywhere, the signature probably needs adjusting.

## A short decision guide

1. Does the function relate two positions — input type to output type? If no,
   skip generics.
2. Does the relationship hold for more than one concrete type? If no, write the
   concrete type.
3. Does the implementation need a capability? Express it with `extends`.
4. Does the caller know better than the compiler? Only then pass a type
   argument explicitly.

Generics are at their best when they are almost invisible: `first(items)`,
`groupBy(rows, "team")`, `Promise<T>`. The syntax should be doing quiet work,
not announcing itself.

## References

- [TypeScript Handbook: Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript Handbook: Conditional types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
- [TypeScript Handbook: Indexed access types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html)
- [TypeScript Handbook: Utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

Related: [A Practical Mental Model for Static-First Websites with Astro](/blog/static-first-astro/)
and [Design Tokens That Stay Small, Consistent, and Useful](/blog/css-design-tokens/).
