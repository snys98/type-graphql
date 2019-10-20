import { getMetadataStorage } from "../metadata/getMetadataStorage";
import { SymbolKeysNotSupportedError, ForbiddenError } from "../errors";
import { MethodAndPropDecorator } from "./types";
import { ShieldRule } from "graphql-shield/dist/types";
import { rule as ruleFunc, and } from "graphql-shield";

export const defaultAuthRule = ruleFunc({ cache: "contextual" })(
  async (parent, args, ctx, info) => {
    return ctx.user !== undefined;
  },
);

export function Authorized(rule: ShieldRule = defaultAuthRule): MethodAndPropDecorator {
  return (prototype: any, propertyKey: any) => {
    if (typeof propertyKey === "symbol") {
      throw new SymbolKeysNotSupportedError();
    }

    getMetadataStorage().collectAuthorizedFieldMetadata({
      target: prototype.constructor,
      fieldName: propertyKey,
      rule: rule!,
    });
  };
}
