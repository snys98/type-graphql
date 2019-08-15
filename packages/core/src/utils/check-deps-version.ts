interface PackageJSON {
  name: string;
  version: string;
  peerDependencies: Record<string, string>;
}

/**
 * Internal TypeGraphQL function for checking monorepo packages versions.
 * Do not use it for your own purposes as it's not a part of a supported public API.
 */
export function ensureInstalledCorrectTypeGraphQLPackagesVersion(
  checkedPackage: PackageJSON,
  getPackageJSON: (packageName: string) => PackageJSON,
): void {
  Object.keys(checkedPackage.peerDependencies).forEach(packageName => {
    if (packageName.startsWith("@typegraphql/")) {
      const packageVersion = getPackageJSON(packageName).version;
      if (packageVersion !== checkedPackage.version) {
        console.warn(
          "\x1b[33m%s\x1b[0m",
          `[TypeGraphQL] Wrong version of '${packageName}' package ` +
            `has been detected. '${checkedPackage.name}' requires ` +
            `'v${checkedPackage.version}' but 'v${packageVersion}' ` +
            `is installed. \nMake sure your dependencies are in correct ` +
            `versions and run 'npm dedupe' or yarn's equivalent.\n`,
        );
      }
    }
  });
}
