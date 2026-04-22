const GENERIC_FORMATS = new Set(['', 'text', 'plain', 'plaintext', 'document', 'file']);

const EXTENSION_TO_FORMAT = {
  md: 'markdown',
  markdown: 'markdown',
  txt: 'text',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  js: 'javascript',
  cjs: 'javascript',
  mjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  csv: 'csv',
  sql: 'sql',
  py: 'python',
  rb: 'ruby',
  php: 'php',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  cs: 'csharp',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  vue: 'vue',
  svelte: 'svelte',
  toml: 'toml',
  ini: 'ini',
  dockerfile: 'dockerfile',
  docx: 'docx',
  pdf: 'pdf',
  pptx: 'pptx',
  xlsx: 'xlsx',
};

const FORMAT_DISPLAY = {
  markdown: 'MARKDOWN',
  text: 'TEXT',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  javascript: 'JAVASCRIPT',
  jsx: 'REACT JSX',
  typescript: 'TYPESCRIPT',
  tsx: 'REACT TSX',
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  csv: 'CSV',
  sql: 'SQL',
  python: 'PYTHON',
  ruby: 'RUBY',
  php: 'PHP',
  go: 'GO',
  rust: 'RUST',
  java: 'JAVA',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  shell: 'SHELL',
  powershell: 'POWERSHELL',
  vue: 'VUE',
  svelte: 'SVELTE',
  toml: 'TOML',
  ini: 'INI',
  dockerfile: 'DOCKERFILE',
  docx: 'DOCX',
  pdf: 'PDF',
  pptx: 'PPTX',
  xlsx: 'XLSX',
};

const DOCUMENT_KINDS = new Set(['markdown', 'text', 'docx', 'pdf']);
const DATA_KINDS = new Set(['json', 'yaml', 'xml', 'csv', 'xlsx', 'toml', 'ini']);
const ARTIFACT_KINDS = new Set(['html', 'css', 'scss', 'jsx', 'tsx', 'vue', 'svelte']);

function getFilename(document = {}) {
  return String(document.filename || document.title || '').trim();
}

function getContent(document = {}) {
  return String(document.content || document.preview || '');
}

function getExtension(filename) {
  if (!filename) return '';
  const normalized = filename.trim().toLowerCase();
  if (normalized === 'dockerfile') return 'dockerfile';
  const match = normalized.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function looksLikeJson(content) {
  if (!content) return false;
  const trimmed = content.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function inferFormatFromContent(content) {
  const trimmed = String(content || '').trimStart();
  const lower = trimmed.slice(0, 240).toLowerCase();

  if (!trimmed) return '';
  if (lower.startsWith('<!doctype html') || lower.startsWith('<html')) return 'html';
  if (lower.startsWith('<?xml')) return 'xml';
  if (looksLikeJson(trimmed)) return 'json';
  if (/^---\s*$[\s\S]*?^---\s*$/m.test(trimmed) || /^([A-Za-z0-9_-]+):\s.+$/m.test(trimmed)) return 'yaml';
  if (/^#\s+\S/m.test(trimmed) || /^[-*]\s+\S/m.test(trimmed) || /\[[^\]]+\]\([^)]+\)/.test(trimmed)) return 'markdown';
  return '';
}

export function normalizeGeneratedDocumentFormat(filename = '', content = '') {
  const ext = getExtension(filename);
  return EXTENSION_TO_FORMAT[ext] || inferFormatFromContent(content) || 'text';
}

export function resolveDocumentFormat(document = {}) {
  const rawFormat = String(document.format || '').trim().toLowerCase();
  if (rawFormat && !GENERIC_FORMATS.has(rawFormat)) {
    return EXTENSION_TO_FORMAT[rawFormat] || rawFormat;
  }

  return normalizeGeneratedDocumentFormat(getFilename(document), getContent(document));
}

export function getDocumentKindLabel(document = {}) {
  const format = resolveDocumentFormat(document);
  if (DATA_KINDS.has(format)) return 'Data';
  if (ARTIFACT_KINDS.has(format)) return 'Artifact';
  if (DOCUMENT_KINDS.has(format)) return 'Document';
  return 'Code';
}

export function getDocumentFormatBadge(document = {}) {
  const format = resolveDocumentFormat(document);
  return FORMAT_DISPLAY[format] || format.toUpperCase();
}

export function getDocumentSubtitle(document = {}) {
  return `${getDocumentKindLabel(document)} · ${getDocumentFormatBadge(document)}`;
}
