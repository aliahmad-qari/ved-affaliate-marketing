import React, { useState } from 'react';
import { Megaphone, Pause, Play } from 'lucide-react';
import type { PublicStats } from '../../services/api.ts';
import './activity-ticker.css';

export const ActivityTicker: React.FC<{ stats: PublicStats | null }> = ({ stats }) => {
  const [paused, setPaused] = useState(false);
  const count = (value: number) => value.toLocaleString('en-IN');
  const messages = stats ? [
    `${count(stats.activePartners)} active partners on VED Affiliate`,
    `₹${stats.totalPayouts.toLocaleString('en-IN', { maximumFractionDigits: 2 })} paid to partners`,
    `${count(stats.approvedLeads)} approved leads across the platform`,
    `${count(stats.liveCampaigns)} campaigns currently LIVE`,
  ] : [
    'Promote • Earn • Grow with VED Affiliate',
    'Earn on eligible, verified conversions',
    'Track your leads and earnings in the Partner Dashboard',
    'Request eligible earnings through Bank or UPI',
  ];
  return <aside aria-label="VED partner updates" className="ved-activity-strip">
    <div className="ved-activity-label"><Megaphone aria-hidden="true" className="h-3.5 w-3.5" /><span>VED UPDATES</span></div>
    <ul className="sr-only">{messages.map(message => <li key={message}>{message}</li>)}</ul>
    <div className="ved-activity-window" aria-hidden="true"><div className={`ved-activity-track${paused ? ' is-paused' : ''}`}>
      {[0, 1].map(copy => <div key={copy} className="ved-activity-group">{messages.map(message => <span key={message} className="ved-activity-item"><span className="ved-activity-dot" />{message}</span>)}</div>)}
    </div></div>
    <button type="button" aria-label={paused ? 'Resume scrolling updates' : 'Pause scrolling updates'} aria-pressed={paused} onClick={() => setPaused(value => !value)} className="ved-activity-control">{paused ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : <Pause aria-hidden="true" className="h-3.5 w-3.5" />}</button>
  </aside>;
};
