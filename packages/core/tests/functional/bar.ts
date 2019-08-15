import { bar } from "@typegraphql/core";

describe("bar", () => {
  it("should return 'bar'", () => {
    const result = bar();

    expect(result).toBe("bar");
  });
});
