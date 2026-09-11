import { inspectAllPackages } from './validate-all-content';

try {
  const report = await inspectAllPackages();
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
