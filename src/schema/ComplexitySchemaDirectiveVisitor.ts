import { SchemaDirectiveVisitor } from "graphql-tools";
import { GraphQLField, GraphQLObjectType, GraphQLInterfaceType } from "graphql";

export class ComplexitySchemaDirectiveVisitor extends SchemaDirectiveVisitor {
  visitFieldDefinition(
    field: GraphQLField<any, any>,
    details: {
      objectType: GraphQLObjectType | GraphQLInterfaceType;
    },
  ) {
    field.extensions;
    return field;
  }
}
