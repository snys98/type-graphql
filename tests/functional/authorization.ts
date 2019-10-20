import "reflect-metadata";
import { GraphQLSchema, graphql } from "graphql";

import { getMetadataStorage } from "../../src/metadata/getMetadataStorage";
import {
  Field,
  ObjectType,
  Ctx,
  Authorized,
  Query,
  Resolver,
  buildSchema,
  FieldResolver,
  UnauthorizedError,
  ForbiddenError,
} from "../../src";
import { rule, and, or } from "graphql-shield";
import { defaultAuthRule } from "../../src/decorators/Authorized";

describe("Authorization", () => {
  let schema: GraphQLSchema;
  let sampleResolver: any;
  const admin = and(
    defaultAuthRule,
    rule()(async (parent, args, ctx, info) => {
      if (ctx.user.roles && ctx.user.roles.some((role: string) => role === "admin")) {
        return true;
      }
      throw new ForbiddenError();
    }),
  );
  const regular = and(
    defaultAuthRule,
    rule()(async (parent, args, ctx, info) => {
      if (ctx.user.roles && ctx.user.roles.some((role: string) => role === "regular")) {
        return true;
      }
      throw new ForbiddenError();
    }),
  );
  beforeAll(async () => {
    getMetadataStorage().clear();

    @ObjectType()
    class SampleObject {
      @Field()
      normalField: string;

      @Field()
      @Authorized()
      authedField: string;

      @Field({ nullable: true })
      @Authorized()
      nullableAuthedField: string;

      @Field()
      @Authorized(admin)
      adminField: string;

      @Field()
      normalResolvedField: string;

      @Field()
      authedResolvedField: string;

      @Field()
      @Authorized()
      inlineAuthedResolvedField: string;
    }

    @Resolver(of => SampleObject)
    class SampleResolver {
      @Query()
      normalQuery(): boolean {
        return true;
      }

      @Query()
      normalObjectQuery(): SampleObject {
        return {
          normalField: "normalField",
          authedField: "authedField",
          adminField: "adminField",
        } as SampleObject;
      }

      @Query()
      @Authorized()
      authedQuery(@Ctx() ctx: any): boolean {
        return ctx.user !== undefined;
      }

      @Query(type => Boolean, { nullable: true })
      @Authorized()
      nullableAuthedQuery(@Ctx() ctx: any) {
        return true;
      }

      @Query()
      @Authorized(admin)
      adminQuery(@Ctx() ctx: any): boolean {
        return ctx.user !== undefined;
      }

      @Query()
      @Authorized(or(admin, regular))
      adminOrRegularQuery(@Ctx() ctx: any): boolean {
        return ctx.user !== undefined;
      }

      @Query()
      @Authorized(or(admin, regular))
      adminOrRegularRestQuery(@Ctx() ctx: any): boolean {
        return ctx.user !== undefined;
      }

      @FieldResolver()
      normalResolvedField() {
        return "normalResolvedField";
      }

      @FieldResolver()
      @Authorized()
      authedResolvedField() {
        return "authedResolvedField";
      }

      @FieldResolver()
      inlineAuthedResolvedField() {
        return "inlineAuthedResolvedField";
      }
    }

    sampleResolver = SampleResolver;
    schema = await buildSchema({
      resolvers: [SampleResolver],
    });
  });

  describe("Reflection", () => {
    // helpers
    function findQuery(queryName: string) {
      return getMetadataStorage().queries.find(it => it.name === queryName)!;
    }

    it("should build schema without errors", async () => {
      expect(schema).toBeDefined();
    });

    it("should register correct rule for resolvers", async () => {
      const normalQuery = findQuery("normalQuery");
      const authedQuery = findQuery("authedQuery");
      const adminQuery = findQuery("adminQuery");

      expect(normalQuery.rule).toBeUndefined();
      expect(authedQuery.rule).toBeDefined();
      expect(adminQuery.rule).toBeDefined();
    });

    it("should register correct rule for object type fields", async () => {
      const sampleObject = getMetadataStorage().objectTypes.find(
        type => type.name === "SampleObject",
      )!;
      const normalField = sampleObject.fields!.find(field => field.name === "normalField")!;
      const authedField = sampleObject.fields!.find(field => field.name === "authedField")!;
      const adminField = sampleObject.fields!.find(field => field.name === "adminField")!;

      expect(normalField.rule).toBeUndefined();
      expect(authedField.rule).toBeDefined();
      expect(adminField.rule).toBeDefined();
    });

    it("should register correct rule for every decorator overload", async () => {
      const normalQuery = findQuery("normalQuery");
      const authedQuery = findQuery("authedQuery");
      const adminQuery = findQuery("adminQuery");
      const adminOrRegularQuery = findQuery("adminOrRegularQuery");
      const adminOrRegularRestQuery = findQuery("adminOrRegularRestQuery");

      expect(normalQuery.rule).toBeUndefined();
      expect(authedQuery.rule).toBeDefined();
      expect(adminQuery.rule).toBeDefined();
      expect(adminOrRegularQuery.rule).toBeDefined();
      expect(adminOrRegularRestQuery.rule).toBeDefined();
    });
  });

  describe("Functional", () => {
    it("should allow to register auth checker", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });

      expect(localSchema).toBeDefined();
    });

    it("should allow to read not guarded query", async () => {
      const query = `query {
        normalQuery
      }`;

      const result = await graphql(schema, query);

      expect(result.data!.normalQuery).toEqual(true);
    });

    it("should allow to read not guarded object field", async () => {
      const query = `query {
        normalObjectQuery {
          normalField
        }
      }`;

      const result = await graphql(schema, query);

      expect(result.data!.normalObjectQuery.normalField).toEqual("normalField");
    });

    it("should allow to read not guarded object field from resolver", async () => {
      const query = `query {
        normalObjectQuery {
          normalResolvedField
        }
      }`;

      const result = await graphql(schema, query);

      expect(result.data!.normalObjectQuery.normalResolvedField).toEqual("normalResolvedField");
    });

    it("should restrict access to authed query", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });
      const query = `query {
        authedQuery
      }`;

      const result = await graphql(localSchema, query);

      expect(result.data).toBeNull();
      expect(result.errors).toBeDefined();
    });
    it("should throw UnauthorizedError when guest accessing authed query", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });
      const query = `query {
        authedQuery
      }`;

      const result = await graphql(localSchema, query);

      expect(result.data).toBeNull();
      expect(result.errors).toHaveLength(1);
      const error = result.errors![0];
      expect(error.originalError).toBeInstanceOf(UnauthorizedError);
      expect(error.path).toContain("authedQuery");
    });

    it("should throw ForbiddenError when guest accessing query authed with roles", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });
      const query = `query {
        adminQuery
      }`;

      const result = await graphql(localSchema, query, undefined, { user: {} });

      expect(result.data).toBeNull();
      expect(result.errors).toHaveLength(1);
      const error = result.errors![0];
      expect(error.originalError).toBeInstanceOf(ForbiddenError);
      expect(error.path).toContain("adminQuery");
    });

    it("should restrict access to authed object field", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });
      const query = `query {
        normalObjectQuery {
          authedField
        }
      }`;

      const result = await graphql(localSchema, query);

      expect(result.data).toBeNull();
    });

    it("should return null while accessing nullable authed object field", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });
      const query = `query {
        normalObjectQuery {
          nullableAuthedField
        }
      }`;

      const result = await graphql(localSchema, query);

      expect(result.data!.normalObjectQuery.nullableAuthedField).toBeNull();
    });

    it("should throw UnauthorizedError when guest accessing autherd object field", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });
      const query = `query {
        normalObjectQuery {
          authedField
        }
      }`;

      const result = await graphql(localSchema, query);

      expect(result.data).toBeNull();
      expect(result.errors).toHaveLength(1);
      const error = result.errors![0];
      expect(error.originalError).toBeInstanceOf(UnauthorizedError);
      expect(error.path).toContain("authedField");
    });

    it("should throw ForbiddenError when guest accessing object field authed with roles", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });
      const query = `query {
        normalObjectQuery {
          adminField
        }
      }`;

      const result = await graphql(localSchema, query, undefined, { user: {} });

      expect(result.data).toBeNull();
      expect(result.errors).toHaveLength(1);
      const error = result.errors![0];
      expect(error.originalError).toBeInstanceOf(ForbiddenError);
      expect(error.path).toContain("adminField");
    });

    it("should restrict access to authed object field from resolver", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });
      const query = `query {
        normalObjectQuery {
          authedResolvedField
        }
      }`;

      const result = await graphql(localSchema, query);

      expect(result.data).toBeNull();
    });

    it("should restrict access to inline authed object field from resolver", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });
      const query = `query {
        normalObjectQuery {
          inlineAuthedResolvedField
        }
      }`;

      const result = await graphql(localSchema, query);

      expect(result.data).toBeNull();
    });

    it("should allow for access to authed object field from resolver when access granted", async () => {
      const localSchema = await buildSchema({
        resolvers: [sampleResolver],
      });
      const query = `query {
        normalObjectQuery {
          inlineAuthedResolvedField
        }
      }`;

      const result = await graphql(localSchema, query, {}, { user: {} });

      expect(result.data!.normalObjectQuery.inlineAuthedResolvedField).toEqual(
        "inlineAuthedResolvedField",
      );
    });
  });
});
