const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(__dirname, '../../.github/workflows/build-claudedesktop.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

test('desktop cloud packaging workflow covers all requested platforms', () => {
  assert.match(workflow, /working-directory:\s+Claudedesktop/);
  assert.match(workflow, /macos-15-intel/);
  assert.match(workflow, /macos-14/);
  assert.match(workflow, /windows-2022/);
  assert.match(workflow, /windows-11-arm/);
  assert.match(workflow, /ubuntu-24\.04/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});
