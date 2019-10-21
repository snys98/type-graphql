import { GraphQLSchema, GraphQLDirective, validateSchema, GraphQLObjectType } from "graphql";
import { Options as PrintSchemaOptions, printSchema } from "graphql/utilities/schemaPrinter";
import * as path from "path";

import { SchemaGenerator, SchemaGeneratorOptions } from "../schema/schema-generator";
import { loadResolversFromGlob } from "../helpers/loadResolversFromGlob";
import {
  emitSchemaDefinitionFileSync,
  emitSchemaDefinitionFile,
  defaultPrintSchemaOptions,
} from "./emitSchemaDefinitionFile";
import { NonEmptyArray } from "./types";
import { createResolversMap } from "./createResolversMap";
import { makeExecutableSchema } from "graphql-tools";
import { applyMiddleware } from "graphql-middleware";
import { getMetadataStorage } from "../metadata/getMetadataStorage";
import {
  AuthorizedMetadata,
  FieldMetadata,
  ResolverMetadata,
  FieldResolverMetadata,
} from "../metadata/definitions";
import { shield } from "graphql-shield";
import { IRuleTypeMap, ShieldRule } from "graphql-shield/dist/types";
import { UnauthorizedError } from "../errors";
import { ComplexitySchemaDirectiveVisitor } from "../schema/ComplexitySchemaDirectiveVisitor";
import { printSchemaWithDirectives } from "./schemaPrinter";
interface EmitSchemaFileOptions extends PrintSchemaOptions {
  path?: string;
}

export interface BuildSchemaOptions extends Omit<SchemaGeneratorOptions, "resolvers"> {
  /** Array of resolvers classes or glob paths to resolver files */
  resolvers: NonEmptyArray<Function> | NonEmptyArray<string>;
  /**
   * Path to the file to where emit the schema
   * or config object with print schema options
   * or `true` for the default `./schema.gql` one
   */
  emitSchemaFile?: string | boolean | EmitSchemaFileOptions;
}
export async function buildSchema(options: BuildSchemaOptions): Promise<GraphQLSchema> {
  const resolvers = loadResolvers(options);
  const schema = await SchemaGenerator.generateFromMetadata({ ...options, resolvers });
  if (options.emitSchemaFile) {
    const { schemaFileName, printSchemaOptions } = getEmitSchemaDefinitionFileOptions(options);
    await emitSchemaDefinitionFile(schemaFileName, schema, printSchemaOptions);
  }
  try {
    attachPermissions(schema);
  } catch (error) {
    if (options.skipCheck) {
      return schema;
    }
    throw error;
  }
  // const typeDefs = printSchemaWithDirectives(schema);
  // const resolverMaps = createResolversMap(schema);
  // const executableSchema = makeExecutableSchema({
  //   typeDefs,
  //   schemaDirectives: { complexity: ComplexitySchemaDirectiveVisitor },
  //   resolvers: resolverMaps,
  // });
  return schema;
}

function attachPermissions(schema: GraphQLSchema) {
  const {
    queries,
    mutations,
    subscriptions,
    authorizedFields,
    fields,
    fieldResolvers,
  } = getMetadataStorage();
  const error = validateSchema(schema) && validateSchema(schema)[0];
  if (error !== undefined) {
    throw error;
  }
  const resolvers = [...queries, ...mutations, ...subscriptions, ...fields, ...fieldResolvers];
  const _authorizedFields = authorizedFields.map(meta => {
    return {
      ...resolvers.find(
        field => field.name === meta.fieldName && field.target.name === meta.target.name,
      )!,
      ...meta,
    } as AuthorizedMetadata & FieldMetadata & ResolverMetadata & FieldResolverMetadata;
  });
  const shieldTree: { [k: string]: any } = {};
  const types = Object.entries(schema.getTypeMap()).filter(x => !x[0].startsWith("__"));
  types
    .filter(type => Object.getOwnPropertyDescriptor(type[1], "_fields"))
    .forEach(type => {
      const fieldsOfAType = Object.entries(
        (type[1] as Pick<GraphQLObjectType, "getFields">).getFields(),
      );
      // shieldTree[type[0]]
      const _shieldTree = {} as { [k: string]: any };
      fieldsOfAType.forEach(fieldInSchema => {
        // tslint:disable-next-line: no-string-literal
        const fieldMeta = _authorizedFields.find(
          x =>
            x.schemaName === fieldInSchema[0] &&
            ((x.target as any).__schemaName__ === type[1].name || type[1].name === x.type),
        );
        if (fieldMeta && fieldMeta!.rule) {
          _shieldTree[fieldMeta!.schemaName] = fieldMeta!.rule;
        }
      });
      if (Object.keys(_shieldTree).length > 0) {
        shieldTree[type[0]] = _shieldTree;
      }
    });
  if (Object.keys(shieldTree).length > 0) {
    applyMiddleware(
      schema,
      shield(shieldTree, {
        fallbackError: new UnauthorizedError(),
        allowExternalErrors: true,
        debug: true,
      }),
    );
  }
}

export function buildSchemaSync(options: BuildSchemaOptions): GraphQLSchema {
  const resolvers = loadResolvers(options);
  const schema = SchemaGenerator.generateFromMetadataSync({ ...options, resolvers });
  if (options.emitSchemaFile) {
    const { schemaFileName, printSchemaOptions } = getEmitSchemaDefinitionFileOptions(options);
    emitSchemaDefinitionFileSync(schemaFileName, schema, printSchemaOptions);
  }
  try {
    attachPermissions(schema);
  } catch (error) {
    if (options.skipCheck) {
      return schema;
    }
    throw error;
  }
  return schema;
}

function loadResolvers(options: BuildSchemaOptions): Function[] | undefined {
  // TODO: remove that check as it's covered by `NonEmptyArray` type guard
  if (options.resolvers.length === 0) {
    throw new Error("Empty `resolvers` array property found in `buildSchema` options!");
  }
  if (options.resolvers.some((resolver: Function | string) => typeof resolver === "string")) {
    (options.resolvers as string[]).forEach(resolver => {
      if (typeof resolver === "string") {
        loadResolversFromGlob(resolver);
      }
    });
    return undefined;
  }
  return options.resolvers as Function[];
}

function getEmitSchemaDefinitionFileOptions(
  buildSchemaOptions: BuildSchemaOptions,
): {
  schemaFileName: string;
  printSchemaOptions: PrintSchemaOptions;
} {
  const defaultSchemaFilePath = path.resolve(process.cwd(), "schema.gql");
  return {
    schemaFileName:
      typeof buildSchemaOptions.emitSchemaFile === "string"
        ? buildSchemaOptions.emitSchemaFile
        : typeof buildSchemaOptions.emitSchemaFile === "object"
        ? buildSchemaOptions.emitSchemaFile.path || defaultSchemaFilePath
        : defaultSchemaFilePath,
    printSchemaOptions:
      typeof buildSchemaOptions.emitSchemaFile === "object"
        ? buildSchemaOptions.emitSchemaFile
        : defaultPrintSchemaOptions,
  };
}
