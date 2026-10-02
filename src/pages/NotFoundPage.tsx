import React from 'react';
import { Home, Layers } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';

interface NotFoundPageProps {
  onNavigate: (tab: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => {
  return (
    <div className="py-20 md:py-32 text-center max-w-xl mx-auto px-4">
      <div className="text-6xl sm:text-8xl font-mono font-extrabold text-[#D4AF37] mb-4">
        404
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] mb-3">
        Page Not Found
      </h1>
      <p className="text-sm text-[#AAB3C2] mb-8 leading-relaxed">
        The requested route does not exist on VED AFFILIATE PVT. LIMITED. Please check the URL or use our navigation to return to the active platform.
      </p>

      <div className="flex items-center justify-center gap-3">
        <Button variant="primary" size="md" onClick={() => onNavigate('home')}>
          <Home className="w-4 h-4 mr-2" />
          <span>Back to Home</span>
        </Button>
        <Button variant="secondary" size="md" onClick={() => onNavigate('campaigns')}>
          <Layers className="w-4 h-4 mr-2" />
          <span>Active Campaigns</span>
        </Button>
      </div>
    </div>
  );
};
