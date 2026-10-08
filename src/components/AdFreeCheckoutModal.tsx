import React, { useState, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  Calendar,
  Sparkles,
  Lock,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import {
  AD_FREE_PLANS,
  RECURRING_AGREEMENT_STATEMENT,
  computeNextBillingDate,
  formatBillingDate,
} from '../lib/billing';
import { UserAccount } from '../types/game';

interface AdFreeCheckoutModalProps {
  isOpen: boolean;
  initialPlan: 'monthly' | 'yearly';
  user: UserAccount;
  onConfirm: (
    plan: 'monthly' | 'yearly',
    nextBillingDate: string,
    recurring: boolean
  ) => void;
  onClose: () => void;
}

export const AdFreeCheckoutModal: React.FC<AdFreeCheckoutModalProps> = ({
  isOpen,
  initialPlan,
  user,
  onConfirm,
  onClose,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>(initialPlan);
  // Defaulted to checked as explicitly specified by user:
  const [agreedToRecurring, setAgreedToRecurring] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cardNumber] = useState<string>('•••• •••• •••• 4242');
  const [cardExpiry] = useState<string>('09/29');

  // Update selected plan if initialPlan prop changes when reopening
  React.useEffect(() => {
    if (isOpen) {
      setSelectedPlan(initialPlan);
      setAgreedToRecurring(true);
      setIsProcessing(false);
    }
  }, [isOpen, initialPlan]);

  const planConfig = AD_FREE_PLANS[selectedPlan];
  const today = useMemo(() => new Date(), []);
  const nextBillingDate = useMemo(
    () => computeNextBillingDate(today, selectedPlan),
    [today, selectedPlan]
  );

  const formattedToday = useMemo(() => formatBillingDate(today), [today]);
  const formattedNextDate = useMemo(
    () => formatBillingDate(nextBillingDate),
    [nextBillingDate]
  );

  if (!isOpen) return null;

  const handlePay = () => {
    if (!agreedToRecurring) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onConfirm(selectedPlan, nextBillingDate.toISOString(), agreedToRecurring);
    }, 850);
  };

  return (
    <div
      id="ad-free-checkout-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto animate-scale-up">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-[#175c2e] via-[#1c6a35] to-[#247d40] px-5 py-4 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl text-amber-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide leading-tight">
                Secure Checkout • Go Ad-Free
              </h2>
              <p className="text-[11px] text-[#bde3c7] font-medium">
                Remove banner strips and pre-match full-screen ads
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-black/20 hover:bg-black/30 text-white transition-colors cursor-pointer"
            aria-label="Close Checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {/* Plan Selector Buttons */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-[#6a543e] mb-2 block">
              Choose Subscription Term
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Monthly Option */}
              <button
                type="button"
                onClick={() => setSelectedPlan('monthly')}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                  selectedPlan === 'monthly'
                    ? 'border-[#1c6a35] bg-[#eefaf1] shadow-xs'
                    : 'border-[#dfd3b4] bg-white hover:border-[#bdae8b]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[#3a2c1b]">Monthly</span>
                    {selectedPlan === 'monthly' && (
                      <CheckCircle2 className="w-4 h-4 text-[#1c6a35]" />
                    )}
                  </div>
                  <div className="font-black text-base text-[#1c6a35]">
                    {AD_FREE_PLANS.monthly.price}
                  </div>
                  <span className="text-[10px] text-[#7d6951] font-medium block">
                    Billed every month
                  </span>
                </div>
              </button>

              {/* Yearly Option */}
              <button
                type="button"
                onClick={() => setSelectedPlan('yearly')}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                  selectedPlan === 'yearly'
                    ? 'border-[#1c6a35] bg-[#eefaf1] shadow-xs ring-1 ring-[#1c6a35]'
                    : 'border-[#dfd3b4] bg-white hover:border-[#bdae8b]'
                }`}
              >
                <div className="absolute -top-2.5 right-3 bg-[#e58a1f] text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs uppercase tracking-wider">
                  Best Value
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[#3a2c1b]">Yearly</span>
                    {selectedPlan === 'yearly' && (
                      <CheckCircle2 className="w-4 h-4 text-[#1c6a35]" />
                    )}
                  </div>
                  <div className="font-black text-base text-[#1c6a35]">
                    {AD_FREE_PLANS.yearly.price}
                  </div>
                  <span className="text-[10px] text-[#7d6951] font-medium block">
                    Billed once a year ($2.50/mo)
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Itemized Order & Agreement Summary */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#ded0b1] shadow-xs">
            <div className="flex items-center justify-between border-b border-[#ebdcb9] pb-2.5 mb-2.5">
              <div>
                <span className="text-xs font-black text-[#2e2316] block">
                  {planConfig.name}
                </span>
                <span className="text-[11px] text-[#735e47] font-medium">
                  Ad-Free Access for {planConfig.period}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-[#1c6a35] block">
                  {planConfig.price}
                </span>
                <span className="text-[10px] text-[#8a755d] uppercase font-bold">
                  {planConfig.period}
                </span>
              </div>
            </div>

            {/* What you are agreeing to */}
            <div className="bg-[#f7f2e4] rounded-xl p-3 border border-[#ebdcb9] text-xs text-[#4d3a27] leading-relaxed mb-3">
              <p className="font-bold mb-1 text-[#2d2215]">
                Subscription Agreement:
              </p>
              <p>
                You agree to being charged{' '}
                <span className="font-black text-[#1c6a35]">{planConfig.price}</span>{' '}
                to go Ad-Free for the duration of{' '}
                <span className="font-black text-[#2e2316]">{planConfig.period}</span>.
              </p>
            </div>

            {/* Recurring Schedule Details */}
            <div className="space-y-1.5 text-[11px] text-[#604b36]">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#7a644d]">Initial Charge Date:</span>
                <span className="font-bold text-[#2e2316]">{formattedToday}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#7a644d]">Amount Charged Now:</span>
                <span className="font-black text-[#1c6a35]">{planConfig.price}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-dashed border-[#e3d5b5]">
                <span className="font-medium text-[#7a644d] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#1c6a35]" />
                  <span>Next Recurring Billing Date:</span>
                </span>
                <span className="font-black text-[#1c6a35] bg-[#eefbf0] px-2 py-0.5 rounded-md border border-[#c6ecd0]">
                  {formattedNextDate}
                </span>
              </div>
            </div>
          </div>

          {/* THE MANDATED RECURRING CHARGE CHECKBOX (Defaulted to checked) */}
          <div className="bg-[#fff9ed] border-2 border-[#e3be75] rounded-2xl p-3.5 shadow-xs">
            <label
              htmlFor="recurring-agreement-checkbox"
              className="flex items-start gap-3 cursor-pointer select-none"
            >
              <input
                id="recurring-agreement-checkbox"
                type="checkbox"
                checked={agreedToRecurring}
                onChange={e => setAgreedToRecurring(e.target.checked)}
                className="mt-0.5 w-4.5 h-4.5 accent-[#1c6a35] cursor-pointer rounded shrink-0"
              />
              <span className="text-[11px] sm:text-xs text-[#42311f] font-medium leading-snug">
                {RECURRING_AGREEMENT_STATEMENT}
              </span>
            </label>

            {!agreedToRecurring && (
              <div className="mt-2.5 p-2 bg-[#fdf0ef] border border-[#f5c6cb] rounded-xl flex items-center gap-1.5 text-[11px] font-bold text-[#b71c1c]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>You must agree to recurring billing to proceed with this plan.</span>
              </div>
            )}
          </div>

          {/* Simulated Payment Method Card */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#ded0b1] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#6a543e]">
                Payment Method
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-[#1c6a35] bg-[#eefbf0] px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                <span>256-Bit Encrypted</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-[#fbf9f2] rounded-xl border border-[#ebdcb9]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#2e2316] text-white">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#3d2c1c] block">
                    Card ending in 4242
                  </span>
                  <span className="text-[10px] text-[#7d6951] font-medium">
                    Name: {user.name || 'Account Holder'} • Expires {cardExpiry}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#1c6a35] bg-[#2f9a4f]/10 px-2 py-0.5 rounded-md">
                Verified
              </span>
            </div>
          </div>

          {/* Benefits Bullet Points */}
          <div className="grid grid-cols-2 gap-2 text-[10px] text-[#6e563d] font-semibold">
            <div className="flex items-center gap-1.5 bg-[#f4ecd6]/70 p-2 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 text-[#1c6a35] shrink-0" />
              <span>No banner strip ads</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#f4ecd6]/70 p-2 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 text-[#1c6a35] shrink-0" />
              <span>Skip 10s pre-match ads</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#f4ecd6]/70 p-2 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 text-[#1c6a35] shrink-0" />
              <span>Instant profile badge</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#f4ecd6]/70 p-2 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 text-[#1c6a35] shrink-0" />
              <span>Cancel anytime online</span>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-[#f2e7cb] border-t border-[#ded0b1] flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#bdae8b] bg-white hover:bg-[#faf7ee] text-[#543e28] font-bold text-xs transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handlePay}
            disabled={!agreedToRecurring || isProcessing}
            className={`w-full flex-1 py-3 px-4 rounded-xl font-black text-xs text-white shadow-md transition-all flex items-center justify-center gap-2 ${
              !agreedToRecurring || isProcessing
                ? 'bg-[#a3bfa9] cursor-not-allowed'
                : 'bg-[#1c6a35] hover:bg-[#155429] active:scale-98 cursor-pointer'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing Order...</span>
              </span>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>
                  Confirm &amp; Pay {planConfig.price}
                </span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
