import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { verifyHomeGameCode } from '../lib/storage';

interface RedeemCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRedeem: (code: string) => boolean;
}

export const RedeemCodeModal: React.FC<RedeemCodeModalProps> = ({
  isOpen,
  onClose,
  onRedeem,
}) => {
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Please enter your code');
      return;
    }

    const success = onRedeem(code.trim());
    if (success) {
      setSuccessMsg('🎉 Code verified! Ad-free mode and Companion Scoreboard unlocked!');
      setErrorMsg('');
      setTimeout(() => {
        setSuccessMsg('');
        setCode('');
        onClose();
      }, 1800);
    } else {
      setErrorMsg('Code not recognized. Check your physical user guide or try CR-TEST-TEST.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in select-none">
      <div className="w-full max-w-sm bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl p-5 sm:p-6 shadow-2xl relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/10 text-[#5c4937] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon Header */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#f2c14e]/20 border border-[#d4ab3a] flex items-center justify-center text-[#9a6a12] mb-2 shadow-xs">
            <KeyRound className="w-6 h-6 text-[#1c6a35]" />
          </div>
          <h3 className="text-xl font-black text-[#1c6a35]">
            Home Game Code
          </h3>
          <p className="text-xs text-[#6e533c] max-w-xs mt-1 leading-relaxed">
            Bought the physical Color Run board game? Enter the code supplied in your user guide to unlock:
          </p>
        </div>

        {/* Benefits list */}
        <div className="bg-white/80 border border-[#ebdcb9] rounded-2xl p-3 mb-4 space-y-1.5 text-xs font-bold text-[#3e2e1e]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2f9a4f] shrink-0" />
            <span>Play without ads anywhere on the platform</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2f9a4f] shrink-0" />
            <span>Unlock the digital Companion Scoreboard (up to 20 players)</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#5c4937] mb-1">
              Game Code (found inside box lid or user guide)
            </label>
            <input
              type="text"
              value={code}
              onChange={e => {
                setCode(e.target.value.toUpperCase());
                setErrorMsg('');
              }}
              placeholder="e.g. CR-TEST-TEST"
              autoFocus
              className="w-full px-3 py-2.5 bg-white border border-[#c9b877] rounded-xl text-center font-mono font-black text-sm text-[#1c6a35] placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f] uppercase tracking-wider"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#e5352f] bg-red-50 p-2 rounded-xl border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1c6a35] bg-green-50 p-2 rounded-xl border border-green-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-black text-sm rounded-xl shadow-md transition-transform active:scale-98 flex items-center justify-center gap-1.5 border-b-2 border-[#1c6a35]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Redeem &amp; Unlock</span>
          </button>
        </form>

        <div className="text-center mt-3">
          <span className="text-[10px] text-[#8c745e]">
            Dev / Reviewer tip: Enter <code className="font-mono font-bold text-[#1c6a35]">CR-TEST-TEST</code>
          </span>
        </div>
      </div>
    </div>
  );
};
