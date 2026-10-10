import React, { useState } from 'react';
import {
  User,
  Shield,
  Building,
  CreditCard,
  Lock,
  Copy,
  Check,
  Share2,
  LogOut,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { VedLogo } from '../components/ui/VedLogo.tsx';
import { PartnerKycForm } from '../components/profile/PartnerKycForm.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { maskPan, maskAccountNumber } from '../lib/masking.ts';

interface ProfilePageProps {
  onNavigate: (tab: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { partner, logout, updateProfile, changePassword, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'security' | 'kyc'>('overview');
  const [copiedPartnerId, setCopiedPartnerId] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    fullName: partner?.fullName || '',
    city: partner?.city || '',
    state: partner?.state || '',
  });

  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Security form state
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [securityLoading, setSecurityLoading] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  if (!partner) {
    return (
      <div className="py-20 text-center max-w-md mx-auto px-4">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[#F8FAFC]">Session Expired</h2>
        <p className="text-xs text-[#AAB3C2] mt-1 mb-5">
          Please sign in to access your partner account.
        </p>
        <Button variant="primary" size="md" onClick={() => onNavigate('login')}>
          Sign In as Partner
        </Button>
      </div>
    );
  }

  const referralUrl = `${window.location.origin}/register?ref=${partner.referralCode}`;

  const handleCopyPartnerId = () => {
    navigator.clipboard.writeText(partner.partnerId);
    setCopiedPartnerId(true);
    setTimeout(() => setCopiedPartnerId(false), 2000);
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Join VED AFFILIATE PVT. LIMITED to promote leading financial apps in India and earn on verified leads! Register using my official partner referral code: ${partner.referralCode}\n${referralUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);

    try {
      setEditLoading(true);
      const payload: any = {
        fullName: editForm.fullName,
        city: editForm.city,
        state: editForm.state,
      };

      await updateProfile(payload);
      setEditSuccess('Partner profile updated successfully.');
      setTimeout(() => setEditSuccess(null), 3500);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update profile.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (securityForm.newPassword.length < 8) {
      setSecurityError('New password must be at least 8 characters long.');
      return;
    }

    if (securityForm.newPassword !== securityForm.confirmPassword) {
      setSecurityError('New password and confirmation do not match.');
      return;
    }

    try {
      setSecurityLoading(true);
      const msg = await changePassword({
        currentPassword: securityForm.currentPassword,
        newPassword: securityForm.newPassword,
        confirmPassword: securityForm.confirmPassword,
      });
      setSecuritySuccess(msg || 'Password updated successfully.');
      setSecurityForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSecuritySuccess(null), 4000);
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to change password.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('home');
  };

  // Safe display for PAN & Bank
  const displayPan = partner.maskedPan || (partner.pan ? maskPan(partner.pan) : '**********');
  const displayAccount =
    partner.bankDetails?.maskedAccountNumber ||
    (partner.bankDetails?.accountNumber ? maskAccountNumber(partner.bankDetails.accountNumber) : '********');

  return (
    <div className="py-8 sm:py-12 max-w-5xl mx-auto px-4 sm:px-6">
      
      {/* Header Profile Card */}
      <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-5 sm:p-7 shadow-2xl mb-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#121D36] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] font-extrabold text-xl shadow-lg shrink-0">
              {partner.fullName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[#F8FAFC]">
                  {partner.fullName}
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#121D36] border border-[#1C273C] text-[#D4AF37] font-mono">
                  {partner.partnerId}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                    partner.kycStatus === 'VERIFIED'
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      : partner.kycStatus === 'REJECTED'
                      ? 'bg-rose-950/60 border-rose-700 text-rose-300'
                      : 'bg-amber-950/60 border-amber-700 text-amber-300'
                  }`}
                >
                  KYC: {partner.kycStatus}
                </span>
              </div>
              <p className="text-xs text-[#AAB3C2] mt-1 flex items-center gap-2 flex-wrap">
                <span>{partner.email}</span>
                <span>·</span>
                <span>{partner.mobile}</span>
                <span>·</span>
                <span>{partner.city}, {partner.state}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-rose-400 border-rose-900/60 hover:bg-rose-950/40"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Quick Referral Banner */}
        <div className="mt-5 pt-4 border-t border-[#1C273C] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#070B14] p-3 rounded-xl">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#AAB3C2]">Your Referral Code:</span>
            <span className="font-mono font-bold text-[#D4AF37] bg-[#111A2D] px-2 py-0.5 rounded border border-[#1C273C]">
              {partner.referralCode}
            </span>
            <span className="text-[11px] text-[#AAB3C2] hidden md:inline">
              (₹50 referral bonus, subject to eligibility and campaign terms)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyReferral}
              className="py-1! text-xs! min-h-8!"
            >
              {copiedReferral ? <Check className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
              <span>{copiedReferral ? 'Copied' : 'Copy Link'}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleShareWhatsApp}
              className="py-1! text-xs! min-h-8! bg-[#25D366]! text-black! hover:bg-[#20ba59]!"
            >
              <Share2 className="w-3 h-3 mr-1" />
              <span>WhatsApp</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1C273C] mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-colors relative cursor-pointer ${
            activeTab === 'overview' ? 'text-[#D4AF37]' : 'text-[#AAB3C2] hover:text-[#F8FAFC]'
          }`}
        >
          <span>Account Overview</span>
          {activeTab === 'overview' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37] rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('edit')}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-colors relative cursor-pointer ml-4 ${
            activeTab === 'edit' ? 'text-[#D4AF37]' : 'text-[#AAB3C2] hover:text-[#F8FAFC]'
          }`}
        >
          <span>Edit Profile</span>
          {activeTab === 'edit' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37] rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-colors relative cursor-pointer ml-4 ${
            activeTab === 'security' ? 'text-[#D4AF37]' : 'text-[#AAB3C2] hover:text-[#F8FAFC]'
          }`}
        >
          <span>Security & Password</span>
          {activeTab === 'security' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37] rounded-full" />
          )}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button variant={activeTab === 'kyc' ? 'primary' : 'outline'} size="sm" onClick={() => setActiveTab('kyc')}>Complete KYC</Button>
        <span className="text-xs text-[#AAB3C2]">KYC: {partner.kycStatus} · Verification required for withdrawals</span>
      </div>
      {activeTab === 'kyc' && <PartnerKycForm partner={partner} onSaved={async () => { await refreshProfile(); }} />}
      {/* Tab 1: Account Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          
          {/* Identity & PAN Box */}
          <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
                <Shield className="w-4 h-4" />
                <span>Identity & KYC Record</span>
              </div>
              <span className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                Manual Verification
              </span>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#1C273C]">
                <span className="text-[#AAB3C2]">Partner ID</span>
                <span className="font-mono font-bold text-[#F8FAFC]">{partner.partnerId}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1C273C]">
                <span className="text-[#AAB3C2]">Permanent Account Number (PAN)</span>
                <span className="font-mono font-bold text-[#D4AF37]">{displayPan}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1C273C]">
                <span className="text-[#AAB3C2]">KYC Status</span>
                <span className="font-semibold text-[#F8FAFC]">{partner.kycStatus}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#AAB3C2]">Account Status</span>
                <span className="font-semibold text-emerald-400">{partner.accountStatus}</span>
              </div>
            </div>

            <p className="text-[11px] text-[#AAB3C2] pt-2 border-t border-[#1C273C]">
              Note: PAN verification is performed manually by VED Compliance Administrators.
            </p>
          </div>

          {/* Bank & Payout Box */}
          <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
                <Building className="w-4 h-4" />
                <span>Payout & Banking Details</span>
              </div>
              <span className="text-[11px] text-[#D4AF37] bg-[#111A2D] px-2 py-0.5 rounded border border-[#1C273C]">
                Min Withdrawal: ₹200
              </span>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#1C273C]">
                <span className="text-[#AAB3C2]">Primary UPI ID</span>
                <span className="font-mono font-bold text-[#F8FAFC]">{partner.upiId || 'Not submitted'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1C273C]">
                <span className="text-[#AAB3C2]">Account Holder</span>
                <span className="font-medium text-[#F8FAFC]">{partner.bankDetails?.accountHolderName || 'Not submitted'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1C273C]">
                <span className="text-[#AAB3C2]">Bank Account No.</span>
                <span className="font-mono font-bold text-[#D4AF37]">{displayAccount}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#AAB3C2]">Bank & IFSC</span>
                <span className="font-mono text-[#F8FAFC]">{partner.bankDetails ? `${partner.bankDetails.bankName} (${partner.bankDetails.ifscCode})` : 'Not submitted'}</span>
              </div>
            </div>

            <p className="text-[11px] text-[#AAB3C2] pt-2 border-t border-[#1C273C]">
              Earnings are disbursed directly via UPI or IMPS/NEFT upon admin approval of withdrawal requests.
            </p>
          </div>

        </div>
      )}

      {/* Tab 2: Edit Profile */}
      {activeTab === 'edit' && (
        <form onSubmit={handleUpdateProfile} className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-5 sm:p-7 space-y-5">
          {editSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-3 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{editSuccess}</span>
            </div>
          )}

          {editError && (
            <div className="bg-rose-950/40 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#AAB3C2] mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
              />
            </div>



            <div>
              <label className="block text-xs font-medium text-[#AAB3C2] mb-1">City *</label>
              <input
                type="text"
                required
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#AAB3C2] mb-1">State *</label>
              <input
                type="text"
                required
                value={editForm.state}
                onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" variant="primary" size="md" disabled={editLoading}>
              {editLoading ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>
      )}

      {/* Tab 3: Security & Password */}
      {activeTab === 'security' && (
        <form onSubmit={handleChangePassword} className="bg-[#0B1325] border border-[#1E2E4E] rounded-xl p-5 sm:p-7 space-y-4 max-w-lg">
          <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider mb-2">
            <Lock className="w-4 h-4" />
            <span>Update Account Password</span>
          </div>

          {securitySuccess && (
            <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-3 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{securitySuccess}</span>
            </div>
          )}

          {securityError && (
            <div className="bg-rose-950/40 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{securityError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#AAB3C2] mb-1">Current Password *</label>
            <input
              type="password"
              required
              value={securityForm.currentPassword}
              onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
              className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
              New Password (8+ chars, letters & numbers) *
            </label>
            <input
              type="password"
              required
              value={securityForm.newPassword}
              onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
              className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#AAB3C2] mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              value={securityForm.confirmPassword}
              onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
              className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none"
            />
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" size="md" disabled={securityLoading}>
              {securityLoading ? 'Updating Password...' : 'Change Password'}
            </Button>
          </div>
        </form>
      )}

    </div>
  );
};
