# Lint tooling

Run `npm ci --prefix tools/eslint` after the application's `npm ci`, then run `npm run lint` from the repository root.

This isolated toolchain lets typescript-eslint use its supported TypeScript 6 parser while the application retains TypeScript 7 for builds. Both dependency trees are locked; neither force installs nor ignored peer-dependency checks are needed.

ESLint checks current application code, admin scripts, tests and configuration. Retired code under `archive`, generated output and dependencies are ignored. Recommended JavaScript/TypeScript checks and React hook rules are enabled; any error or warning fails lint. The GitHub workflow uses the same command and also uploads SARIF code-scanning results when a report was produced.
