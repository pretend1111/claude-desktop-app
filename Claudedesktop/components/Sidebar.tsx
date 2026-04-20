import React, { useState, useEffect, useRef } from 'react';
import { 
  IconSidebarToggle, 
  IconChatBubble, 
  IconCode, 
  IconPlusCircle, 
  IconArtifactsExact,
  IconProjects,
  IconDotsHorizontal,
  IconStarOutline,
  IconPencil,
  IconTrash
} from './Icons';
import { NAV_ITEMS, RECENT_CHATS } from '../constants';
import { ChevronUp } from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

// Map labels to the correct custom icon
const getIcon = (label: string, size: number) => {
  switch (label) {
    case 'Chats': return <IconChatBubble size={size} />;
    case 'Projects': return <IconProjects size={size} />;
    case 'Artifacts': return <IconArtifactsExact size={size} />;
    case 'Code': return <IconCode size={size} />;
    default: return <IconChatBubble size={size} />;
  }
};

const Sidebar = ({ isCollapsed, toggleSidebar }: SidebarProps) => {
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{top: number, left: number} | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuIndex(null);
      }
    };
    
    // Close on scroll
    const handleScroll = () => {
       if (activeMenuIndex !== null) setActiveMenuIndex(null);
    };

    if (activeMenuIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      // Attach scroll listener to the sidebar scroll container
      const scrollEl = scrollRef.current;
      scrollEl?.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      const scrollEl = scrollRef.current;
      scrollEl?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [activeMenuIndex]);

  const handleMenuClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (activeMenuIndex === index) {
      setActiveMenuIndex(null);
      return;
    }

    const button = e.currentTarget as HTMLElement;
    const buttonRect = button.getBoundingClientRect();
    const parentElement = button.parentElement;
    
    let leftPos = buttonRect.right - 200; // Fallback to button alignment

    if (parentElement) {
      const parentRect = parentElement.getBoundingClientRect();
      // Align right edge of menu (200px wide) with the right edge of the chat item container (grey box)
      leftPos = parentRect.right - 200;
    }

    setMenuPosition({
      top: buttonRect.bottom + 4,
      left: leftPos, 
    });
    setActiveMenuIndex(index);
  };

  return (
    <>
      <div 
        className={`
          h-screen bg-claude-sidebar border-r border-claude-border flex-shrink-0 text-[#393939] antialiased flex flex-col transition-all duration-200 ease-in-out overflow-hidden
          ${isCollapsed ? 'w-[60px]' : 'w-[280px]'}
        `}
      >
        {/* Header */}
        <div className={`
          px-2 flex items-center justify-between flex-shrink-0 h-[52px]
          ${isCollapsed ? 'pt-3 pb-0.5' : 'pt-3 pb-2'}
        `}>
          {/* Logo Container */}
          <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
             <button className="px-2 py-1 -ml-1 hover:bg-black/5 rounded-md transition-colors whitespace-nowrap">
                {/* Updated logo font style to be flatter/wider */}
                <span className="text-[20px] font-serif-claude font-semibold text-[#222] tracking-normal inline-block transform scale-x-105 origin-left">Claude</span>
             </button>
          </div>
          
          {/* Toggle Button */}
          <button 
            onClick={toggleSidebar}
            className={`
              text-gray-500 hover:text-gray-700 hover:bg-black/5 rounded-lg transition-all duration-200 flex-shrink-0
              ${isCollapsed 
                ? 'w-full flex items-center justify-start px-3 py-2' 
                : 'p-2 rounded-md'
              }
            `}
          >
            <IconSidebarToggle size={18} className="text-[#666]" />
          </button>
        </div>

        {/* New Chat - Fixed */}
        <div className="px-2 pb-0.5 flex-shrink-0">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-[#2D2D2D] hover:bg-black/5 rounded-lg transition-colors group overflow-hidden whitespace-nowrap">
            <div className="text-[#333] flex-shrink-0">
               <IconPlusCircle size={18} />
            </div>
            <span className={`text-[14px] font-medium leading-none mt-0.5 transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
              New chat
            </span>
          </button>
        </div>

        {/* Scrollable Area containing Nav and Recents */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto sidebar-scroll px-2 min-h-0 pt-0.5 pb-6">
          
          {/* Navigation Links */}
          <nav className="space-y-0.5 mb-6">
            {NAV_ITEMS.map((item) => (
              <button 
                key={item.label}
                className="w-full flex items-center gap-3 px-3 py-2 text-[14px] text-[#525252] hover:bg-black/5 rounded-lg transition-colors font-medium group overflow-hidden whitespace-nowrap"
              >
                <span className="text-gray-600 flex-shrink-0 group-hover:text-gray-800 transition-colors">
                   {getIcon(item.label, 18)}
                </span>
                <span className={`leading-none mt-0.5 transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          {/* Recents Section Header - Fades out */}
          <div className={`px-3 pb-1.5 text-[11px] font-medium text-[#747474] transition-opacity duration-200 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
            Recents
          </div>

          {/* Recents List - Fades out */}
          <div className={`space-y-0.5 pb-2 transition-opacity duration-200 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
            {RECENT_CHATS.map((chat, index) => (
              <div 
                key={index}
                className={`
                  relative group flex items-center w-full px-3 py-1.5 rounded-lg transition-colors cursor-pointer min-h-[32px]
                  ${activeMenuIndex === index ? 'bg-black/5' : 'hover:bg-black/5'}
                `}
              >
                {/* Chat Title */}
                <div className="flex-1 min-w-0 pr-6">
                   <div className="text-[13px] text-[#393939] truncate leading-tight">
                     {chat}
                   </div>
                </div>

                {/* Three Dots Button */}
                <button
                  onClick={(e) => handleMenuClick(e, index)}
                  className={`
                    absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#747474] hover:text-[#393939] transition-all
                    ${activeMenuIndex === index ? 'opacity-100 block' : 'opacity-0 group-hover:opacity-100 hidden group-hover:block'}
                  `}
                >
                  <IconDotsHorizontal size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* User Profile Footer - Fixed */}
        <div className="px-3 py-3 mt-auto border-t border-claude-border flex-shrink-0 overflow-hidden">
          <button className="w-full flex items-center gap-2 hover:bg-black/5 p-2 rounded-lg transition-colors overflow-hidden whitespace-nowrap">
            <div className="w-7 h-7 rounded-full bg-claude-accent text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
              S
            </div>
            <div className={`flex items-center justify-between w-full transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
              <div className="text-left overflow-hidden">
                <div className="text-[13px] font-medium text-[#333] leading-none">Skeleton</div>
                <div className="text-[11px] text-gray-500 mt-0.5 leading-none">Max plan</div>
              </div>
              <ChevronUp size={16} className="text-gray-400" />
            </div>
          </button>
        </div>
      </div>

      {/* Fixed Context Menu Portal */}
      {activeMenuIndex !== null && menuPosition && (
        <div 
          ref={menuRef}
          className="fixed z-50 bg-white border border-[#E5E5E5] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] py-1.5 flex flex-col w-[200px]"
          style={{ 
            top: `${menuPosition.top}px`, 
            left: `${menuPosition.left}px` 
          }}
        >
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-[#F5F4F1] text-left w-full transition-colors group">
            <IconStarOutline size={16} className="text-[#525252] group-hover:text-[#393939]" />
            <span className="text-[13px] text-[#393939]">Star</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-[#F5F4F1] text-left w-full transition-colors group">
            <IconPencil size={16} className="text-[#525252] group-hover:text-[#393939]" />
            <span className="text-[13px] text-[#393939]">Rename</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-[#F5F4F1] text-left w-full transition-colors group">
            <IconProjects size={16} className="text-[#525252] group-hover:text-[#393939]" />
            <span className="text-[13px] text-[#393939]">Add to project</span>
          </button>
          <div className="h-[1px] bg-[#E8E7E3] my-1 mx-3" />
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-[#F5F4F1] text-left w-full transition-colors group">
            <IconTrash size={16} className="text-[#B9382C]" />
            <span className="text-[13px] text-[#B9382C]">Delete</span>
          </button>
        </div>
      )}
    </>
  );
};

export default Sidebar;