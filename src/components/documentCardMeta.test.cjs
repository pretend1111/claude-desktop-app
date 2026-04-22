const test = require('node:test');
const assert = require('node:assert/strict');

test('document card metadata adapts subtitle to semantic file type', async () => {
  const {
    resolveDocumentFormat,
    getDocumentKindLabel,
    getDocumentSubtitle,
  } = await import('./documentCardMeta.js');

  const htmlDoc = {
    title: 'index.html',
    format: 'text',
    content: '<!DOCTYPE html><html><body>Hello</body></html>',
  };

  assert.equal(resolveDocumentFormat(htmlDoc), 'html');
  assert.equal(getDocumentKindLabel(htmlDoc), 'Artifact');
  assert.equal(getDocumentSubtitle(htmlDoc), 'Artifact · HTML');

  const markdownDoc = {
    title: 'README.md',
    format: 'markdown',
    content: '# Hello world',
  };

  assert.equal(resolveDocumentFormat(markdownDoc), 'markdown');
  assert.equal(getDocumentKindLabel(markdownDoc), 'Document');
  assert.equal(getDocumentSubtitle(markdownDoc), 'Document · MARKDOWN');

  const jsonDoc = {
    title: 'schema.json',
    format: 'text',
    content: '{"name":"demo"}',
  };

  assert.equal(resolveDocumentFormat(jsonDoc), 'json');
  assert.equal(getDocumentKindLabel(jsonDoc), 'Data');
  assert.equal(getDocumentSubtitle(jsonDoc), 'Data · JSON');
});
