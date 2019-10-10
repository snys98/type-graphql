---
title: Directives
---

TypeGraphQL provides basic support for [GraphQL directives](https://www.apollographql.com/docs/graphql-tools/schema-directives/).

> A directive is an identifier preceded by a @ character, optionally followed by a list of named arguments, which can appear after almost any form of syntax in the GraphQL query or schema languages.

Here's a modified example from the GraphQL draft specification that illustrates several of these possibilities:

```graphql
directive @deprecated(
  reason: String = "No longer supported"
) on OBJECT | FIELD_DEFINITION

@deprecated(reason: "Use `NewType`.")
type Foo {
  field: String
}

type Bar {
  newField: String
  oldField: String @deprecated(reason: "Use `newField`.")
}
```

With type-graphql, you can add directives on fields and objects with `@Directive(nameOrDeclaration: string)` as in this example:

```typescript
import { Directive, Field, ObjectType } from "type-graphql";

@ObjectType()
@Directive("deprecated")
class Foo {
  @Field()
  field: string;
}

@ObjectType()
class Bar {
  @Field()
  newField;

  @Field()
  @Directive('@deprecated(reason: "Use `newField`")')
  oldField;
}
```

Please note that `@Directive` can only contain a single GraphQL directive name or declaration.
