import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Check,
} from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import giftLottie from '../assets/home/gift-giving.lottie';
import starSparkleImg from '../assets/figma-exports/cowork-icons/star-sparkle.png';
import micIconImg from '../assets/figma-exports/cowork-icons/mic-icon.png';
import plusIconImg from '../assets/figma-exports/cowork-icons/plus-icon.png';
import chevronProjectImg from '../assets/figma-exports/cowork-icons/chevron-project.png';
import chevronAskImg from '../assets/figma-exports/cowork-icons/chevron-ask.png';
import chevronModelImg from '../assets/figma-exports/cowork-icons/chevron-model.png';
import folderProjectSvg from '../assets/figma-exports/cowork-icons/folder-project.svg';

interface CoworkPageProps {
  onStartTask: (prompt: string) => void;
}

interface ChecklistItem {
  id: string;
  title: string;
  subtitle: string;
  completed: boolean;
}

interface SelectOption {
  id: string;
  name: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'download',
    title: 'Download Cowork',
    subtitle: 'Welcome!',
    completed: true,
  },
  {
    id: 'connect-tools',
    title: 'Connect your everyday tools',
    subtitle: 'The more Claude knows your setup, the more it can do.',
    completed: true,
  },
  {
    id: 'customize-role',
    title: 'Customize Claude to your role',
    subtitle: 'Add ready-made tools and workflows.',
    completed: false,
  },
  {
    id: 'create-something',
    title: 'Ask Claude to create something',
    subtitle: 'Try a spreadsheet, doc, or presentation.',
    completed: false,
  },
  {
    id: 'schedule-task',
    title: 'Schedule a recurring task',
    subtitle: 'Great for reminders, reports, or regular check-ins.',
    completed: false,
  },
];

const PROJECT_OPTIONS: SelectOption[] = [
  { id: 'work', name: 'Work in a project' },
  { id: 'personal', name: 'Personal' },
  { id: 'research', name: 'Research' },
];

const MODEL_OPTIONS: SelectOption[] = [
  { id: 'opus-4-7', name: 'Opus 4.7' },
  { id: 'sonnet-4-5', name: 'Sonnet 4.5' },
  { id: 'haiku-4', name: 'Haiku 4' },
];

type MenuKind = 'project' | 'model' | null;

const CoworkPage: React.FC<CoworkPageProps> = ({ onStartTask }) => {
  const [draft, setDraft] = useState('');
  const [openMenu, setOpenMenu] = useState<MenuKind>(null);
  const [project, setProject] = useState<SelectOption>(PROJECT_OPTIONS[0]);
  const [model, setModel] = useState<SelectOption>(MODEL_OPTIONS[0]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const hintId = useId();

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!openMenu) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const inProject = projectRef.current?.contains(target);
      const inModel = modelRef.current?.contains(target);
      if (!inProject && !inModel) setOpenMenu(null);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const submit = useCallback(() => {
    const value = draft.trim();
    if (!value) return;
    onStartTask(value);
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.removeProperty('height');
  }, [draft, onStartTask]);

  const onTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  };

  const canSubmit = useMemo(() => draft.trim().length > 0, [draft]);

  return (
    <div className="cowork-bg flex-1 h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-6 pt-24 pb-16">
        {/* Hero */}
        <div className="mb-3 flex items-center gap-3">
          <img
            src={starSparkleImg}
            alt=""
            className="shrink-0"
            width={28}
            height={28}
            aria-hidden="true"
          />
          <h1 className="cowork-title">
            Let's knock something off your list
          </h1>
        </div>
        <div className="mb-8">
          <button
            type="button"
            className="cowork-subtitle-link"
          >
            Learn how to use Cowork safely.
          </button>
        </div>

        {/* Composer – base container with inner card */}
        <div className="cowork-composer-base rounded-[32px] border p-1.5">
          {/* Inner input card */}
          <div className="cowork-composer cowork-composer-inner rounded-[20px] p-4 pb-3">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onTextareaKeyDown}
              placeholder="How can I help you today?"
              rows={1}
              aria-label="Cowork task description"
              aria-describedby={hintId}
              className="cowork-textarea w-full resize-none border-0 bg-transparent px-1 pt-0.5 text-[17px] leading-7 text-claude-text placeholder:text-[#8E8D89] focus:outline-none"
              style={{ minHeight: 44, fontFamily: '"Anthropic Serif", Spectral, "Source Serif 4", Georgia, serif' }}
            />
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full text-claude-textSecondary transition-colors hover:bg-claude-hover hover:text-claude-text focus:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent"
                aria-label="Add attachment"
              >
                <img src={plusIconImg} alt="" width={18} height={18} />
              </button>
              {canSubmit ? (
                <button
                  type="button"
                  onClick={submit}
                  className="cowork-send flex items-center gap-1.5 rounded-[10px] px-4 py-1.5 text-[13px] font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-claude-accent"
                >
                  <span>Let's go</span>
                  <ArrowDown size={14} strokeWidth={2} />
                </button>
              ) : (
                <button
                  type="button"
                  className="flex items-center justify-center text-claude-textSecondary transition-colors hover:text-claude-text focus:outline-none"
                  aria-label="Voice input"
                >
                  <img src={micIconImg} alt="" width={14} height={18} />
                </button>
              )}
            </div>
          </div>

          {/* Bottom selector bar inside the base */}
          <div id={hintId} className="flex items-center gap-x-3 px-5 py-2.5">
            <div className="relative" ref={projectRef}>
              <button
                type="button"
                onClick={() => setOpenMenu((cur) => (cur === 'project' ? null : 'project'))}
                aria-haspopup="menu"
                aria-expanded={openMenu === 'project'}
                className="cowork-selector-btn"
              >
                <img src={folderProjectSvg} alt="" width={18} height={18} className="cowork-selector-icon" />
                <span>{project.name}</span>
                <img src={chevronProjectImg} alt="" width={10} height={8} className="opacity-60" />
              </button>
              {openMenu === 'project' && (
                <div
                  role="menu"
                  aria-label="Select project"
                  className="absolute left-0 top-full z-30 mt-1 w-[220px] rounded-xl border border-claude-border bg-claude-input py-1.5 shadow-lg"
                >
                  {PROJECT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={opt.id === project.id}
                      onClick={() => {
                        setProject(opt);
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-claude-text hover:bg-claude-hover focus:bg-claude-hover focus:outline-none"
                    >
                      <Folder size={14} strokeWidth={1.6} className="text-claude-textSecondary" />
                      {opt.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="cowork-selector-btn"
            >
              <span>Ask</span>
              <img src={chevronAskImg} alt="" width={10} height={8} className="opacity-60" />
            </button>

            <div className="ml-auto relative" ref={modelRef}>
              <button
                type="button"
                onClick={() => setOpenMenu((cur) => (cur === 'model' ? null : 'model'))}
                aria-haspopup="menu"
                aria-expanded={openMenu === 'model'}
                className="cowork-selector-btn"
              >
                <span>{model.name}</span>
                <img src={chevronModelImg} alt="" width={10} height={8} className="opacity-60" />
              </button>
              {openMenu === 'model' && (
                <div
                  role="menu"
                  aria-label="Select model"
                  className="absolute right-0 top-full z-30 mt-1 w-[200px] rounded-xl border border-claude-border bg-claude-input py-1.5 shadow-lg"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={opt.id === model.id}
                      onClick={() => {
                        setModel(opt);
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center px-3 py-2 text-left text-[13px] text-claude-text hover:bg-claude-hover focus:bg-claude-hover focus:outline-none"
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Get to know Cowork */}
        <div className="mt-14">
          <h2 className="cowork-section-title mb-4">
            Get to know Cowork
          </h2>
          <div className="space-y-0">
            {CHECKLIST_ITEMS.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-start gap-4 py-4 ${i < CHECKLIST_ITEMS.length - 1 ? 'cowork-checklist-divider' : ''}`}
              >
                <div className={`cowork-check-circle mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.completed ? 'completed' : ''}`}>
                  {item.completed && <Check size={16} strokeWidth={2.5} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[15px] font-medium ${item.completed ? 'cowork-check-title-done' : 'cowork-check-title'}`}>
                    {item.title}
                  </div>
                  <div className="cowork-check-subtitle text-[13px] mt-0.5">
                    {item.subtitle}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Guest pass */}
        <div className="mt-12">
          <div className="mb-3 text-[12px] uppercase tracking-wider text-claude-textSecondary">
            Guest pass
          </div>
          <div className="cowork-card flex items-center gap-4 rounded-2xl border px-4 py-4">
            <div className="flex h-14 w-14 items-center justify-center shrink-0">
              <DotLottieReact
                src={giftLottie}
                loop
                autoplay
                style={{ width: 48, height: 48 }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-claude-text">Gift a week of Cowork</div>
              <div className="mt-0.5 text-[12.5px] text-claude-textSecondary">
                Send a friend a free week of Cowork. If they love it and subscribe, you'll get €10 of extra usage.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoworkPage;
