import type { CSSProperties, ReactNode, RefObject } from 'react';
import dispatchIcon from '../assets/figma-exports/sidebar-icons/dispatch-icon.svg';
import coworkCustomizeIcon from '../assets/sidebar-custom/cowork-customize-briefcase.svg';
import coworkNewTaskIcon from '../assets/sidebar-custom/cowork-new-task-plus.svg';
import coworkProjectsIcon from '../assets/sidebar-custom/cowork-projects-trash-can.svg';
import coworkScheduledIcon from '../assets/sidebar-custom/cowork-scheduled-clock.svg';
import recentConversationRingIcon from '../assets/sidebar-custom/recent-conversation-ring.svg';
import sidebarModeChatIcon from '../assets/sidebar-exact/chats.svg';
import sidebarModeCoworkIcon from '../assets/figma-exports/sidebar-icons/cowork-icon.svg';
import sidebarModeCodeIcon from '../assets/figma-exports/sidebar-icons/code-icon.svg';
import PillNav from './PillNav';

type UpdateStatus = {
  type: string;
  version?: string;
  percent?: number;
} | null;

type ChatItem = {
  id: string;
  title?: string;
  project_name?: string;
  updated_at?: string;
  created_at?: string;
};

interface CoworkExactSidebarProps {
  chats: ChatItem[];
  locationPathname: string;
  onInstallUpdate: () => void;
  onOpenChatMode: () => void;
  onNewTask: () => void;
  onOpenChat: (id: string) => void;
  onOpenCustomize: () => void;
  onOpenProjects: () => void;
  onOpenScheduled: () => void;
  onToggleUserMenu: () => void;
  streamingIds: ReadonlySet<string>;
  updateStatus: UpdateStatus;
  user: any;
  userButtonRef: RefObject<HTMLButtonElement | null>;
}

const sidebarNavLabelStyle: CSSProperties = {
  fontFamily: '"Anthropic Sans", "Figtree", sans-serif',
  fontSize: '14px',
  fontWeight: 400,
  lineHeight: '20px',
  letterSpacing: '-0.1504px',
};

const sidebarItemLabelStyle: CSSProperties = {
  ...sidebarNavLabelStyle,
  color: 'var(--text-claude-main)',
};

const sectionLabelStyle: CSSProperties = {
  fontFamily: '"Anthropic Sans", "Figtree", sans-serif',
  fontSize: '13px',
  fontWeight: 500,
  lineHeight: '18px',
  letterSpacing: '-0.08px',
  color: 'var(--text-claude-secondary)',
};

const subtleSidebarLabelStyle: CSSProperties = {
  fontFamily: '"Anthropic Sans", "Figtree", sans-serif',
  fontSize: '13px',
  fontWeight: 400,
  lineHeight: '18px',
  letterSpacing: '-0.08px',
  color: '#9b958d',
};

function formatCompactTime(value?: string) {
  if (!value) return '';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '';

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));
    return minutes <= 1 ? 'now' : `${minutes}m`;
  }

  if (diffMs < day) {
    return `${Math.round(diffMs / hour)}h`;
  }

  return `${Math.round(diffMs / day)}d`;
}

function getDisplayName(user: any) {
  return user?.display_name || user?.full_name || user?.nickname || 'User';
}

function getUpdateCopy(updateStatus: UpdateStatus) {
  if (!updateStatus) return null;

  if (updateStatus.type === 'downloaded') {
    return {
      actionDisabled: false,
      actionLabel: 'Relaunch',
      subtitle: 'Relaunch to apply',
      title: `Updated to ${updateStatus.version || 'latest'}`,
    };
  }

  if (updateStatus.type === 'progress') {
    return {
      actionDisabled: true,
      actionLabel: 'Downloading',
      subtitle: updateStatus.percent != null ? `${updateStatus.percent}% complete` : 'Downloading now',
      title: 'Downloading update',
    };
  }

  if (updateStatus.type === 'available') {
    return {
      actionDisabled: true,
      actionLabel: 'Preparing',
      subtitle: 'Preparing update package',
      title: `Update ${updateStatus.version || 'available'}`,
    };
  }

  return null;
}

function BaseSvg({
  children,
  className,
  viewBox,
}: {
  children: ReactNode;
  className?: string;
  viewBox: string;
}) {
  return (
    <svg className={className} fill="none" viewBox={viewBox} xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

function Toolbar1Icon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 10 9">
      <path
        d="M6.56118 6.77922C7.38235 5.93649 7.66824 5.45318 7.44471 5.28662C7.25 5.1411 5.53588 5.16565 5.23529 5.31818C4.83647 5.52039 1.13882 5.49584 0.81 5.28896C0.682941 5.2089 0.514706 5.14286 0.436471 5.14286C0.296471 5.14286 0.294118 5.13351 0.294118 4.62623V4.10961C2.68765 4.05 4.32882 4.03247 5.48588 4.03247C7.91588 4.03247 7.89529 4.03656 7.51412 3.63799C7.36824 3.48545 7.08588 3.10149 6.88706 2.78532C6.68765 2.46916 6.35059 2.01623 6.13765 1.77838C5.60706 1.18578 5.55824 0.551688 6.03412 0.428377C6.22706 0.378117 8.48176 2.57318 8.74588 3.06818C8.83118 3.2289 9.08235 3.54916 9.30353 3.77942C9.88706 4.38779 9.88588 4.61805 9.29588 5.22526C8.99882 5.53091 8.81412 5.79097 8.62412 6.16909C8.38176 6.65299 8.28765 6.76519 7.33941 7.69968C6.31588 8.70779 6.31588 8.70779 6.04059 8.70779C5.78471 8.70779 5.75529 8.69201 5.63647 8.49156C5.42529 8.13623 5.65706 7.70727 6.56118 6.77922Z"
        fill="#CEC9C1"
        fillOpacity="0.988235"
      />
    </BaseSvg>
  );
}

function Toolbar2Icon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 11 9">
      <path
        d="M2.97126 7.63732C2.48448 7.14169 2.08621 6.68472 2.08621 6.62134C2.08621 6.55796 1.68793 6.10352 1.20115 5.61106C0.177011 4.57542 0.20546 4.65782 0.695402 4.14634C0.904023 3.92831 1.07471 3.69951 1.07471 3.63676C1.07471 3.57338 1.77391 2.82042 2.66908 1.92042C4.52833 0.0507042 4.61494 -0.00190142 4.61494 0.737113C4.61494 1.15669 4.61494 1.15669 3.85632 1.9331C3.43845 2.36092 3.0977 2.76211 3.0977 2.82676C3.0977 2.89141 2.88149 3.16268 2.61661 3.42951C1.86747 4.185 1.50776 4.11972 6.43437 4.11972H10.6839V5.1338C1.45971 5.1338 1.77707 4.97155 3.47701 6.68472C4.61494 7.8319 4.61494 7.8319 4.61494 8.25718C4.61494 8.6831 4.61494 8.6831 4.23563 8.6831C3.99351 8.6831 3.85632 8.65711 3.85632 8.61085C3.85632 8.57092 3.45805 8.13296 2.97126 7.63732Z"
        fill="#998E87"
      />
    </BaseSvg>
  );
}

function Toolbar3Icon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 10 10">
      <path
        d="M6.81296 7.27778C6.68642 7.22469 6.57099 7.25617 6.12222 7.46481C5.22099 7.88457 3.15185 7.84938 2.21049 7.39815C1.51173 7.06296 1.32593 6.90617 0.982716 6.36296C0.246914 5.19753 0.310494 5.40432 0.309259 4.15247C0.308642 2.79012 0.557407 2.15988 1.42778 1.32099C1.89321 0.871605 1.90185 0.867284 3.05556 0.44321C3.55926 0.258642 4.34753 0.257407 4.96049 0.440741C5.20309 0.512963 5.5821 0.623457 5.80247 0.685802C6.5321 0.891358 7.90123 2.39259 7.90123 2.98704C7.90123 3.13827 7.95679 3.37531 8.02469 3.51358C8.17839 3.82654 8.19136 4.45432 8.05 4.71667C7.99691 4.81543 7.91728 5.02407 7.87346 5.17963C7.82963 5.33519 7.72099 5.68025 7.63148 5.94568C7.40617 6.61481 7.37161 6.54012 8.3679 7.53148C9.38765 8.54691 9.69136 8.97778 9.69136 9.41111C9.69136 9.69136 9.69136 9.69136 9.44444 9.69136C9.30123 9.69136 9.19753 9.66173 9.19753 9.62099C9.19753 9.51914 6.99321 7.35247 6.81296 7.27778ZM5.4321 6.85432C5.55123 6.78827 5.72346 6.73272 5.81543 6.73148C6.26049 6.72346 7.16111 5.4321 7.16049 4.80247C7.15988 4.69012 7.20864 4.46296 7.2679 4.29753C7.37037 4.01111 7.37037 3.98272 7.2679 3.72531C7.20864 3.57654 7.16049 3.32778 7.16049 3.17346C7.16049 2.95679 7.12654 2.86049 7.01358 2.75494C6.93272 2.67963 6.79198 2.47037 6.70062 2.28951C6.34815 1.59444 5.13951 1.04938 3.95062 1.04938C3.12531 1.04938 2.13951 1.46914 1.86667 1.93704C1.78519 2.07716 1.62346 2.31728 1.50741 2.47099C1.39136 2.62469 1.2963 2.81358 1.2963 2.89012C1.2963 2.96667 1.24074 3.13827 1.17284 3.27161C1.01605 3.57901 0.996914 4.68704 1.14383 4.93827C1.19383 5.02346 1.26111 5.2179 1.29321 5.37037C1.38395 5.79877 2.25185 6.63704 2.7037 6.73272C2.87963 6.76975 3.05123 6.83951 3.0858 6.88765C3.13519 6.95741 3.35926 6.97531 4.1821 6.97469C5.09136 6.97469 5.24198 6.95988 5.4321 6.85432Z"
        fill="#5B5651"
      />
    </BaseSvg>
  );
}

function Toolbar4Icon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 10 8">
      <path
        d="M8.7037 7.50769L7.46914 7.44615C-0.0629628 7.45169 0.303086 7.77292 0.306173 4.02215C0.308642 1.34092 0.312963 1.23877 0.432099 1.08308C0.5 0.994462 0.555556 0.838769 0.555556 0.737846C0.555556 0.587077 0.580864 0.553846 0.696914 0.553846C0.774691 0.553846 0.934568 0.498462 1.05185 0.431385C1.38642 0.239385 8.66111 0.238769 8.91358 0.430769C9.00247 0.498462 9.15864 0.553846 9.25988 0.553846C9.41111 0.553846 9.44444 0.579077 9.44444 0.694769C9.44444 0.772308 9.5 0.931692 9.56728 1.04862C9.68519 1.25231 9.69074 1.38031 9.69383 4.03077C9.69691 6.8 9.69691 6.8 9.37037 7.11815C9.19012 7.29354 8.96667 7.45231 8.87346 7.472L8.7037 7.50769ZM7.96296 6.70769C9.00802 6.70769 8.95062 6.96492 8.95062 3.95138C8.95062 1.32308 8.95062 1.32308 8.68827 1.24C8.10062 1.05354 7.86852 1.03385 6.34259 1.04L4.75309 1.04615H4.01235C3.31296 1.04615 3.2716 1.05292 3.2716 1.29231C3.2716 6.70769 3.2716 6.70769 3.54938 6.70769H3.82716L3.84259 6.81538C3.86852 6.99569 7.82407 7.01169 7.96296 6.70769ZM2.46914 1.29231V1.16677C2.46914 1.04862 2.43704 1.04246 1.89815 1.05908C1.39506 1.07508 1.32901 1.08985 1.35802 1.29231C1.04938 1.69046 1.04938 1.69046 1.04938 4.00985C1.04938 6.85169 1.00062 6.70769 1.96481 6.70769H2.56111L2.46914 1.29231Z"
        fill="#4F443F"
      />
      <path d="M3.82716 6.70769H7.96296C7.82407 7.01169 3.86852 6.99569 3.84259 6.81538L3.82716 6.70769Z" fill="#998E8C" />
      <path d="M3.27161 1.29231C3.27161 1.05292 3.31296 1.04615 4.01235 1.04615H4.75309C4.75309 1.184 4.55432 1.21723 4.01235 1.24862L3.27161 1.29231Z" fill="#998E8C" />
      <path d="M1.35802 1.29231C1.32901 1.08985 1.39506 1.07508 1.89815 1.05908C2.43704 1.04246 2.46914 1.04862 2.46914 1.16677V1.29231H1.35802Z" fill="#998E8C" />
      <path d="M7.46914 7.44615L8.7037 7.50769C8.7037 7.67877 7.56975 7.65169 7.51543 7.54031L7.46914 7.44615Z" fill="#998E8C" />
    </BaseSvg>
  );
}

function Toolbar5Icon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 9 8">
      <path d="M0.3 3.46269H8.7V4.53731H0.3V3.46269Z" fill="#514C49" />
      <path d="M1.2108 6.61433C1.5354 6.66746 2.4576 6.67701 4.74 6.65015C8.6892 6.60418 8.6994 6.60478 8.7012 6.97313C8.7024 7.17134 8.6598 7.3194 8.556 7.47761C8.409 7.70149 8.409 7.70149 4.3548 7.70149H0.3C0.3 6.61433 0.4782 6.49433 1.2108 6.61433Z" fill="#514C49" />
      <path d="M0.3 0.74806V0.298507H8.7V1.31343C1.5144 1.31343 1.5144 1.31343 1.116 1.46269C0.8964 1.54507 0.7044 1.61194 0.6888 1.61194C0.6726 1.61194 0.579 1.51881 0.48 1.40478C0.3144 1.21373 0.3 1.16119 0.3 0.74806Z" fill="#514C49" />
    </BaseSvg>
  );
}

function NotifyIcon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 10 10">
      <path
        d="M0.542169 6.50602L0.64759 6.52108C0.705422 6.52952 0.800602 6.4753 0.963855 6.26506C0.963855 6.03374 0.923494 5.91145 0.873494 5.84458L0.783133 5.72289L0.768072 5.55723C0.757229 5.43855 0.723494 5.39578 0.542169 5.42169C0.176506 4.62108 0.268675 3.06566 0.587349 2.33434L0.843374 1.74699L1.15964 1.46084C1.33373 1.30361 1.48253 1.12711 1.50602 0.963855C1.83012 0.788554 2.03434 0.637952 2.16867 0.515663C2.56265 0.157831 4.31145 0.204819 4.8506 0.587349C5.04879 0.728313 5.2988 0.870482 5.40663 0.903614L5.60241 0.963855L5.70783 1.15482C5.76566 1.26024 5.94217 1.47711 6.38554 1.92771C6.9259 2.91386 6.8988 4.69096 6.5512 5.31627L6.3253 5.72289L6.10904 5.91868C5.81627 6.18374 5.36145 6.72108 5.36145 6.86747C5.29157 6.95422 5.19518 6.98855 5.10301 6.9988C5.01084 7.00964 4.90904 7.06566 4.87711 7.12349L4.81928 7.22892L2.10843 7.28916H1.92771C0.610843 7.28916 0.598193 7.28675 0.542169 7.13855C0.510843 7.05602 0.443373 6.98795 0.392771 6.98795C0.245181 6.98795 0.270482 6.60121 0.421687 6.54819L0.542169 6.50602Z"
        fill="#68635E"
      />
      <path
        d="M4.33735 9.15663L4.3994 9.06928C4.44639 9.00361 4.43133 8.96627 4.33916 8.91687C4.24096 8.86386 4.21687 8.86928 4.21687 9.03614L3.9759 8.85542L4.09639 8.55422C4.35181 8.24096 4.81265 8.26205 4.8512 8.46386L4.87952 8.61446L5.40663 8.65783C5.87108 8.69578 5.94458 8.71747 6.0241 8.84337C6.11024 8.97952 6.14458 8.98614 6.73976 8.98133C7.36566 8.9759 7.36566 8.9759 7.80904 8.52952C8.05361 8.28434 8.25301 8.05361 8.25301 7.95181C8.31145 7.67711 8.36566 7.58313 8.41084 7.56566C8.46084 7.54699 8.49398 7.44518 8.49398 7.31325C8.49398 7.16928 8.53072 7.06928 8.5994 7.0253C8.68434 6.97108 8.70783 6.85602 8.71988 6.43072L8.73494 5.90361L8.77892 6.44639C8.81084 6.84096 8.80301 7.02229 8.74819 7.10904C8.67831 7.22169 8.68916 7.22892 8.93193 7.22892C9.16145 7.22892 9.20542 7.20542 9.45783 6.80723V7.28916C9.45783 9.11566 9.43434 9.54759 9.39157 9.60663C9.33434 9.68614 9.03795 9.6988 7.21325 9.6988C5.1012 9.6988 5.1012 9.6988 4.71928 9.48313C4.50904 9.36446 4.33735 9.24217 4.33735 9.21205V9.15663Z"
        fill="#7F7F7F"
      />
      <path d="M4.87952 8.61446C7.29819 8.68072 7.50542 8.63193 8.00482 8.17771L8.25301 7.95181C8.25301 8.05361 8.05361 8.28434 7.80904 8.52952C7.36566 8.9759 7.36566 8.9759 6.73976 8.98132C6.14458 8.98614 6.11024 8.97952 6.0241 8.84337C5.94458 8.71747 5.87108 8.69578 5.40663 8.65783L4.87952 8.61446Z" fill="#A0A0A0" fillOpacity="0.988235" />
      <path d="M1.92771 7.28916H2.10843H3.9759C3.9 7.51867 3.83916 7.53072 3.28855 7.53735C2.21747 7.5506 2.02349 7.53072 1.97289 7.40301L1.92771 7.28916Z" fill="#A0A0A0" fillOpacity="0.988235" />
      <path d="M9.45783 7.28916V6.80723V6.38554L9.56566 5.33133L9.57289 5.87349C9.57651 6.17169 9.60663 6.46325 9.6988 6.62651C9.6988 7.2488 9.68434 7.28916 9.57831 7.28916H9.45783Z" fill="#A0A0A0" fillOpacity="0.988235" />
    </BaseSvg>
  );
}

function PillIcon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 9 8">
      <path
        d="M0.54 7.3009C0.1236 6.90209 0.1728 5.36896 0.6162 4.91821C1.0482 4.4794 2.3274 4.42209 2.7864 4.8209C3.6012 5.52955 3.621 6.56896 2.8356 7.41791C2.5734 7.70149 2.5734 7.70149 1.677 7.70149C0.9396 7.70149 0.78 7.68657 0.78 7.61612C0.78 7.56955 0.672 7.42746 0.54 7.3009ZM2.2374 6.86567C2.2548 6.8 2.3118 6.74627 2.3646 6.74627C2.4456 6.74627 2.46 6.65552 2.46 6.14925C2.46 5.67105 2.4432 5.55224 2.3742 5.55224C2.3268 5.55224 2.271 5.49851 2.25 5.43284C2.1984 5.27045 1.26 5.24776 1.26 5.40836C1.26 5.4609 1.206 5.51761 1.14 5.53493C1.0338 5.56239 1.02 5.61612 1.02 5.99463C1.02 6.4209 1.0212 6.42448 1.29 6.70388C1.5462 6.97075 1.5762 6.98507 1.8828 6.98507C2.1558 6.98507 2.211 6.96657 2.2374 6.86567Z"
        fill="black"
      />
      <path
        d="M0.7554 1.97015C1.161 1.97015 1.215 1.98328 1.2426 2.08955C1.332 2.42925 1.6056 2.26209 2.6064 1.25373C3.5694 0.283582 3.66 0.211343 3.66 0.410746C3.66 0.473433 3.7134 0.537313 3.78 0.554627C3.8802 0.580896 3.9 0.635821 3.9 0.887761C3.9 1.12896 3.876 1.20299 3.78 1.25373C3.7092 1.29134 3.66 1.37851 3.66 1.46627C3.66 1.64896 2.6286 2.68657 2.4468 2.68657C2.3832 2.68657 2.2236 2.79403 2.0928 2.92537C1.8552 3.16418 1.8552 3.16418 1.3476 3.16418C0.84 3.16418 0.84 3.16418 0.5718 2.85075C0.0966 2.29612 0.165 1.97015 0.7554 1.97015Z"
        fill="black"
      />
      <path d="M4.7244 6.01552C4.6326 5.9791 4.617 5.91761 4.632 5.65731C4.65 5.34328 4.65 5.34328 6.675 5.32776L8.7 5.31164V6.26866C5.0664 6.26866 4.917 6.2603 4.878 6.16418C4.8546 6.10687 4.7856 6.04 4.7244 6.01552Z" fill="black" />
      <path d="M4.7424 1.9797C4.7904 1.96418 4.8492 1.90209 4.8732 1.84179C4.9134 1.73791 5.0244 1.73134 6.8082 1.73134H8.7V2.68657C4.9794 2.68657 4.6746 2.67343 4.6434 2.59881C4.5798 2.44597 4.6494 2.01015 4.7424 1.9797Z" fill="black" />
    </BaseSvg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 8 8">
      <path
        d="M3.3287 5.89044C3.27826 5.87072 2.57391 5.85507 1.76348 5.85507C0.289855 5.85507 0.289855 5.85507 0.291594 5.6087C0.292174 5.47304 0.344348 5.2713 0.406957 5.15942C0.50029 4.99362 0.521159 4.84638 0.521739 4.35362C0.521739 3.80406 0.534493 3.73333 0.666667 3.54725C0.79942 3.36116 0.811594 3.29101 0.811594 2.73449C0.811594 2.14377 0.816812 2.11884 0.985507 1.9113C1.12638 1.73797 1.15942 1.6429 1.15942 1.41217C1.15942 0.976232 1.42783 0.624928 1.90667 0.434783C2.26667 0.291594 2.29333 0.289855 4.01971 0.287536C5.76812 0.285217 5.76812 0.285217 6.12174 0.518261C6.78783 0.957101 6.89855 1.09507 6.89855 1.4858C6.89913 1.77391 6.92116 1.84638 7.04348 1.96C7.18319 2.08928 7.18841 2.12058 7.18841 2.82029C7.18841 3.49739 7.19826 3.56058 7.33333 3.76406C7.45913 3.95362 7.47826 4.0458 7.47826 4.47304C7.47826 4.86841 7.50087 4.99652 7.5942 5.13333C7.67015 5.24406 7.71015 5.39768 7.71015 5.57855C7.71015 5.85507 7.71015 5.85507 6.26551 5.85507C4.42029 5.85507 4.57971 5.76116 4.57971 6.84696V7.71014H3.42029C3.42029 6.05739 3.40696 5.92 3.3287 5.89044ZM6.26087 5.15942C6.26087 2.84986 6.25855 2.82725 6.11594 2.61275C5.99015 2.42319 5.97101 2.33043 5.97101 1.90609C5.97101 1.01623 5.90725 0.986667 3.97391 0.982609C2.06203 0.978551 2.02899 0.995362 2.02899 1.96696C2.02899 2.6087 2.02899 2.6087 1.88406 2.6087C1.73913 2.6087 1.73913 2.6087 1.73913 3.88406V5.15942H6.26087Z"
        fill="#B7AFA5"
      />
    </BaseSvg>
  );
}

function RecentsDotIcon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 5 5">
      <path d="M1.16667 3.37167C0.596667 3.01667 0.765 1.4 1.33833 1.72833C1.42667 1.78 1.5 2.2 1.5 2.66167C1.5 3.48167 1.51167 3.5 1.99833 3.5C2.51 3.5 2.77 3.71667 2.605 4.005C2.55333 4.09333 2.28333 4.16667 2.005 4.16667C1.63333 4.16667 1.5 4.08833 1.5 3.87333C1.5 3.71167 1.35 3.48667 1.16667 3.37167Z" fill="#E1E0DE" fillOpacity="0.988235" />
      <path d="M2.26167 1.57167C1.60833 1.30167 1.49167 1.015 1.98333 0.886667C2.61167 0.721667 4.21167 2.155 3.905 2.60833C3.82 2.735 3.69333 2.83833 3.625 2.83667C3.55667 2.835 3.355 2.605 3.17833 2.325C3 2.045 2.58833 1.70667 2.26167 1.57167Z" fill="#E1E0DE" fillOpacity="0.988235" />
      <path d="M2.83333 2.83333H3.5V3.5H2.83333V2.83333Z" fill="#E1E0DE" fillOpacity="0.988235" />
    </BaseSvg>
  );
}

function BottomUserIcon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 8 9">
      <path
        d="M1.65049 5.12413C2.10754 4.88413 2.41967 4.76087 2.57049 4.76087C2.69639 4.76087 2.92918 4.70217 3.08787 4.63043C3.48459 4.45109 4.45639 4.44717 4.9023 4.62261C5.07344 4.68978 5.34426 4.76413 5.50492 4.78826C6.08131 4.8737 6.99148 5.42935 7.13967 5.78609C7.21049 5.95761 7.35934 6.18391 7.47082 6.28957C7.78295 6.5863 7.78885 8.71174 7.47672 8.65956C7.09967 8.5963 6.95082 8.30543 6.95082 7.63435C6.95082 7.10152 6.93443 7.02261 6.77574 6.80022C6.67934 6.66522 6.55148 6.44674 6.49115 6.315C6.13771 5.53891 3.30885 5.23435 2.1718 5.84935C1.73377 6.08674 1.58951 6.20087 1.53049 6.35478C1.48918 6.46435 1.36393 6.64043 1.2518 6.74609C1.04918 6.93717 1.04918 6.93717 1.04918 7.80587C1.04918 8.67391 1.04918 8.67391 0.688525 8.67391C0.327869 8.67391 0.327869 8.67391 0.327869 7.57304C0.327869 6.10043 0.540328 5.70717 1.65049 5.12413Z"
        fill="#918982"
      />
      <path
        d="M2.06852 2.18322C2.06852 1.68256 2.2685 1.20242 2.62445 0.8484C2.9804 0.494384 3.46317 0.2955 3.96656 0.2955C4.46995 0.2955 4.95272 0.494384 5.30867 0.8484C5.66462 1.20242 5.86459 1.68256 5.86459 2.18322C5.86459 2.68387 5.66462 3.16402 5.30867 3.51804C4.95272 3.87205 4.46995 4.07093 3.96656 4.07093C3.46317 4.07093 2.9804 3.87205 2.62445 3.51804C2.2685 3.16402 2.06852 2.68387 2.06852 2.18322ZM4.01771 3.06522C4.09639 2.97326 4.21115 2.93478 4.40328 2.93478C4.6282 2.93478 4.71016 2.89761 4.86295 2.72739C5.29312 2.2487 5.00918 1.36957 4.42492 1.36957C4.25574 1.36957 4.12197 1.32261 4.02033 1.22739C3.8682 1.08522 3.8682 1.08522 3.73443 1.22739C3.66164 1.30565 3.5482 1.36957 3.48262 1.36957C3.41705 1.36957 3.28197 1.44522 3.18164 1.53717C2.79803 1.89065 3.02033 2.93478 3.47934 2.93478C3.54361 2.93478 3.64197 2.99348 3.69967 3.06522C3.75672 3.13696 3.82623 3.19565 3.85443 3.19565C3.88262 3.19565 3.95607 3.13696 4.01771 3.06522Z"
        fill="#918982"
      />
    </BaseSvg>
  );
}

function BottomActionIcon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 8 8">
      <path d="M0.358209 5.85075L0.45194 5.83582C0.569552 5.81731 0.551642 5.23284 0.358209 5.19403C0.950448 4.63045 1.25373 5.06627 1.25373 6.06806C1.25373 7.03045 0.928358 6.93134 4.02269 6.91224C7.23164 6.89194 6.98507 6.9809 6.98507 5.84537C6.98507 5.13433 6.98507 5.13433 7.34328 5.13433C7.70149 5.13433 7.70149 5.13433 7.70149 5.91403C7.70149 6.68239 7.69851 6.6991 7.49493 7.11284C7.1803 7.75045 7.47343 7.7009 4.01194 7.70746C0.985074 7.71343 0.985075 7.71343 0.761194 7.51104C0.53791 7.30985 0.537313 7.30746 0.547463 6.86328C0.55403 6.57672 0.521791 6.31642 0.45791 6.13433L0.358209 5.85075Z" fill="#93897C" />
      <path d="M2.69493 4.13194C2.34866 3.91761 1.96836 3.34507 2.09015 3.22328C2.12298 3.19045 2.42925 3.16418 2.77134 3.16418C3.71104 3.16418 3.64179 3.28299 3.64179 1.66507C3.64179 0.298507 3.64179 0.298507 4 0.298507C4.35821 0.298507 4.35821 0.298507 4.35821 1.62209C4.35821 3.27522 4.28955 3.16418 5.31164 3.16418C6.04657 3.16418 6.04657 3.16418 6.01433 3.35582C5.97373 3.59642 5.64597 3.95463 5.31403 4.12119C5.12358 4.21731 5.00358 4.34328 4.83701 4.62328C4.71463 4.82925 4.53672 5.07582 4.44239 5.17075C4.33433 5.27881 4.17552 5.36 4.01612 5.38806C3.76119 5.43284 3.76119 5.43284 3.54507 5.08955C3.1809 4.51104 3.02746 4.33851 2.69493 4.13194Z" fill="#93897C" />
      <path d="M0.358209 5.85075V5.19403C0.551642 5.23284 0.569552 5.81731 0.45194 5.83582L0.358209 5.85075Z" fill="#C4BFB7" fillOpacity="0.988235" />
    </BaseSvg>
  );
}

function UpdateLeafIcon({ className }: { className?: string }) {
  return (
    <BaseSvg className={className} viewBox="0 0 32 33">
      <path d="M2.6875 29.5112C5.04 27.1112 5.02625 27.1425 4.23375 26.0675C0.36375 20.8162 2.765 12.0962 9.28125 7.735C14.185 4.45375 23.105 1.54625 30.1875 0.92125L31.1875 0.83375C31.0675 8.16375 28.3737 17.8512 25.7375 21.8412C25.2475 22.5812 24.7437 23.4913 24.6187 23.8613C24.4237 24.4338 24.2975 24.5913 23.7887 24.9025C23.4575 25.1038 22.6787 25.7675 22.0562 26.3775C19.8912 28.4975 17.2025 29.8438 14.1812 30.3213C11.8825 30.6838 8.0775 29.7813 6.5725 28.5175C5.73375 27.8125 5.64125 27.8588 3.12125 30.25C1.88875 31.4188 0.82375 32.375 0.75375 32.375C0.6825 32.375 0.625 32.2038 0.625 31.995C0.625 31.6713 0.93375 31.3 2.6875 29.5112Z" fill="#0C0C0C" />
      <path d="M11.125 22.125L18.625 14.625L27.875 14.75L24.625 22L11.125 22.125Z" fill="#DDD8D1" />
      <path d="M10.5813 7.93375C10.765 7.455 16.9137 4.625 17.7687 4.625C17.9887 4.625 18.0012 4.8375 18.015 9.15625L18.0312 13.6875C12.4363 19.3925 10.7813 21.0662 10.7425 21.0875C10.7038 21.1075 10.6338 21.125 10.5863 21.125C10.5388 21.125 10.5 18.205 10.5 14.635C10.5 11.0663 10.5363 8.05 10.5813 7.93375Z" fill="#DDD8D1" />
      <path d="M6.5825 26.88C6.72 26.5162 9.3125 23.8212 9.91875 23.41C10.525 23 10.525 23 16.95 23C20.8575 23 23.43 23.0475 23.5187 23.12C23.9887 23.5075 21.225 26.2975 19.0375 27.645C17.3637 28.675 16.3737 29.0662 14.6337 29.3862C13.9162 29.5175 13.115 29.625 12.8525 29.625C12.59 29.625 11.7925 29.5175 11.0787 29.3862C8.48125 28.9087 6.27875 27.6812 6.5825 26.88Z" fill="#DDD8D1" />
      <path d="M5.3225 12.9487C6.4525 11.0025 9.115 8.375 9.49125 8.83375C9.72 9.1125 9.705 22.1625 9.47625 22.505C9.2175 22.8925 6.27 25.7737 5.85375 26.0462C5.68375 26.1587 5.50625 26.25 5.46 26.25C5.4125 26.25 5.0975 25.7862 4.7575 25.2188C2.64 21.6837 2.84625 17.2137 5.3225 12.9487Z" fill="#DDD8D1" />
      <path d="M19.375 13.875L30.25 2.375L29.875 6.75L28.25 13.75L19.375 13.875Z" fill="#DDD8D1" />
      <path d="M19 12.875L18.875 4.125L29.125 1.75V2.5L19 12.875Z" fill="#DDD8D1" />
    </BaseSvg>
  );
}

function FigmaSidebarAction({
  active = false,
  disabled = false,
  icon,
  label,
  labelStyle = sidebarItemLabelStyle,
  onClick,
  subtitle,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  labelStyle?: CSSProperties;
  onClick?: () => void;
  subtitle?: string;
}) {
  return (
    <button
      className={`flex h-8 w-full items-center gap-3 rounded-[6px] px-2 text-left transition-colors ${
        active ? 'bg-claude-hover' : 'hover:bg-claude-hover'
      } ${disabled ? 'cursor-default opacity-60 hover:bg-transparent' : ''}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-claude-textSecondary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={labelStyle}>
          {label}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-[12px] leading-[16px] tracking-[-0.05px] text-[#9d968d]">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export default function CoworkExactSidebar({
  chats,
  locationPathname,
  onInstallUpdate,
  onOpenChatMode,
  onNewTask,
  onOpenChat,
  onOpenCustomize,
  onOpenProjects,
  onOpenScheduled,
  onToggleUserMenu,
  streamingIds,
  updateStatus,
  user,
  userButtonRef,
}: CoworkExactSidebarProps) {
  const displayName = getDisplayName(user);
  const updateCopy = getUpdateCopy(updateStatus);
  const showUpdateCard = Boolean(updateCopy);
  const recentChats = chats.slice(0, 18);
  const userInitial = displayName.charAt(0).toUpperCase();
  const topModeItems = [
    {
      key: 'chat',
      label: 'Chat',
      icon: sidebarModeChatIcon,
      iconWidth: 20,
      iconHeight: 20,
      labelMaxWidth: 34,
      iconOpacity: 1,
      onSelect: onOpenChatMode,
    },
    {
      key: 'cowork',
      label: 'Cowork',
      icon: sidebarModeCoworkIcon,
      iconWidth: 19,
      iconHeight: 18,
      labelMaxWidth: 58,
      iconOpacity: 0.58,
      activeIconOpacity: 0.58,
    },
    {
      key: 'code',
      label: 'Code',
      icon: sidebarModeCodeIcon,
      iconWidth: 18,
      iconHeight: 18,
      labelMaxWidth: 40,
      iconOpacity: 1,
      disabled: true,
    },
  ] as const;

  return (
    <div
      className="flex h-full min-h-[666px] w-full flex-col overflow-hidden bg-[#fbfaf7]"
      style={{ fontFamily: '"Anthropic Sans", "Figtree", sans-serif' }}
    >
      <div className="flex min-h-0 flex-1 flex-col border-r border-[#ece7df] bg-[#fcfbf8]">
        <div className="mb-2 mt-[52px] px-[9px]">
          <PillNav
            activeKey="cowork"
            indicatorColor="#f1efea"
            items={[...topModeItems]}
            onItemSelect={(item) => item.onSelect?.()}
            textColor="#5f5b56"
            activeTextColor="#373734"
          />
        </div>

        <div className="px-[9px] pt-[2px]">
          <nav className="space-y-px">
            <FigmaSidebarAction
              icon={<img alt="" className="max-h-5 max-w-5 object-contain opacity-80" src={coworkNewTaskIcon} />}
              label="New task"
              labelStyle={sidebarItemLabelStyle}
              onClick={onNewTask}
            />
            <FigmaSidebarAction
              icon={<img alt="" className="max-h-5 max-w-5 object-contain opacity-80" src={coworkProjectsIcon} />}
              label="Projects"
              onClick={onOpenProjects}
            />
            <FigmaSidebarAction
              active={locationPathname === '/scheduled'}
              icon={<img alt="" className="max-h-5 max-w-5 object-contain opacity-75" src={coworkScheduledIcon} />}
              label="Scheduled"
              onClick={onOpenScheduled}
            />
            <FigmaSidebarAction
              active={locationPathname === '/customize'}
              icon={<img alt="" className="max-h-5 max-w-5 object-contain opacity-80" src={coworkCustomizeIcon} />}
              label="Customize"
              onClick={onOpenCustomize}
            />
            <FigmaSidebarAction
              disabled
              icon={<img alt="" className="max-h-5 max-w-5 object-contain opacity-75" src={dispatchIcon} />}
              label="Dispatch"
            />
          </nav>
        </div>

        <div className="px-[9px] pt-[18px]">
          <div className="mb-2 px-2" style={sectionLabelStyle}>
            Pinned
          </div>
          <FigmaSidebarAction
            disabled
            icon={<PinIcon className="h-[14px] w-[14px] opacity-80" />}
            label="Drag to pin"
            labelStyle={subtleSidebarLabelStyle}
          />
        </div>

        <div className="min-h-0 flex-1 px-[9px] pt-[18px]">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-2 px-2" style={sectionLabelStyle}>
              Recents
            </div>
            <div className="sidebar-scroll flex-1 overflow-y-auto pb-3 pr-1">
              {recentChats.length > 0 ? (
                <div className="space-y-px">
                  {recentChats.map((chat) => {
                    const isActive = locationPathname === `/chat/${chat.id}`;
                    const meta = formatCompactTime(chat.updated_at || chat.created_at);
                    const isStreaming = streamingIds.has(chat.id);

                    return (
                      <button
                        className={`flex min-h-8 w-full items-center gap-3 rounded-[6px] px-2 py-[6px] text-left transition-colors ${
                          isActive ? 'bg-claude-hover' : 'hover:bg-claude-hover'
                        }`}
                        key={chat.id}
                        onClick={() => onOpenChat(chat.id)}
                        type="button"
                      >
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                          <img
                            alt=""
                            className={`h-[14px] w-[14px] object-contain opacity-70 ${isStreaming ? 'animate-spin' : ''}`}
                            src={recentConversationRingIcon}
                            style={isStreaming ? { animationDuration: '2.4s' } : undefined}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate ${
                              isActive ? 'text-claude-text' : 'text-claude-textSecondary'
                            }`}
                            style={{
                              fontFamily: '"Anthropic Sans", "Figtree", sans-serif',
                              fontSize: '13px',
                              fontWeight: 400,
                              letterSpacing: '-0.08px',
                              lineHeight: '18px',
                            }}
                          >
                            {chat.title || 'New Conversation'}
                          </span>
                          {chat.project_name ? (
                            <span className="mt-0.5 block truncate text-[12px] leading-[16px] tracking-[-0.05px] text-[#979088]">
                              {chat.project_name}
                            </span>
                          ) : null}
                        </span>
                        {meta ? (
                          <span className="flex-shrink-0 text-[12px] font-normal leading-[16px] tracking-[-0.05px] text-[#a19b92]">
                            {meta}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[10px] border border-dashed border-[#ece8e0] bg-white/55 px-3 py-3 text-[13px] leading-[18px] tracking-[-0.08px] text-[#9f988f]">
                  Recent chats will appear here once you start using Cowork.
                </div>
              )}
            </div>
          </div>
        </div>

        {showUpdateCard ? (
          <div className="px-[11px] pb-[10px]">
            <div className="rounded-[12px] border border-[#ece7df] bg-white px-3 py-3 shadow-[0_1px_0_rgba(17,17,17,0.02)]">
              <div className="mb-3 flex flex-col items-center text-center">
                <UpdateLeafIcon className="mb-2 h-[24px] w-[24px]" />
                <div className="text-[11px] font-medium leading-[15px] text-[#78746e]">{updateCopy?.title}</div>
                <div className="mt-1 text-[10px] leading-[13px] text-[#b5b0a7]">{updateCopy?.subtitle}</div>
              </div>
              <button
                className={`flex h-7 w-full items-center justify-center rounded-[9px] border border-[#ece7df] bg-[#fcfbf8] text-[11px] font-medium transition-colors ${
                  updateCopy?.actionDisabled ? 'text-[#bcb6ae]' : 'text-[#7a7670] hover:bg-[#f5f3ef]'
                }`}
                disabled={updateCopy?.actionDisabled}
                onClick={() => {
                  if (!updateCopy?.actionDisabled) onInstallUpdate();
                }}
                type="button"
              >
                {updateCopy?.actionLabel}
              </button>
            </div>
          </div>
        ) : null}

        <div className="border-t border-[#ece7df] px-[12px] py-[10px]">
          <button
            className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 transition-colors hover:bg-[#f5f3ef]"
            onClick={onToggleUserMenu}
            ref={userButtonRef}
            type="button"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#ece8df] text-[15px] font-medium text-[#7f7a72]">
              {userInitial}
            </div>
            <span className="min-w-0 flex-1 truncate text-left text-[15px] font-medium leading-tight tracking-[-0.08px] text-[#6a655f]">
              {displayName}
            </span>
            <BottomActionIcon className="h-[13px] w-[13px] flex-shrink-0 opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
}
