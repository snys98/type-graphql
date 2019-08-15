import { foo } from "@typegraphql/core";

import help from "@tests/helpers/help";

describe("foo", () => {
  it("should return 'foo'", () => {
    const result = foo();
    help();

    expect(result).toBe("foo");
  });
});
