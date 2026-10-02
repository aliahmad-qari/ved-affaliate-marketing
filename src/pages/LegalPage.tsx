import React, { useState } from 'react';
import { ShieldCheck, FileText, Scale } from 'lucide-react';

interface LegalPageProps {
  initialTab?: 'privacy' | 'terms';
}

export const LegalPage: React.FC<LegalPageProps> = ({ initialTab = 'terms' }) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  return (
    <div className="py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1424] border border-[#1C273C] text-xs font-semibold text-[#D4AF37] mb-3">
            <span>Corporate Compliance Documents</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F8FAFC] tracking-tight">
            Policies & Legal Terms
          </h1>
          <p className="text-xs text-[#D4AF37] mt-1 font-semibold uppercase tracking-wider">
            VED AFFILIATE PVT. LIMITED · Rourkela, Odisha, India
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-[#1C273C] pb-2">
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-[#111A2D] text-[#D4AF37] border border-[#D4AF37]/30'
                : 'text-[#AAB3C2] hover:text-[#F8FAFC]'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Terms & Conditions</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-[#111A2D] text-[#D4AF37] border border-[#D4AF37]/30'
                : 'text-[#AAB3C2] hover:text-[#F8FAFC]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Privacy Policy</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-[#0D1424] border border-[#1C273C] rounded-2xl p-6 sm:p-10 space-y-6 text-sm text-[#AAB3C2] leading-relaxed">
          {activeTab === 'terms' ? (
            <div className="space-y-6">
              <section>
                <h3 className="text-base font-bold text-[#F8FAFC] mb-2">1. Nature of the Service</h3>
                <p>
                  VED AFFILIATE PVT. LIMITED provides an affiliate marketing and partner coordination platform connecting registered independent partners with third-party financial institutions and brokerages. VED is not a registered stockbroker, portfolio manager, or financial adviser under SEBI regulations.
                </p>
              </section>

              <section>
                <h3 className="text-base font-bold text-[#F8FAFC] mb-2">2. Lead Submission & Verification Rule</h3>
                <p>
                  Submitting a lead through the Partner Portal does not create an automatic right to commission. All submissions are placed in Pending status and must be validated manually by VED Administrators against broker vendor transaction logs. VED reserves the sole right to approve or reject leads that fail eligibility conditions.
                </p>
              </section>

              <section>
                <h3 className="text-base font-bold text-[#F8FAFC] mb-2">3. Prohibited Practices</h3>
                <p>
                  Partners must not engage in fraudulent click generation, self-referrals, incentive-driven fake registrations, unauthorized use of trademarked logos, or making unsubstantiated guaranteed income promises to prospective retail clients.
                </p>
              </section>

              <section>
                <h3 className="text-base font-bold text-[#F8FAFC] mb-2">4. Withdrawals & Payouts</h3>
                <p>
                  The minimum withdrawal threshold is ₹200. Partners can request withdrawals to their verified Indian Bank Account or UPI ID. All payouts are executed manually by VED Administrators following compliance audits.
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="text-base font-bold text-[#F8FAFC] mb-2">1. Information Collection</h3>
                <p>
                  We collect partner contact information, including name, mobile phone number, email address, city, state, PAN, bank account details, and UPI IDs for KYC and tax compliance purposes.
                </p>
              </section>

              <section>
                <h3 className="text-base font-bold text-[#F8FAFC] mb-2">2. Confidentiality of Partner Details</h3>
                <p>
                  Partner PAN numbers, bank account numbers, and UPI details are strictly confidential and will never be published or shared publicly. All data is stored securely using encrypted backend infrastructure.
                </p>
              </section>

              <section>
                <h3 className="text-base font-bold text-[#F8FAFC] mb-2">3. Manual Verification Process</h3>
                <p>
                  In accordance with client-confirmed procedures, PAN and identity checks are carried out manually by authorized VED administrators. No unauthorized automated third-party scraping or unauthorized credit bureau calls are executed.
                </p>
              </section>

              <section>
                <h3 className="text-base font-bold text-[#F8FAFC] mb-2">4. Contacting the Compliance Officer</h3>
                <p>
                  For any privacy or data inquiries, contact the compliance desk at vedaffiliateltd@gmail.com or visit our registered office in Rourkela, Odisha, India.
                </p>
              </section>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
