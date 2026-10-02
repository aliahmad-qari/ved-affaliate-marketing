import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button.tsx';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to Load Campaign Data',
  message = "We couldn't retrieve the latest campaign information right now. Please verify your connection or try again.",
  onRetry,
}) => {
  return (
    <div className="bg-[#0D1424] border border-rose-950/60 rounded-2xl p-8 md:p-12 text-center max-w-xl mx-auto my-8">
      <div className="w-14 h-14 rounded-full bg-rose-950/30 border border-rose-900/50 flex items-center justify-center mx-auto mb-4 text-rose-400">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-[#F8FAFC] mb-2">{title}</h3>
      <p className="text-sm text-[#AAB3C2] mb-6 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="md" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Request
        </Button>
      )}
    </div>
  );
};
