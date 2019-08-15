/* eslint-disable @typescript-eslint/no-var-requires */
import { ensureInstalledCorrectTypeGraphQLPackagesVersion } from "@typegraphql/core";
ensureInstalledCorrectTypeGraphQLPackagesVersion(
  require("../package.json"),
  packageName => require(`${packageName}/package.json`),
);
