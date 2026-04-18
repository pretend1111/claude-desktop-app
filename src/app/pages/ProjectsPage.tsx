import React from "react";
import { SvgIcon } from "../components/ui/SvgIcon";
import { OriginalSvgPaths } from "../icons";

interface ProjectsPageProps {
  onNewProject?: () => void;
}

export function ProjectsPage({ onNewProject }: ProjectsPageProps) {
  return (
    <div className="flex flex-1 flex-col h-full w-full bg-[#f8f8f6] overflow-y-auto pt-[0px]">
      <div className="bg-[#f8f8f6] flex items-end h-[96px] shrink-0 w-full max-w-[896px] mx-auto px-8 pb-4">
        <div className="flex items-center justify-between w-full">
          <h1 className="font-['Anthropic_Serif',sans-serif] text-[24px] text-[#121212]">
            Projects
          </h1>
          <button 
            onClick={onNewProject}
            className="flex items-center justify-center gap-[6px] h-[36px] px-4 rounded-[8px] bg-[#121212] hover:bg-[#373734] transition-colors cursor-pointer text-white text-[14px] font-medium"
          >
            <SvgIcon ids={['p444c500', 'p1016200', 'p111f6900']} viewBox="0 0 20 20" className="w-4 h-4 text-white" />
            <span>New project</span>
          </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-[896px] mx-auto px-8 mt-[24px]">
        <div className="bg-white border border-[rgba(31,31,30,0.15)] rounded-[12px] p-8 min-h-[70vh] flex flex-col shadow-sm">
          <div className="flex flex-col gap-4 w-full">
            <div className="relative flex items-center w-full h-[44px] bg-white border border-[rgba(31,31,30,0.15)] rounded-[9.6px] px-4 overflow-hidden focus-within:border-[#1f1f1e]/30 transition-colors">
              <SvgIcon id="p148e0200" viewBox="0 0 20 20" className="w-5 h-5 text-[#373734] mr-3" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="flex-1 h-full bg-transparent outline-none text-[16px] text-[#373734] placeholder:text-[#7b7974]"
              />
            </div>

            <div className="flex items-center justify-end w-full mb-8">
              <span className="text-[#7b7974] text-[14px] mr-2">Sort by</span>
              <button className="flex items-center gap-1 h-[36px] px-3 rounded-[8px] border border-transparent hover:border-[rgba(31,31,30,0.3)] transition-colors text-[#373734] text-[14px] font-medium">
                Activity
                <SvgIcon id="pde2630" viewBox="0 0 16 16" className="w-4 h-4 text-[#7b7974]" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center w-full py-16">
            <div className="size-[96px] bg-transparent rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-24 h-24" fill="none" preserveAspectRatio="none" viewBox="0 0 96 96">
                <path d={OriginalSvgPaths.pa12bc80} fill="#E6E5E0" />
                <path d={OriginalSvgPaths.p1d410280} fill="#121212" />
                <path d={OriginalSvgPaths.p3b760c10} fill="#121212" />
                <path d={OriginalSvgPaths.p27b02a80} fill="#121212" />
              </svg>
            </div>
            <h3 className="text-[#373734] text-[16px] font-medium mb-2">
              Looking to start a project?
            </h3>
            <p className="text-[#373734] text-[14px] text-center max-w-[384px] leading-[20px] mb-8">
              Upload materials, set custom instructions, and organize conversations in one space.
            </p>
            <button 
              onClick={onNewProject}
              className="flex items-center justify-center gap-[6px] h-[36px] px-4 rounded-[8px] border border-[rgba(31,31,30,0.3)] hover:bg-[rgba(31,31,30,0.05)] transition-colors cursor-pointer text-[#121212] text-[14px] font-medium"
            >
              <SvgIcon ids={['p444c500', 'p1016200', 'p111f6900']} viewBox="0 0 20 20" className="w-4 h-4 text-[#121212]" />
              <span>New project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
