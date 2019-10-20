import { ShieldRule } from "graphql-shield/dist/types";

export interface AuthorizedMetadata {
  target: Function;
  fieldName: string;
  rule: ShieldRule;
}
