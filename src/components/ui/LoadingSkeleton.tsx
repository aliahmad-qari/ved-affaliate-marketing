import React from 'react';

export const CampaignSkeletonCard: React.FC = () => {
  return (
    <div className="bg-[#111A2D] border border-[#1C273C] rounded-xl p-5 md:p-6 animate-pulse flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="h-10 w-10 bg-[#1C273C] rounded-lg" />
          <div className="h-4 w-24 bg-[#1C273C] rounded" />
        </div>
        <div className="h-5 w-3/4 bg-[#1C273C] rounded mb-2" />
        <div className="h-3 w-1/3 bg-[#1C273C] rounded mb-4" />
        <div className="space-y-2 mb-6">
          <div className="h-3.5 w-full bg-[#1C273C] rounded" />
          <div className="h-3.5 w-5/6 bg-[#1C273C] rounded" />
        </div>
      </div>
      <div className="pt-4 border-t border-[#1C273C] flex items-center justify-between">
        <div>
          <div className="h-3 w-16 bg-[#1C273C] rounded mb-1" />
          <div className="h-4 w-28 bg-[#1C273C] rounded" />
        </div>
        <div className="h-9 w-28 bg-[#1C273C] rounded-lg" />
      </div>
    </div>
  );
};

export const StatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-[#0D1424] border border-[#1C273C] rounded-xl p-4 md:p-5 animate-pulse">
          <div className="h-3.5 w-24 bg-[#1C273C] rounded mb-3" />
          <div className="h-7 w-20 bg-[#1C273C] rounded mb-2" />
          <div className="h-3 w-32 bg-[#1C273C] rounded" />
        </div>
      ))}
    </div>
  );
};
