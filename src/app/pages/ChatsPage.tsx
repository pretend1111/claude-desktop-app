import React from "react";
import { SvgIcon } from "../components/ui/SvgIcon";
import { OriginalSvgPaths } from "../icons";

interface ChatsPageProps {
  onNewChat?: () => void;
}

export function ChatsPage({ onNewChat }: ChatsPageProps) {
  return (
    <div className="flex flex-1 flex-col h-full w-full bg-[#f8f8f6] overflow-y-auto pt-[0px]">
      <div className="bg-[#f8f8f6] flex items-end h-[96px] shrink-0 w-full max-w-[896px] mx-auto px-8 pb-4">
        <div className="flex items-center justify-between w-full">
          <h1 className="font-['Anthropic_Serif',sans-serif] text-[24px] text-[#121212]">
            Chats
          </h1>
          <button 
            onClick={onNewChat}
            className="flex items-center justify-center gap-[6px] h-[36px] px-4 rounded-[8px] bg-[#121212] hover:bg-[#373734] transition-colors cursor-pointer text-white text-[14px] font-medium"
          >
            <SvgIcon id="p18918770" viewBox="0 0 16 16" className="w-4 h-4 text-white" />
            <span>New chat</span>
          </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-[896px] mx-auto px-8 mt-[24px]">
        <div className="relative flex items-center w-full h-[44px] bg-white border border-[rgba(31,31,30,0.15)] rounded-[9.6px] px-4 overflow-hidden focus-within:border-[#1f1f1e]/30 transition-colors">
          <SvgIcon id="p148e0200" viewBox="0 0 20 20" className="w-5 h-5 text-[#373734] mr-3" />
          <input 
            type="text" 
            placeholder="Search your chats..." 
            className="flex-1 h-full bg-transparent outline-none text-[16px] text-[#373734] placeholder:text-[#7b7974]"
          />
        </div>

        <div className="flex items-center justify-between w-full mt-12 mb-8">
          <span className="text-[#7b7974] text-[14px]">Your chats with Claude</span>
          <button className="text-[#184e95] text-[14px] underline decoration-solid hover:opacity-80 transition-opacity">
            Select
          </button>
        </div>

        <div className="flex flex-col items-center justify-center w-full py-16 border-t border-[rgba(31,31,30,0.05)]">
          <div className="size-[96px] bg-transparent rounded-2xl flex items-center justify-center mb-6">
            <svg className="w-24 h-24" fill="none" preserveAspectRatio="none" viewBox="0 0 96 96">
              <path d={OriginalSvgPaths.p21496e80} fill="#E6E5E0" />
              <path d={OriginalSvgPaths.p635f00} fill="#121212" />
              <path d={OriginalSvgPaths.p1ae11cf0} fill="#121212" />
            </svg>
          </div>
          <h3 className="text-[#373734] text-[16px] font-medium mb-2">
            Ready for your first chat?
          </h3>
          <p className="text-[#373734] text-[14px] text-center max-w-[384px] leading-[20px] mb-8">
            Think through anything with Claude—from big ideas to quick questions. Your chats will show up here.
          </p>
          <button 
            onClick={onNewChat}
            className="flex items-center justify-center gap-[6px] h-[36px] px-4 rounded-[8px] border border-[rgba(31,31,30,0.3)] hover:bg-[rgba(31,31,30,0.05)] transition-colors cursor-pointer text-[#121212] text-[14px] font-medium"
          >
            <SvgIcon id="p18918770" viewBox="0 0 16 16" className="w-4 h-4 text-[#121212]" />
            <span>New chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
