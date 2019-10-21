import { astFromValue } from "graphql";
import { print } from "graphql/language";
import { GraphQLSchema } from "graphql";
import {
  GraphQLNamedType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLInputObjectType,
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
} from "graphql";
import { GraphQLString, isSpecifiedScalarType } from "graphql";
import { GraphQLDirective, DEFAULT_DEPRECATION_REASON, isSpecifiedDirective } from "graphql";
import { isIntrospectionType } from "graphql";

interface Options {
  /**
   * Descriptions are defined as preceding string literals, however an older
   * experimental version of the SDL supported preceding comments as
   * descriptions. Set to true to enable this deprecated behavior.
   * This option is provided to ease adoption and will be removed in v16.
   *
   * Default: false
   */
  commentDescriptions?: boolean;
}

/**
 * Print a block string in the indented block form by adding a leading and
 * trailing blank line. However, if a block string starts with whitespace and is
 * a single-line, adding a leading blank line would strip that whitespace.
 */
export function printBlockString(
  value: string,
  indentation: string = "",
  preferMultipleLines: boolean = false,
): string {
  const isSingleLine = value.indexOf("\n") === -1;
  const hasLeadingSpace = value[0] === " " || value[0] === "\t";
  const hasTrailingQuote = value[value.length - 1] === '"';
  const printAsMultipleLines = !isSingleLine || hasTrailingQuote || preferMultipleLines;

  let result = "";
  // Format a multi-line block quote to account for leading space.
  if (printAsMultipleLines && !(isSingleLine && hasLeadingSpace)) {
    result += "\n" + indentation;
  }
  result += indentation ? value.replace(/\n/g, "\n" + indentation) : value;
  if (printAsMultipleLines) {
    result += "\n";
  }

  return '"""' + result.replace(/"""/g, '\\"""') + '"""';
}

/**
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
export function printSchemaWithDirectives(schema: GraphQLSchema, options?: Options): string {
  return printFilteredSchema(schema, n => !isSpecifiedDirective(n), isDefinedType, options);
}

export function printIntrospectionSchema(schema: GraphQLSchema, options?: Options): string {
  return printFilteredSchema(schema, isSpecifiedDirective, isIntrospectionType, options);
}

function isDefinedType(type: GraphQLNamedType): boolean {
  return !isSpecifiedScalarType(type as any) && !isIntrospectionType(type);
}

function printFilteredSchema(
  schema: GraphQLSchema,
  directiveFilter: (type: GraphQLDirective) => boolean,
  typeFilter: (type: GraphQLNamedType) => boolean,
  options: any,
): string {
  const directives = schema.getDirectives().filter(directiveFilter);
  const typeMap = schema.getTypeMap();
  const types = Object.values(typeMap)
    .sort((type1, type2) => type1.name.localeCompare(type2.name))
    .filter(typeFilter);

  return (
    [printSchemaDefinition(schema)]
      .concat(
        directives.map(directive => printDirective(directive, options)),
        types.map(type => printType(type, options)),
      )
      .filter(Boolean)
      .join("\n\n") + "\n"
  );
}

function printSchemaDefinition(schema: GraphQLSchema): string | void {
  if (isSchemaOfCommonNames(schema)) {
    return;
  }

  const operationTypes = [];

  const queryType = schema.getQueryType();
  if (queryType) {
    operationTypes.push(`  query: ${queryType.name}`);
  }

  const mutationType = schema.getMutationType();
  if (mutationType) {
    operationTypes.push(`  mutation: ${mutationType.name}`);
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType) {
    operationTypes.push(`  subscription: ${subscriptionType.name}`);
  }

  return `schema {\n${operationTypes.join("\n")}\n}`;
}

/**
 * GraphQL schema define root types for each type of operation. These types are
 * the same as any other type and can be named in any manner, however there is
 * a common naming convention:
 *
 *   schema {
 *     query: Query
 *     mutation: Mutation
 *   }
 *
 * When using this naming convention, the schema description can be omitted.
 */
function isSchemaOfCommonNames(schema: GraphQLSchema): boolean {
  const queryType = schema.getQueryType();
  if (queryType && queryType.name !== "Query") {
    return false;
  }

  const mutationType = schema.getMutationType();
  if (mutationType && mutationType.name !== "Mutation") {
    return false;
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && subscriptionType.name !== "Subscription") {
    return false;
  }

  return true;
}

export function printType(type: GraphQLNamedType, options?: Options): string {
  if (isScalarType(type)) {
    return printScalar(type, options);
  } else if (isObjectType(type)) {
    return printObject(type, options);
  } else if (isInterfaceType(type)) {
    return printInterface(type, options);
  } else if (isUnionType(type)) {
    return printUnion(type, options);
  } else if (isEnumType(type)) {
    return printEnum(type, options);
  } else if (isInputObjectType(type)) {
    return printInputObject(type, options);
  }

  // Not reachable. All possible types have been considered.
  /* istanbul ignore next */
  throw new Error(`Unexpected type: "------------------".`);
}

function printScalar(type: GraphQLScalarType, options: any): string {
  return printDescription(options, type) + `scalar ${type.name}`;
}

function printObject(type: GraphQLObjectType, options: any): string {
  const interfaces = type.getInterfaces();
  const implementedInterfaces = interfaces.length
    ? " implements " + interfaces.map(i => i.name).join(" & ")
    : "";
  return (
    printDescription(options, type) +
    `type ${type.name}${implementedInterfaces}` +
    printFields(options, type)
  );
}

function printInterface(type: GraphQLInterfaceType, options: any): string {
  return printDescription(options, type) + `interface ${type.name}` + printFields(options, type);
}

function printUnion(type: GraphQLUnionType, options: any): string {
  const types = type.getTypes();
  const possibleTypes = types.length ? " = " + types.join(" | ") : "";
  return printDescription(options, type) + "union " + type.name + possibleTypes;
}

function printEnum(type: GraphQLEnumType, options: any): string {
  const values = type
    .getValues()
    .map(
      (value, i) =>
        printDescription(options, value, "  ", !i) + "  " + value.name + printDeprecated(value),
    );

  return printDescription(options, type) + `enum ${type.name}` + printBlock(values);
}

function printInputObject(type: GraphQLInputObjectType, options: any): string {
  const fields = Object.values(type.getFields()).map(
    (f, i) => printDescription(options, f, "  ", !i) + "  " + printInputValue(f),
  );
  return printDescription(options, type) + `input ${type.name}` + printBlock(fields);
}

function printFields(options: any, type: any) {
  const fields = Object.values(type.getFields() as any[]).map(
    (f, i) =>
      printDescription(options, f, "  ", !i) +
      "  " +
      f.name +
      printArgs(options, f.args, "  ") +
      ": " +
      String(f.type) +
      printDeprecated(f) +
      printFieldDirectives(f),
  );
  return printBlock(fields);
}

function printFieldDirectives(field: any) {
  const directives = field.astNode && field.astNode.directives;
  if (directives === undefined) {
    return "";
  }

  return (
    directives &&
    directives.map((d: any) => " " + "@" + d.name.value + printFieldDirectiveArgs(d.arguments))
  );
}

function printFieldDirectiveArgs(args: any) {
  const printArg = (arg: any) => arg.name.value + ": " + print(arg.value);
  return args && args.length
    ? "(" +
        args.slice(1).reduce((acc: any, cur: any) => acc + "," + printArg(cur), printArg(args[0])) +
        ")"
    : "";
}

function printBlock(items: any) {
  return items.length !== 0 ? " {\n" + items.join("\n") + "\n}" : "";
}

function printArgs(options: any, args: any, indentation = "") {
  if (args.length === 0) {
    return "";
  }

  // If every arg does not have a description, print them on one line.

  if (args.every((arg: { description: any }) => !arg.description)) {
    return "(" + args.map(printInputValue).join(", ") + ")";
  }

  return (
    "(\n" +
    args
      .map(
        (arg: any, i: any) =>
          printDescription(options, arg, "  " + indentation, !i) +
          "  " +
          indentation +
          printInputValue(arg),
      )
      .join("\n") +
    "\n" +
    indentation +
    ")"
  );
}

function printInputValue(arg: any) {
  const defaultAST = astFromValue(arg.defaultValue, arg.type);
  let argDecl = arg.name + ": " + String(arg.type);
  if (defaultAST) {
    argDecl += ` = ${print(defaultAST)}`;
  }
  return argDecl;
}

function printDirective(directive: any, options: any) {
  return (
    printDescription(options, directive) +
    "directive @" +
    directive.name +
    printArgs(options, directive.args) +
    " on " +
    directive.locations.join(" | ")
  );
}

function printDeprecated(fieldOrEnumVal: any) {
  if (!fieldOrEnumVal.isDeprecated) {
    return "";
  }
  const reason = fieldOrEnumVal.deprecationReason;
  const reasonAST = astFromValue(reason, GraphQLString);
  if (reasonAST && reason !== "" && reason !== DEFAULT_DEPRECATION_REASON) {
    return " @deprecated(reason: " + print(reasonAST) + ")";
  }
  return " @deprecated";
}

function printDescription(options: any, def: any, indentation = "", firstInBlock = true): string {
  if (!def.description) {
    return "";
  }

  const lines = descriptionLines(def.description, 120 - indentation.length);
  if (options && options.commentDescriptions) {
    return printDescriptionWithComments(lines, indentation, firstInBlock);
  }

  const text = lines.join("\n");
  const preferMultipleLines = text.length > 70;
  const blockString = printBlockString(text, "", preferMultipleLines);
  const prefix = indentation && !firstInBlock ? "\n" + indentation : indentation;

  return prefix + blockString.replace(/\n/g, "\n" + indentation) + "\n";
}

function printDescriptionWithComments(lines: any, indentation: any, firstInBlock: any) {
  let description = indentation && !firstInBlock ? "\n" : "";
  for (const line of lines) {
    if (line === "") {
      description += indentation + "#\n";
    } else {
      description += indentation + "# " + line + "\n";
    }
  }
  return description;
}

function descriptionLines(description: string, maxLen: number): string[] {
  const rawLines = description.split("\n");
  return rawLines.flatMap(line => {
    if (line.length < maxLen + 5) {
      return line;
    }
    // For > 120 character long lines, cut at space boundaries into sublines
    // of ~80 chars.
    return breakLine(line, maxLen);
  });
}

function breakLine(line: string, maxLen: number): string[] {
  const parts = line.split(new RegExp(`((?: |^).{15,${maxLen - 40}}(?= |$))`));
  if (parts.length < 4) {
    return [line];
  }
  const sublines = [parts[0] + parts[1] + parts[2]];
  for (let i = 3; i < parts.length; i += 2) {
    sublines.push(parts[i].slice(1) + parts[i + 1]);
  }
  return sublines;
}
