import { foobar } from "@typegraphql/class-validator";

import help from "@tests/helpers/help";

describe("foobar", () => {
  it("should return 'foobar'", () => {
    const result = foobar();
    help();

    expect(result).toBe("foobar");
  });
});
