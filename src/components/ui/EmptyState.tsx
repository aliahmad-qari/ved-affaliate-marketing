import React from 'react';
import { Layers, RotateCcw } from 'lucide-react';
import { Button } from './Button.tsx';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Campaigns Found',
  description = 'There are no active campaigns matching your current filter criteria.',
  actionText = 'Reset Filters',
  onAction,
}) => {
  return (
    <div className="bg-[#0D1424] border border-[#1C273C] rounded-2xl p-8 md:p-12 text-center max-w-xl mx-auto my-8">
      <div className="w-14 h-14 rounded-full bg-[#111A2D] border border-[#1C273C] flex items-center justify-center mx-auto mb-4 text-[#D4AF37]">
        <Layers className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-[#F8FAFC] mb-2">{title}</h3>
      <p className="text-sm text-[#AAB3C2] mb-6 leading-relaxed">{description}</p>
      {onAction && (
        <Button variant="secondary" size="md" onClick={onAction}>
          <RotateCcw className="w-4 h-4 mr-2" />
          {actionText}
        </Button>
      )}
    </div>
  );
};
