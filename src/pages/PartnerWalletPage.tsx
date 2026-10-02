import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  CreditCard,
  RefreshCw,
  X,
  History,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { fetchPartnerWallet, requestPartnerWithdrawal } from '../services/partnerApi.ts';
import { WalletData, WalletTransactionItem } from '../types/partner.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface PartnerWalletPageProps {
  onNavigate: (tab: string) => void;
}

export const PartnerWalletPage: React.FC<PartnerWalletPageProps> = ({ onNavigate }) => {
  const { partner } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Withdrawal modal state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK_TRANSFER'>('UPI');
  const [destination, setDestination] = useState<string>('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  const loadWallet = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchPartnerWallet();
      setWallet(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load wallet data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const handleOpenWithdrawModal = () => {
    setWithdrawError(null);
    setWithdrawSuccess(null);
    setWithdrawAmount('');
    if (paymentMethod === 'UPI') {
      setDestination(partner?.upiId || '');
    } else {
      setDestination(
        partner?.bankDetails?.maskedAccountNumber
          ? `${partner?.bankDetails?.bankName} - A/C ${partner?.bankDetails?.maskedAccountNumber} (${partner?.bankDetails?.ifscCode})`
          : ''
      );
    }
    setIsWithdrawModalOpen(true);
  };

  const handleMethodChange = (method: 'UPI' | 'BANK_TRANSFER') => {
    setPaymentMethod(method);
    if (method === 'UPI') {
      setDestination(partner?.upiId || '');
    } else {
      setDestination(
        partner?.bankDetails?.maskedAccountNumber
          ? `${partner?.bankDetails?.bankName} - A/C ${partner?.bankDetails?.maskedAccountNumber} (${partner?.bankDetails?.ifscCode})`
          : ''
      );
    }
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);

    const amountNum = Number(withdrawAmount);
    if (isNaN(amountNum) || amountNum < 200) {
      setWithdrawError('Minimum withdrawal amount is ₹200.');
      return;
    }

    if (wallet && amountNum > wallet.availableBalance) {
      setWithdrawError(
        `Insufficient balance. You currently have ₹${wallet.availableBalance} available.`
      );
      return;
    }

    if (!destination.trim()) {
      setWithdrawError('Please specify payout destination.');
      return;
    }

    try {
      setIsSubmittingWithdraw(true);
      await requestPartnerWithdrawal({
        amount: amountNum,
        paymentMethod,
        destination: destination.trim(),
      });

      setWithdrawSuccess(
        `Withdrawal request for ₹${amountNum} recorded! It is now pending Admin approval and manual disbursement.`
      );
      setTimeout(() => {
        setIsWithdrawModalOpen(false);
        loadWallet();
      }, 2000);
    } catch (err: any) {
      setWithdrawError(err.message || 'Failed to submit withdrawal request.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const available = wallet?.availableBalance || 0;
  const pending = wallet?.pendingBalance || 0;
  const totalEarned = wallet?.totalEarned || 0;
  const totalWithdrawn = wallet?.totalWithdrawn || 0;
  const transactions = wallet?.transactions || [];

  return (
    <div className="py-6 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Wallet Header & Hero Balance */}
      <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-5 h-5 text-[#D4AF37]" />
              <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                Partner Financial Wallet
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC]">
              Wallet & Payouts
            </h1>
            <p className="text-xs text-[#AAB3C2] mt-1 max-w-lg">
              Withdraw approved commission earnings directly to your verified Indian bank account or UPI handle.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenWithdrawModal}
              disabled={available < 200}
              className="flex-1 md:flex-initial"
            >
              <ArrowDownLeft className="w-4 h-4 mr-2" />
              <span>Request Payout</span>
            </Button>
            <button
              onClick={loadWallet}
              disabled={isLoading}
              className="p-2.5 rounded-lg bg-[#111A2D] border border-[#1C273C] text-[#AAB3C2] hover:text-[#F8FAFC] transition-colors cursor-pointer"
              aria-label="Refresh wallet"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#D4AF37]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Balance Metric Highlights */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mt-6 pt-6 border-t border-[#1C273C]">
          <div className="col-span-2 sm:col-span-1 bg-[#111A2D] border border-[#D4AF37]/50 rounded-xl p-4">
            <span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block">
              Available Balance
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] font-mono mt-1">
              ₹{available.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-[#AAB3C2] mt-1 block">
              {available >= 200 ? 'Ready for withdrawal' : 'Requires min ₹200 to withdraw'}
            </span>
          </div>

          <div className="bg-[#111A2D]/60 border border-[#1C273C] rounded-xl p-4">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
              Pending Clearance
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] font-mono mt-1">
              ₹{pending.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-[#AAB3C2] mt-1 block">
              In admin review
            </span>
          </div>

          <div className="bg-[#111A2D]/60 border border-[#1C273C] rounded-xl p-4">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
              Total Earned
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] font-mono mt-1">
              ₹{totalEarned.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-[#AAB3C2] mt-1 block">
              Lifetime approved earnings
            </span>
          </div>

          <div className="bg-[#111A2D]/60 border border-[#1C273C] rounded-xl p-4">
            <span className="text-[11px] font-bold text-[#AAB3C2] uppercase tracking-wider block">
              Total Disbursed
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] font-mono mt-1">
              ₹{totalWithdrawn.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-[#AAB3C2] mt-1 block">
              Successfully paid out
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={loadWallet}>
            Retry
          </Button>
        </div>
      )}

      {/* Transaction History Ledger */}
      <div className="bg-[#0B1325] border border-[#1E2E4E] rounded-2xl shadow-xl overflow-hidden space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-base font-bold text-[#F8FAFC]">
              Financial Ledger & Transactions
            </h2>
          </div>
          <span className="text-xs text-[#AAB3C2]">
            {transactions.length} recorded entries
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#AAB3C2]">
            <Clock className="w-6 h-6 animate-spin mx-auto text-[#D4AF37] mb-2" />
            <span>Loading ledger...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 border border-[#1C273C] rounded-xl bg-[#070B14]">
            <Wallet className="w-8 h-8 text-[#AAB3C2]/40 mx-auto mb-2" />
            <p className="text-xs text-[#AAB3C2]">
              No transactions recorded yet. Once your submitted leads are approved or withdrawals are initiated, ledger entries will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#070B14] border-b border-[#1C273C] text-[#AAB3C2] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Transaction ID</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C273C]/60 text-[#F8FAFC]">
                {transactions.map((tx) => {
                  const isDebit = tx.type === 'WITHDRAWAL';
                  return (
                    <tr key={tx.transactionId} className="hover:bg-[#111A2D]/40 transition-colors">
                      <td className="py-3 px-3 text-[#AAB3C2] whitespace-nowrap">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-[#D4AF37] whitespace-nowrap">
                        {tx.transactionId}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#111A2D] border border-[#1C273C]">
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#AAB3C2]">
                        <div>{tx.description}</div>
                        {tx.payoutDestination && (
                          <div className="text-[10px] font-mono text-[#D4AF37]/80 mt-0.5">
                            Dest: {tx.payoutDestination}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            tx.status === 'PROCESSED' || tx.status === 'AVAILABLE'
                              ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                              : tx.status === 'REJECTED' || tx.status === 'CANCELLED'
                              ? 'bg-rose-950/60 border border-rose-700 text-rose-300'
                              : 'bg-amber-950/60 border border-amber-700 text-amber-300'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isDebit ? 'text-rose-400' : 'text-emerald-400'}>
                          {isDebit ? `-₹${tx.amount}` : `+₹${tx.amount}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Withdrawal Request Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0D1424] border border-[#1C273C] rounded-2xl p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-[#1C273C] mb-4">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-base font-bold text-[#F8FAFC]">Request Wallet Withdrawal</h3>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="text-[#AAB3C2] hover:text-[#F8FAFC] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {withdrawSuccess ? (
              <div className="py-6 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-[#F8FAFC]">Request Logged</h4>
                <p className="text-xs text-[#AAB3C2]">{withdrawSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
                
                {withdrawError && (
                  <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{withdrawError}</span>
                  </div>
                )}

                <div className="bg-[#111A2D] rounded-xl p-3 border border-[#1C273C] flex justify-between items-center text-xs">
                  <span className="text-[#AAB3C2]">Available to Withdraw:</span>
                  <span className="font-mono font-bold text-[#D4AF37] text-sm">
                    ₹{available.toLocaleString('en-IN')}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                    Withdrawal Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={200}
                    max={available}
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Min ₹200"
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none font-mono"
                  />
                  <p className="text-[11px] text-[#AAB3C2] mt-1">
                    Minimum withdrawal threshold is ₹200.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                    Payout Method *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleMethodChange('UPI')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethod === 'UPI'
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                          : 'bg-[#070B14] text-[#AAB3C2] border-[#1C273C]'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>UPI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMethodChange('BANK_TRANSFER')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethod === 'BANK_TRANSFER'
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                          : 'bg-[#070B14] text-[#AAB3C2] border-[#1C273C]'
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Bank Wire</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#AAB3C2] mb-1">
                    Destination Details *
                  </label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={destination}
                    className="w-full bg-[#070B14] border border-[#1C273C] focus:border-[#D4AF37] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] outline-none font-mono"
                  />
                </div>

                <div className="text-[11px] text-[#AAB3C2] bg-[#070B14] p-3 rounded-lg border border-[#1C273C]">
                  Official Policy: Admin reviews each payout request and manually dispatches funds through UPI or IMPS banking transfer.
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsWithdrawModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="md" disabled={isSubmittingWithdraw}>
                    {isSubmittingWithdraw ? 'Submitting Request...' : 'Confirm Request'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
