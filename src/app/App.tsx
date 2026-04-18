import React, { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SvgIcon } from "./components/ui/SvgIcon";

import { ChatsPage } from "./pages/ChatsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { CustomizePage } from "./pages/CustomizePage";
import { Claude3Page } from "./pages/Claude3Page";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState<"chat" | "customize" | "chats-list" | "projects" | "claude-3">("claude-3");
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleNavigate = () => setCurrentPage("claude-3");
    const handleCustomize = () => setCurrentPage("customize");
    window.addEventListener("navigate-claude-3", handleNavigate);
    window.addEventListener("navigate-customize", handleCustomize);
    return () => {
      window.removeEventListener("navigate-claude-3", handleNavigate);
      window.removeEventListener("navigate-customize", handleCustomize);
    };
  }, []);

  useGSAP(() => {
    if (sidebarOpen) {
      gsap.to(".sidebar-wrapper", { width: 288, duration: 0.3, ease: "power3.inOut" });
      gsap.to(".expanded-content", { opacity: 1, duration: 0.2, delay: 0.1, pointerEvents: "auto" });
      gsap.to(".collapsed-content", { opacity: 0, duration: 0.1, pointerEvents: "none" });
    } else {
      gsap.to(".sidebar-wrapper", { width: 48, duration: 0.3, ease: "power3.inOut" });
      gsap.to(".expanded-content", { opacity: 0, duration: 0.1, pointerEvents: "none" });
      gsap.to(".collapsed-content", { opacity: 1, duration: 0.2, delay: 0.1, pointerEvents: "auto" });
    }
  }, { dependencies: [sidebarOpen], scope: containerRef });

  return (
    <div ref={containerRef} className="flex h-screen w-full bg-[#f8f8f6] font-['Anthropic_Sans',sans-serif] text-[#373734] overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="sidebar-wrapper flex-shrink-0 flex flex-col border-r border-[rgba(31,31,30,0.15)] relative z-20 overflow-hidden" style={{ width: 288, backgroundImage: "linear-gradient(0deg, rgba(244, 244, 241, 0.05) 0%, rgba(244, 244, 241, 0.3) 100%), linear-gradient(90deg, rgb(248, 248, 246) 0%, rgb(248, 248, 246) 100%)" }}>
        
        {/* EXPANDED CONTENT */}
        <div className="expanded-content absolute inset-0 w-[288px] flex flex-col" style={{ opacity: 1, pointerEvents: "auto" }}>
          <div className="h-[48px] relative w-full shrink-0 flex items-center justify-between px-4 mt-2">
            <h2 className="font-['Anthropic_Serif',sans-serif] text-[18px] font-semibold text-[#121212]">Claude</h2>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="sidebar-toggle-btn w-[32px] h-[32px] rounded-[6px] flex items-center justify-center hover:bg-[#e5e5e1] transition-colors"
            >
              <SvgIcon id="p2d8d6440" className="w-5 h-5 text-[#7B7974]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative w-full pt-[8px]">
            <div className="flex flex-col space-y-[1px] px-[8px]">
              <button 
                onClick={() => setCurrentPage("chat")}
                className={`h-[32px] rounded-[6px] flex items-center px-[8px] transition-colors w-full ${currentPage === 'chat' ? 'bg-[#efeeeb]' : 'hover:bg-[#e5e5e1]'}`}
              >
                <div className="w-[20px] flex justify-center mr-[12px] shrink-0">
                  <div className="relative flex items-center justify-center size-5 bg-[rgba(123,121,116,0.15)] rounded-full">
                    <SvgIcon id="p18918770" className="w-4 h-4 text-[#373734]" />
                  </div>
                </div>
                <span className="text-[14px] text-[#373734] font-medium leading-[20px] tracking-[-0.1504px]">New chat</span>
              </button>
              
              <button className="h-[32px] rounded-[6px] flex items-center px-[8px] hover:bg-[#e5e5e1] transition-colors w-full">
                <div className="w-[20px] flex justify-center mr-[12px] shrink-0">
                  <SvgIcon id="p148e0200" className="w-[20px] h-[20px]" />
                </div>
                <span className="text-[14px] text-[#373734] font-medium leading-[20px] tracking-[-0.1504px]">Search</span>
              </button>

              <button 
                onClick={() => setCurrentPage("customize")}
                className={`h-[32px] rounded-[6px] flex items-center px-[8px] transition-colors w-full ${currentPage === 'customize' ? 'bg-[#efeeeb]' : 'hover:bg-[#e5e5e1]'}`}
              >
                <div className="w-[20px] flex justify-center mr-[12px] shrink-0">
                  <SvgIcon id="p1535dc00" className="w-[20px] h-[20px]" />
                </div>
                <span className="text-[14px] text-[#373734] font-medium leading-[20px] tracking-[-0.1504px]">Customize</span>
              </button>
            </div>

            <div className="mt-[16px] flex flex-col space-y-[1px] px-[8px]">
              <button 
                onClick={() => setCurrentPage("chats-list")}
                className={`h-[32px] rounded-[6px] flex items-center px-[8px] transition-colors w-full ${currentPage === 'chats-list' ? 'bg-[#efeeeb]' : 'hover:bg-[#e5e5e1]'}`}
              >
                <div className="w-[20px] flex justify-center mr-[12px] shrink-0">
                  <SvgIcon ids={['p9136280', 'p3cc27b00']} className="w-[20px] h-[20px]" />
                </div>
                <span className="text-[14px] text-[#373734] font-medium leading-[20px] tracking-[-0.1504px]">Chats</span>
              </button>
              <button 
                onClick={() => setCurrentPage("projects")}
                className={`h-[32px] rounded-[6px] flex items-center px-[8px] transition-colors w-full ${currentPage === 'projects' ? 'bg-[#efeeeb]' : 'hover:bg-[#e5e5e1]'}`}
              >
                <div className="w-[20px] flex justify-center mr-[12px] shrink-0">
                  <SvgIcon ids={['p444c500', 'p1016200', 'p111f6900']} className="w-[20px] h-[20px]" />
                </div>
                <span className="text-[14px] text-[#373734] font-medium leading-[20px] tracking-[-0.1504px]">Projects</span>
              </button>
              <button className="h-[32px] rounded-[6px] flex items-center px-[8px] hover:bg-[#e5e5e1] transition-colors w-full">
                <div className="w-[20px] flex justify-center mr-[12px] shrink-0">
                  <SvgIcon ids={['p39f08500', 'p31b99380', 'p1e41be00', 'p16509b00']} className="w-[20px] h-[20px]" />
                </div>
                <span className="text-[14px] text-[#373734] font-medium leading-[20px] tracking-[-0.1504px]">Artifacts</span>
               </button>
            </div>

            <div className="flex-1 flex flex-col items-center pt-[48px] px-[24px]">
              <p className="text-[14px] text-[#7b7974] tracking-[-0.1504px] text-center w-full">Your chats will show up here</p>
            </div>
          </div>

          <div className="h-[65px] border-t border-[rgba(31,31,30,0.15)] relative w-full shrink-0 group hover:bg-[#e5e5e1] cursor-pointer transition-colors flex items-center px-4 gap-3">
            <div className="bg-[#373734] rounded-full size-[36px] flex items-center justify-center text-[#f8f8f6] text-[16px] font-semibold tracking-[-0.3125px]">
              TB
            </div>
            <div className="flex flex-col flex-1 truncate">
              <div className="text-[14px] font-medium text-[#373734] truncate">Taylor Brown</div>
              <div className="text-[12px] text-[#7b7974] truncate">Free plan</div>
            </div>
          </div>
        </div>

        {/* COLLAPSED CONTENT */}
        <div className="collapsed-content absolute inset-0 w-[48px] flex flex-col items-center" style={{ opacity: 0, pointerEvents: "none" }}>
          <div className="h-[48px] relative w-full shrink-0 flex justify-center items-center pt-[8px]">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="sidebar-toggle-btn w-[32px] h-[32px] rounded-[6px] flex items-center justify-center hover:bg-[#e5e5e1] transition-colors"
            >
              <SvgIcon id="p2d8d6440" className="w-5 h-5 text-[#7B7974]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col w-full relative">
            <div className="flex flex-col gap-[1px] pt-[8px] items-center w-full">
              <button onClick={() => setCurrentPage("chat")} className={`w-[32px] h-[32px] rounded-[6px] flex items-center justify-center transition-colors ${currentPage === 'chat' ? 'bg-[#efeeeb]' : 'hover:bg-[#e5e5e1]'}`}>
                <div className="relative flex items-center justify-center size-5 bg-[rgba(123,121,116,0.15)] rounded-full">
                  <SvgIcon id="p18918770" viewBox="0 0 16 16" className="w-4 h-4 text-[#373734]" />
                </div>
              </button>
              <button className="w-[32px] h-[32px] rounded-[6px] flex items-center justify-center hover:bg-[#e5e5e1] transition-colors">
                <SvgIcon id="p148e0200" className="w-[20px] h-[20px] text-[#121212]" />
              </button>
              <button onClick={() => setCurrentPage("customize")} className={`w-[32px] h-[32px] rounded-[6px] flex items-center justify-center transition-colors ${currentPage === 'customize' ? 'bg-[#efeeeb]' : 'hover:bg-[#e5e5e1]'}`}>
                 <SvgIcon id="p1535dc00" className="w-[20px] h-[20px] text-[#121212]" />
              </button>
            </div>

            <div className="flex flex-col gap-[1px] pt-[16px] items-center w-full">
              <button onClick={() => setCurrentPage("chats-list")} className={`w-[32px] h-[32px] rounded-[6px] flex items-center justify-center transition-colors ${currentPage === 'chats-list' ? 'bg-[#efeeeb]' : 'hover:bg-[#e5e5e1]'}`}>
                <SvgIcon ids={['p9136280', 'p3cc27b00']} className="w-[20px] h-[20px] text-[#121212]" />
              </button>
              <button onClick={() => setCurrentPage("projects")} className={`w-[32px] h-[32px] rounded-[6px] flex items-center justify-center transition-colors ${currentPage === 'projects' ? 'bg-[#efeeeb]' : 'hover:bg-[#e5e5e1]'}`}>
                <SvgIcon ids={['p444c500', 'p1016200', 'p111f6900']} className="w-[20px] h-[20px] text-[#121212]" />
              </button>
              <button className="w-[32px] h-[32px] rounded-[6px] flex items-center justify-center hover:bg-[#e5e5e1] transition-colors">
                <SvgIcon ids={['p39f08500', 'p31b99380', 'p1e41be00', 'p16509b00']} className="w-[20px] h-[20px] text-[#121212]" />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center w-full shrink-0">
            <div className="h-[65px] border-t border-[rgba(31,31,30,0.15)] w-full flex items-center justify-center hover:bg-[#e5e5e1] cursor-pointer transition-colors relative">
              <div className="w-[36px] h-[36px] rounded-full bg-[#373734] flex items-center justify-center text-[#f8f8f6] text-[16px] font-semibold tracking-[-0.3125px]">
                TB
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {currentPage === "claude-3" ? (
           <Claude3Page />
        ) : currentPage === "projects" ? (
           <ProjectsPage onNewProject={() => setCurrentPage('chat')} />
        ) : currentPage === "chats-list" ? (
           <ChatsPage onNewChat={() => setCurrentPage('chat')} />
        ) : currentPage === "customize" ? (
           <CustomizePage />
        ) : (
          <>
            <div className="absolute top-4 right-4 z-10 flex items-center">
              <button className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#e5e5e1] transition-colors" title="Incognito Chat">
                <SvgIcon ids={['ghost0', 'ghost1', 'ghost2']} className="w-5 h-5 text-[#7b7974]" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full px-4 sm:px-6 md:px-8 pb-32">
              <div className="flex flex-col items-center mb-8">
                <button className="inline-flex items-center justify-center rounded-lg bg-[#efeeeb] h-8 px-2.5 text-sm text-[#7b7974] mb-7 hover:bg-[#e5e5e1] transition-colors underline decoration-solid">
                  Get Pro
                </button>
                <div className="flex items-center gap-4 text-center">
                  <SvgIcon id="p1ed7f400" viewBox="0 0 32 32" className="w-8 h-8 text-[#D97757]" />
                  <h1 className="text-4xl font-serif text-[#373734]">
                    Good evening, Taylor Brown
                  </h1>
                </div>
              </div>

              <div className="w-full relative z-30">
                <div className="bg-white rounded-[20px] shadow-[0px_4px_20px_0px_rgba(0,0,0,0.04),0px_0px_0px_0px_rgba(31,31,30,0.15)] border border-transparent hover:border-[#1f1f1e]/15 transition-colors focus-within:border-[#1f1f1e]/30">
                  <div className="flex flex-col p-4 pb-2 min-h-[122px]">
                    <textarea 
                      placeholder="How can I help you today?" 
                      className="w-full bg-transparent resize-none outline-none text-[#373734] placeholder-[#7b7974] flex-1 text-[16px]"
                      rows={2}
                    />
                    
                    <div className="flex items-center justify-between mt-2 pt-2">
                      <div className="flex items-center relative">
                        <button 
                          onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[#373734] ${isAddMenuOpen ? 'bg-[#f8f8f6]' : 'hover:bg-[#f8f8f6]'}`}
                        >
                          <SvgIcon id="p24478200" viewBox="0 0 20 20" className="w-5 h-5" />
                        </button>

                        {isAddMenuOpen && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 bg-white border border-[rgba(31,31,30,0.15)] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] py-[6px] min-w-[200px] z-50 flex flex-col">
                            <button className="w-full flex items-center gap-[12px] px-[12px] py-[8px] hover:bg-[#f8f8f6] transition-colors text-left group">
                              <SvgIcon id="p39ddd900" viewBox="0 0 16 16" className="w-4 h-4 text-[#373734]" />
                              <span className="text-[14px] text-[#373734] font-medium">Upload docs</span>
                            </button>
                            <button className="w-full flex items-center gap-[12px] px-[12px] py-[8px] hover:bg-[#f8f8f6] transition-colors text-left group">
                              <SvgIcon ids={['p444c500', 'p1016200', 'p111f6900']} viewBox="0 0 20 20" className="w-4 h-4 text-[#373734]" />
                              <span className="text-[14px] text-[#373734] font-medium">Project</span>
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button className="h-8 px-3 rounded-lg hover:bg-[#f8f8f6] transition-colors flex items-center space-x-1.5 group">
                          <span className="text-sm text-[#373734] font-medium">Sonnet 4.6</span>
                          <span className="text-sm text-[#7b7974] group-hover:text-[#373734] transition-colors">Extended</span>
                          <SvgIcon id="pde2630" viewBox="0 0 16 16" className="w-4 h-4 text-[#7b7974] group-hover:text-[#373734]" />
                        </button>
                        <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#f8f8f6] hover:bg-[#e5e5e1] text-[#121212] transition-colors">
                          <SvgIcon ids={['p1a44fa00', 'p82ec900', 'p1b1b9600', 'p22390600', 'p140cb400', 'p34a77500']} viewBox="0 0 20 20" className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                  <button className="h-8 px-3 bg-[#f8f8f6] border border-[#1f1f1e]/15 rounded-lg flex items-center gap-1.5 hover:bg-[#efeeeb] transition-colors">
                    <SvgIcon id="p1dfefa80" className="w-4 h-4 text-[#7B7974]" />
                    <span className="text-sm text-[#373734] font-medium">Write</span>
                  </button>
                  <button className="h-8 px-3 bg-[#f8f8f6] border border-[#1f1f1e]/15 rounded-lg flex items-center gap-1.5 hover:bg-[#efeeeb] transition-colors">
                    <SvgIcon id="pa173e00" className="w-4 h-[14.4px] text-[#7B7974]" />
                    <span className="text-sm text-[#373734] font-medium">Learn</span>
                  </button>
                  <button className="h-8 px-3 bg-[#f8f8f6] border border-[#1f1f1e]/15 rounded-lg flex items-center gap-1.5 hover:bg-[#efeeeb] transition-colors">
                    <SvgIcon id="p254e9040" className="w-[15.2px] h-[12px] text-[#7B7974]" />
                    <span className="text-sm text-[#373734] font-medium">Code</span>
                  </button>
                  <button className="h-8 px-3 bg-[#f8f8f6] border border-[#1f1f1e]/15 rounded-lg flex items-center gap-1.5 hover:bg-[#efeeeb] transition-colors">
                    <SvgIcon id="p3dd3fc00" className="w-[14.4px] h-[13.6px] text-[#7B7974]" />
                    <span className="text-sm text-[#373734] font-medium">Life stuff</span>
                  </button>
                  <button className="h-8 px-3 bg-[#f8f8f6] border border-[#1f1f1e]/15 rounded-lg flex items-center gap-1.5 hover:bg-[#efeeeb] transition-colors">
                    <SvgIcon id="p27281480" className="w-[11.2px] h-[14.4px] text-[#7B7974]" />
                    <span className="text-sm text-[#373734] font-medium">Claude's choice</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
