import React, { useState } from "react";
import { SvgIcon } from "../components/ui/SvgIcon";
import { OriginalSvgPaths } from "../icons";

export function CustomizePage() {
  const [activeTab, setActiveTab] = useState<"skills" | "connectors">("skills");

  return (
    <div className="flex flex-1 h-full w-full bg-[#f8f8f6] overflow-hidden">
      {/* Inner Navigation Sidebar */}
      <div className="w-[256px] border-r border-[#1f1f1e]/15 flex flex-col bg-[#f8f8f6] shrink-0">
        <div className="h-[56px] flex items-center px-4 relative">
          <button 
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#e5e5e1] transition-colors absolute left-4"
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-claude-3'))}
          >
            <SvgIcon id="p19b6b600" className="w-5 h-5 text-[#373734]" />
          </button>
          <h2 className="text-[#121212] font-semibold text-[16px] leading-[22.4px] w-full text-center tracking-[-0.31px]">
            Customize
          </h2>
        </div>

        <div className="flex flex-col gap-[1px] p-2 mt-2">
          <button 
            onClick={() => setActiveTab("skills")}
            className={`w-full flex items-center gap-3 px-4 py-1.5 rounded-lg transition-colors ${
              activeTab === "skills" ? "bg-[#efeeeb]" : "hover:bg-[#e5e5e1]"
            }`}
          >
            <SvgIcon ids={['p2585a880', 'p1c779f80']} className="w-5 h-5 text-[#121212]" />
            <span className="text-[#121212] text-sm leading-5 tracking-[-0.15px]">Skills</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("connectors")}
            className={`w-full flex items-center gap-3 px-4 py-1.5 rounded-lg transition-colors ${
              activeTab === "connectors" ? "bg-[#efeeeb]" : "hover:bg-[#e5e5e1]"
            }`}
          >
            <SvgIcon ids={['p1edb9300', 'p38541100']} className="w-5 h-5 text-[#121212]" />
            <span className="text-[#121212] text-sm leading-5 tracking-[-0.15px]">Connectors</span>
          </button>
        </div>
      </div>

      {/* Main Form Area */}
      <div className="flex-1 flex flex-col items-center overflow-y-auto">
        <div className="flex flex-col items-center w-full max-w-[530px] pt-[24vh] pb-24 px-4">
          
          {/* Header Graphic */}
          <div className="w-[96px] h-[96px] relative mb-4">
            <div className="absolute inset-[10.71%_24.01%_34.73%_24.34%]"><svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 49.5802 52.3731"><path d={OriginalSvgPaths.p30230880} fill="#E6E5E0" /></svg></div>
            <div className="absolute inset-[26.87%_1.75%_10.09%_1.6%]"><svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 92.7853 60.5158"><path d={OriginalSvgPaths.p3b1ed5f0} fill="#121212" /></svg></div>
            <div className="absolute inset-[55.17%_3.22%_41.97%_3.32%]"><svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 89.7208 2.74418"><path d={OriginalSvgPaths.p3dd8a200} fill="#121212" /></svg></div>
            <div className="absolute inset-[10%_22.84%_33.29%_23.52%]"><svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 51.4902 54.437"><path d={OriginalSvgPaths.p19d84b00} fill="#121212" /></svg></div>
            <div className="absolute inset-[16.39%_37.81%_71.69%_37.82%]"><svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.3945 11.4391"><path d={OriginalSvgPaths.p3c67d2c0} fill="#121212" /></svg></div>
          </div>

          <h1 className="text-[24px] text-[#121212] font-serif font-medium leading-[31.2px] mb-1.5 text-center">
            Customize Claude
          </h1>
          <p className="text-[14px] text-[#373734] leading-[20px] tracking-[-0.15px] mb-10 text-center">
            Skills, connectors, and plugins shape how Claude works with you.
          </p>

          <div className="flex flex-col gap-3 w-full">
            {/* Connectors Card */}
            <button className="flex items-center gap-4 p-[21px] bg-white rounded-[24px] border border-[#1f1f1e]/15 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#f3f2ef] transition-colors w-full text-left">
              <div className="w-8 h-8 rounded-full bg-[#efeeeb] flex items-center justify-center shrink-0">
                <SvgIcon ids={['p1edb9300', 'p38541100']} className="w-5 h-5 text-[#121212]" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[#121212] text-sm font-medium leading-[19.6px] tracking-[-0.15px]">Connect your apps</span>
                <span className="text-[#373734] text-sm leading-5 tracking-[-0.15px]">Let Claude read and write to the tools you already use.</span>
              </div>
            </button>

            {/* Skills Card */}
            <button className="flex items-center gap-4 p-[21px] bg-white rounded-[24px] border border-[#1f1f1e]/15 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#f3f2ef] transition-colors w-full text-left">
              <div className="w-8 h-8 rounded-full bg-[#efeeeb] flex items-center justify-center shrink-0">
                <SvgIcon ids={['p2585a880', 'p1c779f80']} className="w-5 h-5 text-[#121212]" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[#121212] text-sm font-medium leading-[19.6px] tracking-[-0.15px]">Create new skills</span>
                <span className="text-[#373734] text-sm leading-5 tracking-[-0.15px]">Teach Claude your processes, team norms, and expertise.</span>
              </div>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
