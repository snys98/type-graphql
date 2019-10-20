import { ParamMetadata } from "./param-metadata";
import { TypeValueThunk, TypeOptions } from "../../decorators/types";
import { Middleware } from "../../interfaces/Middleware";
import { Complexity } from "../../interfaces";
import { ShieldRule } from "graphql-shield/dist/types";

export interface FieldMetadata {
  target: Function;
  schemaName: string;
  name: string;
  getType: TypeValueThunk;
  typeOptions: TypeOptions;
  description: string | undefined;
  deprecationReason: string | undefined;
  complexity: Complexity | undefined;
  params?: ParamMetadata[];
  rule?: ShieldRule;
  middlewares?: Array<Middleware<any>>;
}
