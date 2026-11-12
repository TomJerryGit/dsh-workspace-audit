// Fixture source with a TODO and a dangerous pattern for the audit test.
const childProcess = require('node:child_process');
function run(command) {
  return childProcess.exec(command);
}
// TODO: replace with execFile
module.exports = run;
