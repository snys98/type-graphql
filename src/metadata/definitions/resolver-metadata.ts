import { ResolverFn } from "graphql-subscriptions";

import {
  TypeValueThunk,
  TypeOptions,
  ClassTypeResolver,
  SubscriptionFilterFunc,
  SubscriptionTopicFunc,
} from "../../decorators/types";
import { ParamMetadata } from "./param-metadata";
import { Middleware } from "../../interfaces/Middleware";
import { Complexity } from "../../interfaces";
import { DirectiveMetadata } from "./directive-metadata";
import { ShieldRule } from "graphql-shield/dist/types";

export interface BaseResolverMetadata {
  name: string;
  schemaName: string;
  target: Function;
  complexity: Complexity | undefined;
  resolverClassMetadata?: ResolverClassMetadata;
  params?: ParamMetadata[];
  rule?: ShieldRule;
  middlewares?: Array<Middleware<any>>;
  directives?: DirectiveMetadata[];
}

export interface ResolverMetadata extends BaseResolverMetadata {
  type: "Query" | "Mutation" | "Subscription";
  getReturnType: TypeValueThunk;
  returnTypeOptions: TypeOptions;
  description?: string;
  deprecationReason?: string;
}

export interface FieldResolverMetadata extends BaseResolverMetadata {
  kind: "internal" | "external";
  description?: string;
  deprecationReason?: string;
  getType?: TypeValueThunk;
  typeOptions?: TypeOptions;
  getObjectType?: ClassTypeResolver;
}

export interface SubscriptionResolverMetadata extends ResolverMetadata {
  topics: string | string[] | SubscriptionTopicFunc | undefined;
  filter: SubscriptionFilterFunc | undefined;
  subscribe: ResolverFn | undefined;
}

export interface ResolverClassMetadata {
  target: Function;
  getObjectType: ClassTypeResolver;
  isAbstract?: boolean;
  superResolver?: ResolverClassMetadata;
}
