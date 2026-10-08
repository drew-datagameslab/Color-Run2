import React from 'react';
import { Lock } from 'lucide-react';

interface SignInRequiredModalProps {
  /** What the guest tried to open, e.g. "Multiplayer Online" */
  feature: string;
  onSignIn: () => void;
  onClose: () => void;
}

/** Shown when a guest opens a mode that needs an account (Multiplayer Online, Friends Challenges) */
export const SignInRequiredModal: React.FC<SignInRequiredModalProps> = ({ feature, onSignIn, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none animate-fade-in"
    onClick={onClose}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-required-title"
      className="w-full max-w-sm bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl p-5 shadow-2xl flex flex-col items-center text-center"
      onClick={e => e.stopPropagation()}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#1c6a35] text-white flex items-center justify-center mb-3 shadow-md">
        <Lock className="w-6 h-6" />
      </div>
      <h2 id="sign-in-required-title" className="text-lg font-black text-[#1c6a35] mb-1">
        Sign in to play {feature}
      </h2>
      <p className="text-xs text-[#6e533c] font-medium mb-4">
        Guests can play vs Computer and Pass &amp; Play. Sign in to play online, challenge friends, and keep your coins
        safe on your account.
      </p>
      <button
        onClick={onSignIn}
        className="w-full py-2.5 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-extrabold text-sm rounded-xl shadow-md transition-all active:scale-98 cursor-pointer border-b-2 border-[#1b6b33] mb-2"
      >
        Sign In
      </button>
      <button
        onClick={onClose}
        className="text-xs font-bold text-[#5c442c] hover:text-black transition-colors cursor-pointer"
      >
        Not now
      </button>
    </div>
  </div>
);
