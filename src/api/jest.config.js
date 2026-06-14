/** @type {import('jest').Config} */
// Default config = unit tests. Integration/E2E use their own configs:
//   jest --config ./test/jest-integration.json
//   jest --config ./test/jest-e2e.json
module.exports = require("./test/jest-unit.json");
