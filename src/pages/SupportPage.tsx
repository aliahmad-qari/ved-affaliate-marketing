import React, { useState } from 'react';
import { Mail, Phone, MapPin, MessageSquare, Send, CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { WhatsAppButton } from '../components/ui/WhatsAppButton.tsx';
import { VedLogo } from '../components/ui/VedLogo.tsx';
import { submitSupportTicket } from '../services/api.ts';

export const SupportPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    subject: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{ ticketId: string; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim() || !formData.email.trim() || !formData.mobile.trim() || !formData.subject.trim() || !formData.message.trim()) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await submitSupportTicket(formData);
      if (res.success) {
        setSubmitSuccess({
          ticketId: res.data.ticketId,
          message: res.message || 'Support ticket logged.',
        });
        setFormData({
          name: '',
          email: '',
          mobile: '',
          subject: '',
          message: '',
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit ticket. Please reach out via WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      q: 'How does lead verification work?',
      a: 'Submitted leads stay in Pending status until VED Admin cross-references broker logs. Only verified completions turn Approved.',
    },
    {
      q: 'What is the minimum withdrawal?',
      a: 'The minimum withdrawal is ₹200. Payouts are manually processed via UPI or direct Bank Transfer by Admin.',
    },
    {
      q: 'When is the ₹50 referral credited?',
      a: 'The ₹50 referral bonus may be credited once your referred partner completes their first eligible verified task, subject to eligibility and campaign terms.',
    },
  ];

  return (
    <div className="py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1C273C] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1424] border border-[#D4AF37]/30 text-xs font-semibold text-[#D4AF37] mb-2">
              <span>Support Desk</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC]">
              Partner Support
            </h1>
            <p className="text-xs sm:text-sm text-[#AAB3C2] mt-1">
              Official assistance for campaigns, lead status, and onboarding.
            </p>
          </div>

          <VedLogo size="sm" variant="badge" />
        </div>

        {/* 3 Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Card 1: WhatsApp */}
          <div className="bg-[#0B1325] border border-[#1E2E4E] hover:border-[#25D366]/50 rounded-xl p-5 flex flex-col justify-between transition-colors">
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 flex items-center justify-center text-[#25D366] mb-3">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#F8FAFC] mb-1">WhatsApp Desk</h3>
              <p className="text-xs text-[#AAB3C2] mb-3">
                Fast queries and onboarding help.
              </p>
              <div className="text-sm font-semibold text-[#F8FAFC] mb-4">
                +91 7064866056
              </div>
            </div>
            <WhatsAppButton
              phoneNumber="7064866056"
              defaultMessage="Hello VED Affiliate Team, I need assistance."
              variant="primary"
            />
          </div>

          {/* Card 2: Email */}
          <div className="bg-[#080D19] border border-[#1C273C] hover:border-[#D4AF37]/50 rounded-xl p-5 flex flex-col justify-between transition-colors">
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-3">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#F8FAFC] mb-1">Official Email</h3>
              <p className="text-xs text-[#AAB3C2] mb-3">
                Corporate and verification inquiries.
              </p>
              <div className="text-sm font-semibold text-[#F8FAFC] mb-4 truncate">
                vedaffiliateltd@gmail.com
              </div>
            </div>
            <a
              href="mailto:vedaffiliateltd@gmail.com"
              className="inline-flex items-center justify-center font-medium rounded-lg min-h-11 px-4 py-2 text-xs sm:text-sm bg-[#111A2D] hover:bg-[#16223B] text-[#F8FAFC] border border-[#1C273C] transition-colors"
            >
              <Mail className="w-4 h-4 text-[#D4AF37] mr-1.5" />
              <span>Send Email</span>
            </a>
          </div>

          {/* Card 3: Office */}
          <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#111A2D] border border-[#1C273C] flex items-center justify-center text-[#D4AF37] mb-3">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#F8FAFC] mb-1">Head Office</h3>
              <p className="text-xs text-[#AAB3C2] mb-1">
                Rourkela, Odisha, India
              </p>
              <p className="text-[11px] text-[#AAB3C2] flex items-center gap-1 mt-2">
                <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Mon–Sat: 10 AM – 7 PM IST</span>
              </p>
            </div>
            <div className="mt-4 text-[11px] text-[#D4AF37] font-semibold bg-[#111A2D] p-2.5 rounded-lg border border-[#1C273C]">
              VED AFFILIATE PVT. LIMITED
            </div>
          </div>
        </div>

        {/* Ticket Form + FAQs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form */}
          <div className="lg:col-span-7 bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-5 sm:p-7 shadow-xl">
            <h2 className="text-lg sm:text-xl font-bold text-[#F8FAFC] mb-1">
              Submit a Ticket
            </h2>
            <p className="text-xs text-[#AAB3C2] mb-5">
              We respond within 24 business hours.
            </p>

            {submitSuccess ? (
              <div className="bg-[#070B14] border border-emerald-500/30 rounded-xl p-6 text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  Ticket Received
                </h3>
                <p className="text-xs text-[#AAB3C2]">
                  {submitSuccess.message}
                </p>
                <div className="inline-block px-3 py-1 bg-[#111A2D] border border-[#1C273C] text-xs font-mono font-bold text-[#D4AF37] rounded">
                  {submitSuccess.ticketId}
                </div>
                <div className="pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setSubmitSuccess(null)}>
                    Send Another
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {errorMessage && (
                  <div className="bg-rose-950/40 border border-rose-900/60 rounded-lg p-2.5 text-xs text-rose-300">
                    {errorMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#AAB3C2] mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Your full name"
                      className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#AAB3C2] mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#AAB3C2] mb-1">Mobile *</label>
                    <input
                      type="tel"
                      required
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      placeholder="10-digit number"
                      className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#AAB3C2] mb-1">Subject *</label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Query type"
                      className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">Message *</label>
                  <textarea
                    rows={3}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Enter message details..."
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none resize-none"
                  />
                </div>

                <Button type="submit" variant="primary" size="md" fullWidth disabled={isSubmitting}>
                  <Send className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'Sending...' : 'Submit Support Ticket'}
                </Button>
              </form>
            )}
          </div>

          {/* FAQs */}
          <div className="lg:col-span-5 bg-[#080D19] border border-[#1C273C] rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <HelpCircle className="w-4 h-4" />
              <h3 className="text-sm font-bold text-[#F8FAFC]">Common Questions</h3>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="border-b border-[#1C273C] pb-3 last:border-b-0 last:pb-0">
                  <h4 className="text-xs font-bold text-[#F8FAFC] mb-1">{faq.q}</h4>
                  <p className="text-xs text-[#AAB3C2] leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
