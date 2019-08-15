import { foo, bar } from "@typegraphql/core";

export default function foobar(): string {
  return `${foo()}${bar()}`;
}
