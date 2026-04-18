import React, { useState } from "react";
import { SvgIcon } from "../components/ui/SvgIcon";

export function Claude3Page() {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  return (
    <div className="flex h-full w-full bg-[#f8f8f6] overflow-hidden">
      
      {/* 1. WORKSPACE SIDEBAR (File Tree & Skills) */}
      <div className="w-[256px] h-full flex flex-col border-r border-[rgba(31,31,30,0.15)] bg-[#f8f8f6] shrink-0">
        
        {/* Back header */}
        <div className="h-[56px] shrink-0 border-b border-[rgba(31,31,30,0.05)] flex items-center px-4">
          <button 
            className="flex items-center gap-2 text-[#121212] hover:bg-[#e5e5e1] px-2 py-1.5 rounded-[6px] transition-colors"
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-customize'))}
          >
            <SvgIcon ids={['p19b6b600']} viewBox="0 0 20 20" className="w-[20px] h-[20px]" />
            <span className="font-['Anthropic_Sans',sans-serif] font-semibold text-[16px] tracking-[-0.3125px]">Customize</span>
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto w-full p-2 flex flex-col gap-[2px]">
          {/* Top Links */}
          <button className="flex items-center gap-3 w-full h-[32px] px-3 rounded-[8px] bg-[#efeeeb] text-[#121212]">
            <SvgIcon ids={['p2585a880', 'p1c779f80']} viewBox="0 0 20 20" className="w-5 h-5" />
            <span className="font-semibold text-[14px] tracking-[-0.15px]">Skills</span>
          </button>
          
          <button className="flex items-center gap-3 w-full h-[32px] px-3 rounded-[8px] hover:bg-[#e5e5e1] transition-colors text-[#121212]">
            <SvgIcon ids={['p1edb9300', 'p38541100']} viewBox="0 0 20 20" className="w-5 h-5" />
            <span className="text-[14px] tracking-[-0.15px]">Connectors</span>
          </button>

          {/* Section: Personal Skills File Tree */}
          <div className="mt-6 px-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[#7b7974]">
              <span className="text-[12px] uppercase font-semibold">Personal skills</span>
              <div className="flex gap-1">
                <button className="w-[24px] h-[24px] rounded-[6px] hover:bg-[#e5e5e1] flex items-center justify-center transition-colors">
                  <SvgIcon id="p148e0200" viewBox="0 0 20 20" className="w-4 h-4 text-[#373734]" />
                </button>
                <button className="w-[24px] h-[24px] rounded-[6px] hover:bg-[#e5e5e1] flex items-center justify-center transition-colors">
                  <SvgIcon id="p24478200" viewBox="0 0 20 20" className="w-4 h-4 text-[#373734]" />
                </button>
              </div>
            </div>

            {/* Tree root */}
            <div className="flex flex-col gap-1 w-full mt-2">
              <div className="flex items-center gap-2 bg-white border border-[rgba(31,31,30,0.15)] shadow-sm rounded-[6px] px-2 py-1.5 select-none relative z-10 w-full mb-1">
                <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-[rgba(31,31,30,0.1)]">
                   <SvgIcon ids={['p2585a880', 'p1c779f80']} viewBox="0 0 20 20" className="w-4 h-4 text-[#373734]" />
                </div>
                <span className="text-[14px] font-semibold text-[#121212]">skill-creator</span>
                <SvgIcon id="pe052170" viewBox="0 0 16 16" className="w-4 h-4 ml-auto text-[#373734]" />
              </div>

              {/* Sub items */}
              <div className="flex flex-col border-l border-[rgba(31,31,30,0.15)] ml-[14px] pl-[10px] gap-1">
                <button className="flex items-center gap-2 w-full text-left py-1 hover:text-[#121212] transition-colors group">
                  <span className="text-[14px] text-[#373734] group-hover:text-[#121212]">SKILL.md</span>
                </button>
                <button className="flex items-center gap-2 w-full text-left py-1 hover:text-[#121212] transition-colors group">
                  <SvgIcon id="p1f0ee8f0" viewBox="0 0 16 16" className="w-3 h-3 text-[#373734]" />
                  <span className="text-[14px] text-[#373734] group-hover:text-[#121212]">agents</span>
                </button>
                <button className="flex items-center gap-2 w-full text-left py-1 hover:text-[#121212] transition-colors group">
                  <SvgIcon id="p1f0ee8f0" viewBox="0 0 16 16" className="w-3 h-3 text-[#373734]" />
                  <span className="text-[14px] text-[#373734] group-hover:text-[#121212]">assets</span>
                </button>
                <button className="flex items-center gap-2 w-full text-left py-1 hover:text-[#121212] transition-colors group">
                  <SvgIcon id="p1f0ee8f0" viewBox="0 0 16 16" className="w-3 h-3 text-[#373734]" />
                  <span className="text-[14px] text-[#373734] group-hover:text-[#121212]">eval-viewer</span>
                </button>
                <button className="flex items-center gap-2 w-full text-left py-1 hover:text-[#121212] transition-colors group">
                  <SvgIcon id="p1f0ee8f0" viewBox="0 0 16 16" className="w-3 h-3 text-[#373734]" />
                  <span className="text-[14px] text-[#373734] group-hover:text-[#121212]">references</span>
                </button>
                <button className="flex items-center gap-2 w-full text-left py-1 hover:text-[#121212] transition-colors group">
                  <SvgIcon id="p1f0ee8f0" viewBox="0 0 16 16" className="w-3 h-3 text-[#373734]" />
                  <span className="text-[14px] text-[#373734] group-hover:text-[#121212]">scripts</span>
                </button>
              </div>

              {/* Add files button */}
              <button className="mt-2 flex items-center justify-center gap-2 h-[32px] w-[140px] border border-dashed border-[rgba(31,31,30,0.3)] rounded-[6px] text-[#373734] text-[12px] font-medium hover:bg-[rgba(31,31,30,0.05)] transition-colors mx-auto relative group">
                <SvgIcon id="p24478200" viewBox="0 0 20 20" className="w-3.5 h-3.5" />
                Add files
              </button>

            </div>
          </div>
        </div>
      </div>

      {/* 2. CHAT PANEL (Main Right Side) */}
      <div className="flex-1 flex flex-col relative w-full h-full bg-white">
        
        {/* Top Header Settings */}
        <div className="absolute top-4 right-4 z-10 flex items-center">
          <button className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#e5e5e1] transition-colors" title="Incognito Chat">
            <SvgIcon ids={['ghost0', 'ghost1', 'ghost2']} className="w-5 h-5 text-[#7b7974]" />
          </button>
        </div>

        {/* Dynamic Chat / Context */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-10 flex flex-col w-full">
           <div className="max-w-[760px] mx-auto w-full flex flex-col gap-6">
              
              {/* Output Preview Window (if they opened an artifact/skill preview)  */}
              <div className="w-full bg-[#f8f8f6] rounded-[16px] border border-[rgba(31,31,30,0.1)] h-[240px] flex items-center justify-center relative overflow-hidden shadow-sm">
                 <div className="absolute top-3 left-4 flex gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-[#e34234] opacity-80" />
                   <div className="w-2.5 h-2.5 rounded-full bg-[#f4c63d] opacity-80" />
                   <div className="w-2.5 h-2.5 rounded-full bg-[#52c136] opacity-80" />
                 </div>
                 <p className="text-[#7b7974] text-[14px] font-mono">Loading workplace context...</p>
              </div>

              {/* Chat Message Bubble */}
              <div className="flex w-full mt-4">
                 <div className="w-[32px] h-[32px] rounded-full shrink-0 flex items-center justify-center bg-[#D97757] text-white">
                   <SvgIcon id="p1ed7f400" viewBox="0 0 32 32" className="w-5 h-5 text-white" />
                 </div>
                 <div className="flex flex-col ml-4 pt-1 flex-1">
                   <span className="font-semibold text-[#121212] tracking-[-0.1px] mb-2">Claude</span>
                   <div className="text-[16px] text-[#373734] leading-[26px]">
                     I've opened the <strong>skill-creator</strong> workspace. You can find all scripts and context in the left panel. To begin making edits, provide a prompt or upload additional files.
                   </div>
                 </div>
              </div>

           </div>
        </div>

        {/* Input Area (Pinned to Bottom) */}
        <div className="shrink-0 w-full px-4 sm:px-8 pb-8 bg-gradient-to-t from-white via-white to-transparent pt-6">
           <div className="max-w-[760px] mx-auto w-full">
              <div className="bg-[#f8f8f6] rounded-[20px] shadow-[0px_4px_20px_0px_rgba(0,0,0,0.04),0px_0px_0px_0px_rgba(31,31,30,0.15)] border border-[rgba(31,31,30,0.15)] focus-within:border-[#1f1f1e]/30 transition-colors">
                <div className="flex flex-col p-4 min-h-[100px]">
                  <textarea 
                    placeholder="Instructions for the skill-creator..." 
                    className="w-full bg-transparent resize-none outline-none text-[#373734] placeholder-[#7b7974] flex-1 text-[16px]"
                    rows={2}
                  />
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-transparent">
                    <div className="flex items-center relative">
                      <button 
                        onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[#373734] ${isAddMenuOpen ? 'bg-[#efeeeb]' : 'hover:bg-[#efeeeb]'}`}
                      >
                        <SvgIcon id="p24478200" viewBox="0 0 20 20" className="w-5 h-5" />
                      </button>

                      {isAddMenuOpen && (
                        <div className="absolute bottom-[calc(100%+8px)] left-0 bg-white border border-[rgba(31,31,30,0.15)] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] py-[6px] min-w-[200px] z-50 flex flex-col">
                          <button className="w-full flex items-center gap-[12px] px-[12px] py-[8px] hover:bg-[#f8f8f6] transition-colors text-left group">
                            <SvgIcon id="p39ddd900" viewBox="0 0 16 16" className="w-4 h-4 text-[#373734]" />
                            <span className="text-[14px] text-[#373734] font-medium">Upload docs</span>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button className="h-8 px-3 rounded-[8px] hover:bg-[#e5e5e1] transition-colors flex items-center gap-1.5 bg-white border border-[rgba(31,31,30,0.1)] shadow-sm">
                        <span className="text-sm text-[#373734] font-medium">Sonnet 4.6</span>
                        <SvgIcon id="pde2630" viewBox="0 0 16 16" className="w-4 h-4 text-[#7b7974]" />
                      </button>
                      <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#e5e5e1] hover:bg-[#d6d6d2] text-[#121212] transition-colors">
                        <SvgIcon ids={['p1a44fa00', 'p82ec900', 'p1b1b9600', 'p22390600', 'p140cb400', 'p34a77500']} viewBox="0 0 20 20" className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
