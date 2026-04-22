const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const documentCardSource = fs.readFileSync(path.join(__dirname, 'DocumentCard.tsx'), 'utf8');
const documentCreationSource = fs.readFileSync(path.join(__dirname, 'DocumentCreationProcess.tsx'), 'utf8');
const mainContentSource = fs.readFileSync(path.join(__dirname, 'MainContent.tsx'), 'utf8');

test('document presentation components use shared metadata helpers', () => {
  assert.match(
    documentCardSource,
    /getDocumentSubtitle/,
    'DocumentCard should use shared subtitle metadata rather than hardcoding Document · FORMAT'
  );

  assert.match(
    documentCardSource,
    /previewViewportClass/,
    'DocumentCard should define a dedicated preview viewport so single-card previews can be clipped like the Figma design'
  );

  assert.match(
    documentCardSource,
    /relative min-w-0 flex-1 h-full overflow-hidden/,
    'DocumentCard should use a full-height clipped info container so the preview paper is cropped by the full card, not just the text block'
  );

  assert.match(
    documentCardSource,
    /flex h-full flex-col justify-center/,
    'DocumentCard should vertically center the text block inside the fixed-height card to avoid extra blank space at the bottom'
  );

  assert.match(
    documentCreationSource,
    /getDocumentKindLabel/,
    'DocumentCreationProcess should use shared semantic kind labels for the generating indicator'
  );

  assert.match(
    mainContentSource,
    /normalizeGeneratedDocumentFormat/,
    'MainContent should preserve file-specific formats when building write-tool document cards'
  );
});
