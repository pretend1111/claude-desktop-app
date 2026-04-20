import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { StarIcon } from './StarIcon';
import { IconPlus, IconVoice } from './Icons';

const MainContent = () => {
  const [inputText, setInputText] = useState("");

  return (
    <div className="flex-1 bg-claude-bg h-screen flex flex-col relative overflow-hidden text-[#393939]">
      {/* Top Right Icon */}
      <div className="absolute top-4 right-5 z-10">
        <div className="w-8 h-8 rounded-full bg-[#EAE8E3] flex items-center justify-center text-[#525252] hover:bg-[#E2E0DB] transition-colors cursor-pointer text-sm font-medium">
           S
        </div>
      </div>

      {/* Centered Content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[48rem] mx-auto px-4 -mt-8 pl-12">
        
        {/* Header: Icon + Text */}
        <div className="flex items-center gap-4 mb-10">
          <div className="text-claude-accent w-10 h-10 md:w-11 md:h-11 flex items-center justify-center">
            <StarIcon className="w-full h-full" />
          </div>
          <h1 className="font-serif-claude text-[32px] md:text-[38px] text-[#222] font-normal tracking-tight leading-none pt-1">
            Skeleton is thinking
          </h1>
        </div>

        {/* Input Box Area */}
        <div className="w-full relative group">
          <div className="bg-white border border-[#E5E5E5] rounded-[16px] shadow-[0_2px_6px_rgba(0,0,0,0.015)] focus-within:shadow-[0_4px_16px_rgba(0,0,0,0.04)] focus-within:border-[#D1D1D1] transition-all duration-200 overflow-hidden">
            <textarea
              className="w-full min-h-[120px] max-h-[400px] p-4 pr-12 text-[#2D2D2D] placeholder:text-[#949494] text-[17px] leading-relaxed resize-none outline-none font-sans"
              placeholder="How can I help you today?"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              style={{ paddingBottom: '3.5rem' }} 
            />

            {/* Bottom Controls */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
               {/* Left Side: Plus Icon */}
               <div className="pointer-events-auto">
                 <button className="p-2 text-[#747474] hover:text-[#2D2D2D] hover:bg-black/5 rounded-lg transition-colors">
                    <IconPlus size={20} />
                 </button>
              </div>

              {/* Right Side: Model & Voice */}
              <div className="flex items-center gap-3 pointer-events-auto">
                 <button className="flex items-center gap-1.5 text-[13px] font-medium text-[#747474] hover:bg-black/5 px-2 py-1.5 rounded-md transition-colors">
                    <span>Opus 4.6</span>
                    <ChevronDown size={14} className="text-[#999]" />
                 </button>
                 <button className="p-2 text-[#747474] hover:bg-black/5 rounded-lg transition-colors">
                    <IconVoice size={20} />
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainContent;