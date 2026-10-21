import React, { useEffect, useRef } from 'react';

export function ManualCopyField({ text, onClose }: { text: string; onClose: () => void }) {
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { field.current?.scrollIntoView({ block: 'center' }); field.current?.focus({ preventScroll: true }); field.current?.select(); }, [text]);
  return <div className="min-w-0 rounded-xl border border-[#D4AF37]/40 bg-[#0B1325] p-4">
    <p role="status" className="mb-2 text-xs text-[#AAB3C2]">Automatic copying is unavailable. Select the text below and copy it manually.</p>
    <label className="block text-xs font-semibold text-[#F8FAFC]">Text to copy
      <textarea ref={field} readOnly value={text} rows={3} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} className="mt-2 block w-full min-w-0 resize-y rounded-lg border border-[#263650] bg-[#070B14] p-3 font-mono text-base text-[#F8FAFC] outline-none focus:border-[#D4AF37]" />
    </label>
    <button type="button" onClick={onClose} className="mt-2 text-xs font-semibold text-[#D4AF37] hover:underline">Dismiss</button>
  </div>;
}
