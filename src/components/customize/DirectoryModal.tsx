import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Folder,
  LayoutGrid,
  Plus,
  Search,
  WandSparkles,
} from 'lucide-react';
import {
  DirectoryNavIcon,
  DirectoryPluginIcon,
  DirectoryUtilityIcon,
  type DirectoryPluginIconKey,
} from './DirectoryIcons';

export type DirectorySection = 'skills' | 'connectors' | 'plugins';
export type ConnectorAction = 'github' | 'gdrive';

interface DirectoryModalProps {
  initialSection?: DirectorySection;
  isGithubConnected: boolean;
  onClose: () => void;
  onOpenConnector: (connector: ConnectorAction) => void;
  onOpenSkills: () => void;
}

type ConnectorIconKey =
  | 'filesystem'
  | 'pdf'
  | 'powerpoint'
  | 'word'
  | 'chrome'
  | 'apify'
  | 'massive'
  | 'figma'
  | 'github'
  | 'gdrive';

interface ConnectorDirectoryCard {
  action?: ConnectorAction;
  description: string;
  icon: ConnectorIconKey;
  id: string;
  label: string;
  title: string;
}

interface PluginDirectoryCard {
  description: string;
  downloads: string;
  icon: DirectoryPluginIconKey;
  id: string;
  provider: string;
  title: string;
}

interface DirectoryTabButtonProps {
  icon: React.ReactNode;
  isActive: boolean;
  label: string;
  onClick: () => void;
}

interface ConnectorCardProps {
  card: ConnectorDirectoryCard;
  onSelect: (card: ConnectorDirectoryCard) => void;
}

interface PluginCardProps {
  card: PluginDirectoryCard;
}

const connectorCards: ConnectorDirectoryCard[] = [
  {
    id: 'filesystem',
    title: 'Filesystem',
    label: 'Most popular',
    description: 'Let Claude access your filesystem to read and write files.',
    icon: 'filesystem',
  },
  {
    id: 'pdf-viewer',
    title: 'pdf-viewer',
    label: '#2 popular',
    description: 'Read, annotate, and interact with PDF files — interactive viewer with search, navigation, annotations, form filling, and more.',
    icon: 'pdf',
  },
  {
    id: 'powerpoint',
    title: 'PowerPoint (By Anthropic)',
    label: '#3 popular',
    description: 'Control Microsoft PowerPoint with AppleScript automation.',
    icon: 'powerpoint',
  },
  {
    id: 'word',
    title: 'Word (By Anthropic)',
    label: '#4 popular',
    description: 'Control Microsoft Word with AppleScript automation.',
    icon: 'word',
  },
  {
    id: 'chrome',
    title: 'Control Chrome',
    label: '#5 popular',
    description: 'Control Google Chrome browser tabs, windows, and navigation.',
    icon: 'chrome',
  },
  {
    id: 'apify',
    title: 'Apify',
    label: '#6 popular',
    description: 'Extract data from any website with thousands of scrapers, crawlers, and automations on Apify Store.',
    icon: 'apify',
  },
  {
    id: 'massive',
    title: 'Massive Market Data',
    label: '#7 popular',
    description: 'Stocks, options and indices market data via Massive.com financial data API. Access real-time and historical prices.',
    icon: 'massive',
  },
  {
    id: 'figma',
    title: 'Figma',
    label: '#8 popular',
    description: 'The Figma MCP server helps you pull in Figma context and generate high-quality code that aligns with your designs.',
    icon: 'figma',
  },
  {
    id: 'github',
    title: 'GitHub Integration',
    label: 'Built in',
    description: 'Connect Claude to your repositories, pull requests, and project context.',
    icon: 'github',
    action: 'github',
  },
  {
    id: 'gdrive',
    title: 'Google Drive',
    label: 'Coming soon',
    description: 'Browse and reference files from your Google Drive workspace.',
    icon: 'gdrive',
    action: 'gdrive',
  },
];

const pluginCards: PluginDirectoryCard[] = [
  {
    id: 'productivity',
    title: 'Productivity',
    provider: 'Anthropic',
    downloads: '604.1K',
    description: 'Manage tasks, plan your day, and build up memory of important context about your work. Syncs with your daily workflow.',
    icon: 'productivity',
  },
  {
    id: 'design',
    title: 'Design',
    provider: 'Anthropic',
    downloads: '550.2K',
    description: 'Accelerate design workflows — critique, design system management, UX writing, accessibility audits, and research.',
    icon: 'design',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    provider: 'Anthropic',
    downloads: '463.6K',
    description: 'Create content, plan campaigns, and analyze performance across marketing channels. Maintain brand consistency faster.',
    icon: 'marketing',
  },
  {
    id: 'data',
    title: 'Data',
    provider: 'Anthropic',
    downloads: '447.2K',
    description: 'Write SQL, explore datasets, and generate insights faster. Build visualizations and dashboards, and turn raw data into action.',
    icon: 'data',
  },
  {
    id: 'engineering',
    title: 'Engineering',
    provider: 'Anthropic',
    downloads: '431.3K',
    description: 'Streamline engineering workflows — standups, code review, architecture decisions, incident response, and documentation.',
    icon: 'engineering',
  },
  {
    id: 'finance',
    title: 'Finance',
    provider: 'Anthropic',
    downloads: '379.8K',
    description: 'Streamline finance and accounting workflows, from journal entries and reconciliation to financial statement support.',
    icon: 'finance',
  },
  {
    id: 'product-management',
    title: 'Product management',
    provider: 'Anthropic',
    downloads: '355.7K',
    description: 'Write feature specs, plan roadmaps, and synthesize user research faster. Keep stakeholders aligned and moving.',
    icon: 'product-management',
  },
  {
    id: 'operations',
    title: 'Operations',
    provider: 'Anthropic',
    downloads: '330.5K',
    description: 'Optimize business operations — vendor management, process documentation, change management, capacity planning, and more.',
    icon: 'operations',
  },
  {
    id: 'enterprise-search',
    title: 'Enterprise search',
    provider: 'Anthropic',
    downloads: '219.4K',
    description: 'Search across all of your company\'s tools in one place so answers are easier to find and easier to trust.',
    icon: 'enterprise-search',
  },
  {
    id: 'human-resources',
    title: 'Human resources',
    provider: 'Anthropic',
    downloads: '183.1K',
    description: 'Streamline people operations — recruiting, onboarding, performance reviews, internal policies, and employee support.',
    icon: 'human-resources',
  },
  {
    id: 'pdf-plugin',
    title: 'Pdf viewer',
    provider: 'Anthropic',
    downloads: '179.9K',
    description: 'View, annotate, and sign PDFs in a live interactive viewer with search, navigation, and form support.',
    icon: 'pdf-viewer',
  },
  {
    id: 'customer-support',
    title: 'Customer support',
    provider: 'Anthropic',
    downloads: '160.6K',
    description: 'Triage tickets, draft responses, escalate issues, and keep support teams aligned across channels.',
    icon: 'customer-support',
  },
  {
    id: 'apollo',
    title: 'Apollo',
    provider: 'Apollo.io',
    downloads: '115.3K',
    description: 'Prospect, enrich leads, and load outreach sequences faster with Apollo context directly in Claude.',
    icon: 'apollo',
  },
  {
    id: 'slack-salesforce',
    title: 'Slack by salesforce',
    provider: 'Salesforce',
    downloads: '114.2K',
    description: 'Slack integration for searching messages, sending communications, managing canvases, and more.',
    icon: 'slack',
  },
  {
    id: 'common-room',
    title: 'Common room',
    provider: 'Common Room',
    downloads: '107.5K',
    description: 'Turn Common Room into your GTM copilot. Research accounts and contacts, prep for calls, and draft personalized outreach.',
    icon: 'common-room',
  },
  {
    id: 'bio-research',
    title: 'Bio research',
    provider: 'Anthropic',
    downloads: '58.3K',
    description: 'Connect to preclinical research tools and databases to accelerate early-stage life sciences R&D.',
    icon: 'bio-research',
  },
  {
    id: 'zoom-plugin',
    title: 'Zoom plugin',
    provider: 'Zoom',
    downloads: '27.1K',
    description: 'Plan, build, and debug Zoom integrations across REST APIs, Meeting SDK, Video SDK, webhooks, bots, and MCP workflows.',
    icon: 'zoom',
  },
];

const sectionSearchPlaceholder: Record<DirectorySection, string> = {
  skills: 'Search skills...',
  connectors: 'Search connectors...',
  plugins: 'Search plugins...',
};

const cardLineClampClass =
  'overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]';

const interactiveButtonClass =
  'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#121212]/25 dark:focus-visible:ring-white/20';

function renderConnectorIcon(icon: ConnectorIconKey): React.ReactNode {
  switch (icon) {
    case 'filesystem':
      return <Folder size={18} className="text-[#121212]" strokeWidth={1.7} />;
    case 'pdf':
      return <FileText size={18} className="text-[#121212]" strokeWidth={1.7} />;
    case 'powerpoint':
      return (
        <div className="flex h-[21px] w-[21px] items-center justify-center rounded-[7px] bg-[#D35230] text-[10px] font-semibold text-white">
          P
        </div>
      );
    case 'word':
      return (
        <div className="flex h-[21px] w-[21px] items-center justify-center rounded-[7px] bg-[#2B579A] text-[10px] font-semibold text-white">
          W
        </div>
      );
    case 'chrome':
      return (
        <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="#FBBC05" />
          <path fill="#EA4335" d="M12 1a11 11 0 0 1 9.5 5.5h-19A11 11 0 0 1 12 1Z" />
          <path fill="#34A853" d="M2.5 6.5A11 11 0 0 0 12 23l4.8-8.3L2.5 6.5Z" />
          <circle cx="12" cy="12" r="5" fill="#fff" />
          <circle cx="12" cy="12" r="4.2" fill="#4285F4" />
        </svg>
      );
    case 'apify':
      return (
        <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" aria-hidden="true">
          <path d="M12 2L2 22h20L12 2Z" fill="#00C853" opacity="0.92" />
          <path d="M12 2L2 22h10Z" fill="#009688" />
          <path d="M22 22L12 2l-2 5 10 15Z" fill="#FFC107" opacity="0.92" />
        </svg>
      );
    case 'massive':
      return (
        <div className="flex h-[21px] w-[21px] items-center justify-center rounded-[7px] bg-[#1652F0] text-[10px] font-semibold text-white">
          M
        </div>
      );
    case 'figma':
      return (
        <svg viewBox="0 0 38 57" className="h-[21px] w-[14px]" aria-hidden="true">
          <path fill="#F24E1E" d="M19 0H9.5C4.253 0 0 4.253 0 9.5S4.253 19 9.5 19H19V0Z" />
          <path fill="#FF7262" d="M19 0v19h9.5c5.247 0 9.5-4.253 9.5-9.5S33.747 0 28.5 0H19Z" />
          <path fill="#1ABCFE" d="M19 19H9.5C4.253 19 0 23.253 0 28.5S4.253 38 9.5 38H19V19Z" />
          <path fill="#0ACF83" d="M19 38v9.5c0 5.247-4.253 9.5-9.5 9.5S0 52.747 0 47.5 4.253 38 9.5 38H19Z" />
          <path fill="#A259FF" d="M19 19v19h9.5c5.247 0 9.5-4.253 9.5-9.5S33.747 19 28.5 19H19Z" />
        </svg>
      );
    case 'github':
      return <LayoutGrid size={18} className="text-[#121212]" strokeWidth={1.7} />;
    case 'gdrive':
      return (
        <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" aria-hidden="true">
          <path d="M8.5 3h7l6 10.5-3.5 6.5h-7L4 9.5 8.5 3Z" fill="#0F9D58" />
          <path d="M8.5 3 2 13.5h7L15.5 3h-7Z" fill="#4285F4" />
          <path d="M18 20H7.5L4 13.5h10.5L18 20Z" fill="#F4B400" />
        </svg>
      );
    default:
      return <LayoutGrid size={18} className="text-[#121212]" strokeWidth={1.7} />;
  }
}

function DirectoryTabButton({ icon, isActive, label, onClick }: DirectoryTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${interactiveButtonClass} flex min-w-fit items-center gap-3 rounded-[8px] px-4 py-[6px] text-[14px] leading-5 tracking-[-0.1504px] lg:w-full ${
        isActive
          ? 'bg-[#efeeeb] font-semibold text-[#121212] dark:bg-[#353533] dark:text-white'
          : 'text-[#121212] hover:bg-[#f1f0ed] dark:text-[#EDEAE1] dark:hover:bg-[#2e2e2c]'
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ConnectorCard({ card, onSelect }: ConnectorCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(card)}
      className={`${interactiveButtonClass} flex min-h-[118px] flex-col gap-3 rounded-[16px] border border-[rgba(31,31,30,0.15)] bg-white p-[17px] text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-[rgba(31,31,30,0.3)] hover:bg-[#fcfcfb] active:translate-y-[1px] dark:border-[#4A4A48] dark:bg-[#30302E] dark:hover:bg-[#353533]`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] border border-[rgba(31,31,30,0.15)] bg-[#f8f8f6] dark:border-[#4A4A48] dark:bg-[#262624]">
          {renderConnectorIcon(card.icon)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium leading-5 tracking-[-0.1504px] text-[#121212] dark:text-white">{card.title}</div>
          <div className="mt-0.5 text-[12px] leading-4 text-[#7b7974] dark:text-[#ABA499]">{card.label}</div>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[#7b7974] transition-all duration-200 hover:bg-[#efeeeb] hover:text-[#121212] dark:hover:bg-[#3a3a38] dark:hover:text-white">
          <Plus size={16} strokeWidth={2} />
        </div>
      </div>

      <p className={`${cardLineClampClass} text-[12px] leading-4 text-[#7b7974] dark:text-[#ABA499]`}>{card.description}</p>
    </button>
  );
}

function PluginCard({ card }: PluginCardProps) {
  return (
    <button
      type="button"
      className={`${interactiveButtonClass} flex min-h-[118px] flex-col gap-3 rounded-[16px] border border-[rgba(31,31,30,0.15)] bg-white p-[17px] text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-[rgba(31,31,30,0.25)] hover:bg-[#fcfcfb] active:translate-y-[1px] dark:border-[#4A4A48] dark:bg-[#30302E] dark:hover:bg-[#353533]`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] border border-[rgba(31,31,30,0.15)] bg-[#f8f8f6] dark:border-[#4A4A48] dark:bg-[#262624]">
          <DirectoryPluginIcon icon={card.icon} className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium leading-5 tracking-[-0.1504px] text-[#121212] dark:text-white">{card.title}</div>
          <div className="mt-0.5 flex items-center gap-[6px] text-[12px] leading-4 text-[#7b7974] dark:text-[#ABA499]">
            <span className="truncate">{card.provider}</span>
            <span aria-hidden="true">•</span>
            <span className="flex items-center gap-0.5 whitespace-nowrap">
              <DirectoryUtilityIcon icon="download" className="h-3 w-3 opacity-90 dark:brightness-0 dark:invert" />
              {card.downloads}
            </span>
          </div>
        </div>
      </div>

      <p className={`${cardLineClampClass} text-[12px] leading-4 text-[#7b7974] dark:text-[#ABA499]`}>{card.description}</p>
    </button>
  );
}

function SkillsDirectoryPanel({ onOpenSkills }: Pick<DirectoryModalProps, 'onOpenSkills'>) {
  return (
    <div className="flex min-h-[360px] flex-1 items-center justify-center">
      <div className="w-full rounded-[16px] border border-[rgba(31,31,30,0.15)] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:border-[#4A4A48] dark:bg-[#30302E]">
        <div className="mx-auto max-w-[420px] text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#efeeeb] text-[#121212] dark:bg-[#3a3a38] dark:text-white">
            <WandSparkles size={24} strokeWidth={1.8} />
          </div>
          <h4 className="text-[18px] font-medium tracking-[-0.24px] text-[#121212] dark:text-white">Manage your skills</h4>
          <p className="mt-2 text-[14px] leading-5 tracking-[-0.1504px] text-[#7b7974] dark:text-[#ABA499]">
            Skills are edited in the main Customize workspace so you can browse files, preview prompts, and manage toggles in one place.
          </p>
          <button
            type="button"
            onClick={onOpenSkills}
            className={`${interactiveButtonClass} mt-6 inline-flex h-9 items-center justify-center rounded-[10px] bg-[#121212] px-4 text-[14px] font-medium text-white hover:bg-[#2a2a2a] active:translate-y-[1px] dark:bg-white dark:text-[#121212] dark:hover:bg-[#e9e9e6]`}
          >
            Open Skills
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DirectoryModal({
  initialSection = 'connectors',
  isGithubConnected,
  onClose,
  onOpenConnector,
  onOpenSkills,
}: DirectoryModalProps) {
  const [activeSection, setActiveSection] = useState<DirectorySection>(initialSection);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setActiveSection(initialSection);
    setSearchQuery('');
  }, [initialSection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const visibleConnectorCards = useMemo(() => {
    return connectorCards.map(card => {
      if (card.id !== 'github') {
        return card;
      }

      return {
        ...card,
        label: isGithubConnected ? 'Connected' : card.label,
        description: isGithubConnected
          ? 'GitHub is already connected and ready to use in Claude.'
          : card.description,
      };
    });
  }, [isGithubConnected]);

  const filteredConnectors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return visibleConnectorCards.filter(card =>
      !query ||
      card.title.toLowerCase().includes(query) ||
      card.description.toLowerCase().includes(query)
    );
  }, [searchQuery, visibleConnectorCards]);

  const filteredPlugins = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return pluginCards.filter(card =>
      !query ||
      card.title.toLowerCase().includes(query) ||
      card.provider.toLowerCase().includes(query) ||
      card.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSectionChange = (section: DirectorySection) => {
    setActiveSection(section);
    setSearchQuery('');
  };

  const handleConnectorSelect = (card: ConnectorDirectoryCard) => {
    if (!card.action) {
      return;
    }

    onOpenConnector(card.action);
  };

  const openClaudeDesktopDownload = () => {
    const downloadUrl = 'https://claude.ai/download';

    if (typeof window === 'undefined') {
      return;
    }

    const browserWindow = window as Window & {
      electronAPI?: {
        openExternal?: (url: string) => void;
      };
    };

    if (browserWindow.electronAPI?.openExternal) {
      browserWindow.electronAPI.openExternal(downloadUrl);
      return;
    }

    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-[rgba(31,31,30,0.42)] p-3 backdrop-blur-[3px] sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex h-full max-h-[782px] w-full max-w-[1024px] flex-col overflow-hidden rounded-[16px] border border-[rgba(31,31,30,0.15)] bg-[#f8f8f6] p-[25px] shadow-[0px_20px_25px_rgba(0,0,0,0.1),0px_8px_10px_rgba(0,0,0,0.1)] dark:border-[#444341] dark:bg-[#252523]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-[24px] font-medium leading-8 text-[#121212] dark:text-white">Directory</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close directory"
            className={`${interactiveButtonClass} flex h-8 w-8 items-center justify-center rounded-[6px] text-[#7b7974] hover:bg-[#efeeeb] hover:text-[#121212] dark:text-[#ABA499] dark:hover:bg-[#353533] dark:hover:text-white`}
          >
            <DirectoryUtilityIcon icon="close" className="h-4 w-4 opacity-90 dark:brightness-0 dark:invert" />
          </button>
        </div>

        <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-8">
          <div className="lg:w-[200px] lg:flex-shrink-0">
            <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
              <DirectoryTabButton
                icon={<DirectoryNavIcon icon="skills" className="h-5 w-5 dark:brightness-0 dark:invert" />}
                isActive={activeSection === 'skills'}
                label="Skills"
                onClick={() => handleSectionChange('skills')}
              />
              <DirectoryTabButton
                icon={<DirectoryNavIcon icon="connectors" className="h-5 w-5 dark:brightness-0 dark:invert" />}
                isActive={activeSection === 'connectors'}
                label="Connectors"
                onClick={() => handleSectionChange('connectors')}
              />
              <DirectoryTabButton
                icon={<DirectoryNavIcon icon="plugins" className="h-5 w-5 dark:brightness-0 dark:invert" />}
                isActive={activeSection === 'plugins'}
                label="Plugins"
                onClick={() => handleSectionChange('plugins')}
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <label className="flex h-9 items-center rounded-[8px] border border-[rgba(31,31,30,0.15)] bg-white px-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:border-[#4A4A48] dark:bg-[#30302E]">
              <DirectoryUtilityIcon icon="search" className="mr-2 h-4 w-4 opacity-90 dark:brightness-0 dark:invert" />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder={sectionSearchPlaceholder[activeSection]}
                className="h-full w-full bg-transparent text-[16px] tracking-[-0.3125px] text-[#121212] outline-none placeholder:text-[#7b7974] dark:text-white dark:placeholder:text-[#ABA499]"
              />
            </label>

            {activeSection === 'skills' ? (
              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <SkillsDirectoryPanel onOpenSkills={onOpenSkills} />
              </div>
            ) : (
              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                {activeSection === 'plugins' && (
                  <div className="rounded-[12px] border border-[rgba(31,31,30,0.3)] bg-[#f4f4f1] px-[13px] py-[13px] dark:border-[#5b5955] dark:bg-[#2d2d2b]">
                    <p className="text-[14px] leading-5 tracking-[-0.1504px] text-[#121212] dark:text-[#EDEAE1]">
                      Plugins can be browsed, but are only available for use in the desktop app.{' '}
                      <button
                        type="button"
                        onClick={openClaudeDesktopDownload}
                        className={`${interactiveButtonClass} inline text-[14px] leading-5 tracking-[-0.1504px] text-[#121212] underline underline-offset-[2px] hover:text-black dark:text-white dark:hover:text-[#f3f2ef]`}
                      >
                        Download Claude for Desktop
                      </button>
                    </p>
                  </div>
                )}

                <div className={`flex items-center justify-between ${activeSection === 'plugins' ? 'mt-4' : 'mt-0'}`}>
                  <div className="inline-flex h-[31.594px] items-center rounded-full bg-[#e6e5e0] px-4 text-[14px] leading-5 tracking-[-0.1504px] text-[#121212] dark:bg-[#3a3a38] dark:text-white">
                    Anthropic &amp; Partners
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className={`${interactiveButtonClass} flex h-8 items-center gap-3 rounded-[8px] border border-[rgba(31,31,30,0.15)] bg-white px-[13px] text-[14px] leading-5 tracking-[-0.1504px] text-[#7b7974] hover:border-[rgba(31,31,30,0.3)] hover:text-[#121212] dark:border-[#4A4A48] dark:bg-[#30302E] dark:text-[#ABA499] dark:hover:text-white`}
                    >
                      <span>Filter by</span>
                      <DirectoryUtilityIcon icon="chevron-down" className="h-[14px] w-[14px] opacity-90 dark:brightness-0 dark:invert" />
                    </button>
                    <button
                      type="button"
                      className={`${interactiveButtonClass} flex h-8 items-center gap-3 rounded-[8px] border border-[rgba(31,31,30,0.15)] bg-white px-[13px] text-[14px] leading-5 tracking-[-0.1504px] text-[#7b7974] hover:border-[rgba(31,31,30,0.3)] hover:text-[#121212] dark:border-[#4A4A48] dark:bg-[#30302E] dark:text-[#ABA499] dark:hover:text-white`}
                    >
                      <span>Sort by</span>
                      <DirectoryUtilityIcon icon="chevron-down" className="h-[14px] w-[14px] opacity-90 dark:brightness-0 dark:invert" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-[11px]">
                  {activeSection === 'connectors' ? (
                    filteredConnectors.length > 0 ? (
                      <div className="grid max-w-[731px] grid-cols-1 gap-4 md:grid-cols-2">
                        {filteredConnectors.map(card => (
                          <ConnectorCard key={card.id} card={card} onSelect={handleConnectorSelect} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-[260px] items-center justify-center rounded-[16px] border border-dashed border-[rgba(31,31,30,0.15)] bg-white/75 px-6 text-center dark:border-[#4A4A48] dark:bg-[#30302E]/70">
                        <div>
                          <Search size={24} strokeWidth={1.8} className="mx-auto mb-3 text-[#7b7974] dark:text-[#ABA499]" />
                          <div className="text-[15px] font-medium text-[#121212] dark:text-white">No connectors found</div>
                          <p className="mt-2 text-[13px] leading-5 text-[#7b7974] dark:text-[#ABA499]">
                            Try a different search term or clear the field to browse the full directory.
                          </p>
                        </div>
                      </div>
                    )
                  ) : filteredPlugins.length > 0 ? (
                    <div className="grid max-w-[731px] grid-cols-1 gap-4 md:grid-cols-2">
                      {filteredPlugins.map(card => (
                        <PluginCard key={card.id} card={card} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[260px] items-center justify-center rounded-[16px] border border-dashed border-[rgba(31,31,30,0.15)] bg-white/75 px-6 text-center dark:border-[#4A4A48] dark:bg-[#30302E]/70">
                      <div>
                        <Search size={24} strokeWidth={1.8} className="mx-auto mb-3 text-[#7b7974] dark:text-[#ABA499]" />
                        <div className="text-[15px] font-medium text-[#121212] dark:text-white">No plugins found</div>
                        <p className="mt-2 text-[13px] leading-5 text-[#7b7974] dark:text-[#ABA499]">
                          Try a different search term or clear the field to browse the plugin directory.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
