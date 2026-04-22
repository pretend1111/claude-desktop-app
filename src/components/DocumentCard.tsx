import React from 'react';
import { Download } from 'lucide-react';
import { getDocumentSubtitle, resolveDocumentFormat } from './documentCardMeta.js';

export interface SlideInfo {
  title: string;
  content: string;
  notes?: string;
  layout?: 'cover' | 'section' | 'content' | 'two_column' | 'summary';
  left_content?: string;
  right_content?: string;
}

export interface SheetInfo {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

export interface PdfSection {
  type: 'heading' | 'paragraph' | 'table' | 'list' | 'pagebreak';
  content?: string | string[];
  level?: number;
  headers?: string[];
  rows?: (string | number | null)[][];
  ordered?: boolean;
}

export interface DocumentInfo {
  id: string;
  title: string;
  filename: string;
  url: string;
  content?: string;
  format?: string;
  slides?: SlideInfo[];
  sheets?: SheetInfo[];
  sections?: PdfSection[];
  colorScheme?: string;
}

interface DocumentCardProps {
  document: DocumentInfo;
  onOpen: (document: DocumentInfo) => void;
  stackedPreview?: boolean;
}

const FIGMA_CARD_HEIGHT = 82;

const SINGLE_PREVIEW_GEOMETRY = {
  viewportWidth: 108.335,
  right: 60.215,
  top: 10.64,
  frameSize: 108.335,
  cardSize: 100,
  paddingX: 8,
  paddingTop: 9,
  paddingBottom: 8,
  textPaddingRight: 188,
} as const;

const STACKED_PREVIEW_GEOMETRY = {
  viewportWidth: 92,
  right: 10,
  top: 8,
  frameSize: 92,
  cardSize: 84,
  paddingX: 7,
  paddingTop: 7,
  paddingBottom: 7,
  textPaddingRight: 148,
} as const;

const buildPreviewLines = (document: DocumentInfo) => {
  const format = resolveDocumentFormat(document);
  const content = String(document.content || '').replace(/\r\n/g, '\n');
  let raw: string[] = [];

  if (format === 'html') {
    const extracted = content
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<\/(h1|h2|h3|p|li|title)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ');

    raw = extracted
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  } else {
    raw = content
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  }

  if (raw.length === 0) {
    return [document.title, getDocumentSubtitle(document), 'Preview unavailable'];
  }

  return raw.slice(0, 4).map(line => (line.length > 92 ? `${line.slice(0, 92)}…` : line));
};

const DocumentPreviewCard: React.FC<{ document: DocumentInfo; stackedPreview: boolean }> = ({ document, stackedPreview }) => {
  const lines = buildPreviewLines(document);
  const geometry = stackedPreview ? STACKED_PREVIEW_GEOMETRY : SINGLE_PREVIEW_GEOMETRY;
  const previewViewportClass = 'absolute top-0 hidden h-full overflow-hidden md:block';
  const previewCardClass = 'overflow-hidden rounded-[8px] border border-[#C5C4C3] bg-white shadow-[2px_2px_2px_rgba(0,0,0,0.05)]';
  const previewFrameClass = 'absolute right-0 flex items-center justify-center rotate-[5deg]';

  return (
    <div
      className={`pointer-events-none ${previewViewportClass}`}
      style={{
        width: `${geometry.viewportWidth}px`,
        right: `${geometry.right}px`,
      }}
    >
      <div
        className={previewFrameClass}
        style={{
          top: `${geometry.top}px`,
          width: `${geometry.frameSize}px`,
          height: `${geometry.frameSize}px`,
        }}
      >
        <div
          className={previewCardClass}
          style={{
            width: `${geometry.cardSize}px`,
            height: `${geometry.cardSize}px`,
            padding: `${geometry.paddingTop}px ${geometry.paddingX}px ${geometry.paddingBottom}px`,
          }}
        >
          <div className="space-y-0 whitespace-pre-wrap text-[5px] leading-[1.6] tracking-[-0.3px] text-[#9F9E9B]">
            {lines.map((line, index) => (
              <p key={`${document.id}-preview-${index}`} className="overflow-hidden">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DocumentCard: React.FC<DocumentCardProps> = ({ document, onOpen, stackedPreview = false }) => {
  const fmt = resolveDocumentFormat(document);
  const subtitle = getDocumentSubtitle(document);
  const geometry = stackedPreview ? STACKED_PREVIEW_GEOMETRY : SINGLE_PREVIEW_GEOMETRY;
  const textPaddingClass = 'pr-[104px]';

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const binaryFormats = ['docx', 'pptx', 'xlsx', 'pdf'];
    if (!binaryFormats.includes(fmt)) {
      // Text-based: markdown or code files — download from content
      const langToExt: Record<string, string> = {
        markdown: 'md', python: 'py', javascript: 'js', typescript: 'ts',
        java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs',
        go: 'go', rust: 'rs', ruby: 'rb', php: 'php',
        swift: 'swift', kotlin: 'kt', scala: 'scala',
        html: 'html', css: 'css', scss: 'scss',
        sql: 'sql', shell: 'sh', bash: 'sh', powershell: 'ps1',
        yaml: 'yml', json: 'json', xml: 'xml', toml: 'toml',
        ini: 'ini', dockerfile: 'Dockerfile',
        r: 'r', matlab: 'm', lua: 'lua', perl: 'pl',
        dart: 'dart', vue: 'vue', svelte: 'svelte',
      };
      const ext = langToExt[fmt] || fmt;
      const blob = new Blob([document.content || ''], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.title.includes('.') ? document.title : `${document.title}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const extMap: Record<string, string> = { docx: '.docx', pptx: '.pptx', xlsx: '.xlsx', pdf: '.pdf' };
      const ext = extMap[fmt] || '.bin';
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/documents/${document.id}/raw`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `${document.title}${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // silent fail
      }
    }
  };

  return (
    <div
      onClick={() => onOpen(document)}
      className="group/card relative flex h-[82px] w-full cursor-pointer select-none items-center rounded-[12px] border border-claude-border bg-transparent px-[16px] transition-all hover:bg-[#FDFCFA] hover:border-[#D5D2CA] dark:hover:bg-[#2A2A28] dark:hover:border-[#40403E]"
    >
      <div className="relative min-w-0 flex-1 h-full overflow-hidden">
        <div className={`${textPaddingClass} flex h-full flex-col justify-center`} style={{ paddingRight: `${geometry.textPaddingRight}px` }}>
          <h3 className="truncate text-[14px] leading-[1.6] text-claude-text font-[400]">
            {document.title}
          </h3>
          <p className="truncate text-[14px] leading-[1.6] text-claude-textSecondary font-[400]">
            {subtitle}
          </p>
        </div>

        <DocumentPreviewCard document={document} stackedPreview={stackedPreview} />
      </div>

      <div className="absolute right-[6px] top-1/2 flex -translate-y-1/2 items-center gap-2 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100" onClick={e => e.stopPropagation()}>
        <button
          onClick={handleDownload}
          className="rounded-lg p-2 text-claude-textSecondary transition-colors hover:bg-claude-btn-hover hover:text-claude-text"
          title="Download"
        >
          <Download size={16} strokeWidth={1.9} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(DocumentCard);
