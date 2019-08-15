module.exports = {
  verbose: false,
  testEnvironment: "node",
  preset: "ts-jest",
  testMatch: [
    "<rootDir>/tests/functional/**/*.ts",
    "<rootDir>/tests/unit/**/*.ts",
  ],
  rootDir: "./",
  globals: {
    "ts-jest": {
      tsConfig: "<rootDir>/tests/tsconfig.json",
      compiler: "ttypescript",
    },
  },
  collectCoverage: false,
  coverageDirectory: "<rootDir>/coverage",
  collectCoverageFrom: ["<rootDir>/src/**/*.ts", "!<rootDir>/src/**/*.d.ts"],
};
