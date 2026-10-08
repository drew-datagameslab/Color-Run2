import React, { useState } from 'react';
import { ColorRunLogo, DGLogo } from './Logo';
import { UserAccount } from '../types/game';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signInWithApple,
  signInAsGuest,
} from '../lib/firebase';
import { redeemReferralCode, registerUserPhoneNumber } from '../lib/referrals';
import { Loader2, Mail, Lock, User, ShieldCheck, ArrowRight, Sparkles, Gift, Ticket, Phone } from 'lucide-react';

interface SignInScreenProps {
  onSignedIn: (user: UserAccount) => void;
  onPlayGuest: () => void;
  onToast?: (msg: string) => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onSignedIn,
  onPlayGuest,
  onToast,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const formatFirebaseError = (err: any): string => {
    const code = err?.code || '';
    if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password')) {
      return 'Incorrect email or password. Please try again.';
    }
    if (code.includes('auth/email-already-in-use')) {
      return 'An account with this email already exists. Please sign in instead.';
    }
    if (code.includes('auth/weak-password')) {
      return 'Password should be at least 6 characters long.';
    }
    if (code.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (code.includes('auth/user-not-found')) {
      return 'No user found with this email. Switch to "Create Account" below.';
    }
    if (code.includes('auth/popup-closed-by-user')) {
      return 'Sign-in popup was closed before completing.';
    }
    if (code.includes('auth/popup-blocked')) {
      return 'Popup was blocked by your browser. Please allow popups or use email sign-in.';
    }
    if (code.includes('auth/operation-not-allowed')) {
      return 'This sign-in provider is not enabled in the Firebase console. Please use Email or Guest.';
    }
    return err?.message || 'Authentication failed. Please check your credentials.';
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter a password.');
      return;
    }
    if (isSignUp && password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const user = await signUpWithEmail(cleanEmail, password, displayName);
        if (phoneNumber.trim()) {
          user.phoneNumber = phoneNumber.trim();
          try {
            await registerUserPhoneNumber(user, phoneNumber.trim());
          } catch (err) {
            console.warn('Could not register phone number on sign up:', err);
          }
        }
        if (referralCode.trim()) {
          try {
            const refRes = await redeemReferralCode(referralCode.trim(), user);
            if (refRes.success && onToast) {
              onToast(`🎉 Referral bonus applied! +300 Coins added, and ${refRes.inviterName} was added as your friend!`);
            } else if (!refRes.success && onToast) {
              onToast(`Note: ${refRes.message}`);
            }
          } catch (err) {
            console.warn('Referral redeem on signup error:', err);
          }
        }
        onSignedIn(user);
      } else {
        const user = await signInWithEmail(cleanEmail, password);
        onSignedIn(user);
      }
    } catch (err: any) {
      console.error('Email auth error:', err);
      setErrorMsg(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      if (referralCode.trim()) {
        try {
          const refRes = await redeemReferralCode(referralCode.trim(), user);
          if (refRes.success && onToast) {
            onToast(`🎉 Referral bonus applied! +300 Coins added, and ${refRes.inviterName} was added as your friend!`);
          }
        } catch {}
      }
      onSignedIn(user);
    } catch (err: any) {
      console.error('Google auth error:', err);
      setErrorMsg(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const user = await signInWithApple();
      if (referralCode.trim()) {
        try {
          const refRes = await redeemReferralCode(referralCode.trim(), user);
          if (refRes.success && onToast) {
            onToast(`🎉 Referral bonus applied! +300 Coins added, and ${refRes.inviterName} was added as your friend!`);
          }
        } catch {}
      }
      onSignedIn(user);
    } catch (err: any) {
      console.error('Apple auth error:', err);
      // If Apple auth isn't enabled in Firebase Console, show helpful message
      if (err?.code?.includes('operation-not-allowed') || err?.code?.includes('configuration-not-found')) {
        setErrorMsg('Apple Sign-In is not configured in this Firebase project. Please use Google, Email, or Guest.');
      } else {
        setErrorMsg(formatFirebaseError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAuth = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const user = await signInAsGuest();
      onSignedIn(user);
    } catch (err: any) {
      console.warn('Anonymous auth note:', err);
      // Fallback seamlessly to guest callback if anonymous auth restricted
      onPlayGuest();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xs sm:max-w-sm mx-auto flex flex-col items-center justify-center p-2 sm:p-3 my-auto animate-fade-in select-none">
      <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col items-center">
        <ColorRunLogo size="md" className="mb-0.5" />
        <p className="text-[11px] text-[#6e533c] font-bold text-center mb-2 leading-tight">
          Sign in to save your game stats, files, and scoreboards
        </p>

        {/* Quick Guest Play Button */}
        <button
          onClick={handleGuestAuth}
          disabled={loading}
          className="w-full py-2 px-3 bg-[#2f9a4f] hover:bg-[#268a48] disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-98 mb-1.5 flex items-center justify-center gap-1.5 cursor-pointer border-b-2 border-[#1b6b33]"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <>
              <span className="text-base">🎲</span>
              <span>Play as Guest</span>
            </>
          )}
        </button>

        <div className="flex items-center w-full gap-2 my-1 text-[10px] font-bold text-[#8c745e] uppercase tracking-wider">
          <div className="flex-1 h-px bg-[#d8c89f]" />
          <span>or continue with</span>
          <div className="flex-1 h-px bg-[#d8c89f]" />
        </div>

        {/* Social Authentication Buttons */}
        <div className="w-full grid grid-cols-2 gap-1.5 my-1">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="py-1.5 px-2 bg-white hover:bg-stone-50 disabled:opacity-50 border border-stone-300 rounded-lg text-[11px] font-bold text-stone-700 shadow-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={handleAppleAuth}
            disabled={loading}
            className="py-1.5 px-2 bg-black hover:bg-stone-900 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold shadow-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-6.3-9.58-11.24-20.57-14.83-32.96-3.59-12.39-5.39-24.08-5.39-35.08 0-16.74 4.54-30.73 13.62-41.97 9.08-11.24 20.35-16.97 33.8-17.18 5.43 0 11.39 1.48 17.88 4.43 6.49 2.96 10.63 4.52 12.42 4.69 1.42-.17 5.76-1.78 13.01-4.83 7.26-3.04 13.08-4.41 17.47-4.12 13.63.87 24.37 5.69 32.22 14.48-11.85 7.18-17.65 17.18-17.41 30 0 10.22 3.91 18.89 11.74 26 3.59 3.37 7.72 5.87 12.39 7.5-2.61 7.72-5.76 15.65-9.45 23.8zM119.22 33.56c0-7.39 2.61-14.35 7.83-20.87 5.22-6.52 11.85-10.76 19.89-12.69.22 1.3.33 2.48.33 3.52 0 7.39-2.83 14.57-8.48 21.52-5.65 6.96-12.39 11.13-20.22 12.52-.43-1.3-.65-2.6-.65-4z" />
            </svg>
            <span>Apple ID</span>
          </button>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="w-full space-y-1.5 mt-1">
          {/* Display name field when creating account */}
          {isSignUp && (
            <>
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#9c8a74]" />
                <input
                  type="text"
                  placeholder="Roller Nickname (e.g. Lucky Ace)"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#d8c89f] rounded-lg text-[#2e2316] placeholder-[#9c8a74] focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f]"
                />
              </div>

              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#9c8a74]" />
                <input
                  type="tel"
                  placeholder="Phone Number (Optional - for Friend Invites)"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#d8c89f] rounded-lg text-[#2e2316] placeholder-[#9c8a74] focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f]"
                />
              </div>
            </>
          )}

          <div className="relative">
            <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#9c8a74]" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#d8c89f] rounded-lg text-[#2e2316] placeholder-[#9c8a74] focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f]"
            />
          </div>

          <div className="relative">
            <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#9c8a74]" />
            <input
              type="password"
              placeholder={isSignUp ? "Password (min. 6 chars)" : "Password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#d8c89f] rounded-lg text-[#2e2316] placeholder-[#9c8a74] focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f]"
            />
          </div>

          {/* Referral Code Container on Sign-Up screen */}
          {isSignUp && (
            <div className="p-2.5 bg-[#f5ede0] border border-[#d8c89f] rounded-xl space-y-1 text-left">
              <div className="flex items-center justify-between text-[11px] font-black text-[#5c442c]">
                <span className="flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-[#e58a1f]" />
                  <span>Referral Code (Optional)</span>
                </span>
                <span className="text-[9px] bg-[#2f9a4f] text-white px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider">
                  +300 Coins
                </span>
              </div>
              <div className="relative">
                <Ticket className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#9c8a74]" />
                <input
                  type="text"
                  placeholder="8-digit code (e.g. CR849201)"
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value.toUpperCase())}
                  maxLength={12}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#d8c89f] rounded-lg text-[#2e2316] font-mono font-bold tracking-wider placeholder-[#9c8a74] focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f] uppercase"
                />
              </div>
              <p className="text-[10px] text-[#7a6249] leading-tight">
                Enter an 8-digit invite code to get a 300 coin bonus and automatically connect as friends!
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-1.5 bg-red-50 border border-red-200 rounded-md text-[11px] text-red-700 font-medium text-center">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-1.5 px-3 bg-[#e58a1f] hover:bg-[#cb7512] disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition-transform active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : isSignUp ? (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Account &amp; Save Password</span>
              </>
            ) : (
              <>
                <span>Sign In with Email</span>
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </button>
        </form>

        {/* Toggle between Sign In and Create Account */}
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setErrorMsg('');
          }}
          className="text-[11px] text-[#523d2a] font-semibold underline mt-1.5 hover:text-black cursor-pointer"
        >
          {isSignUp
            ? 'Already have an account? Sign In'
            : "First time here? Create an Account & Password"}
        </button>

        {/* Firebase Connected Badge */}
        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-[#ebdcb9] text-[9px] text-[#785b3f]">
          <ShieldCheck className="w-3 h-3 text-[#1c6a35]" />
          <span>Secured with Firebase Firestore &amp; Auth</span>
        </div>
      </div>

      <DGLogo className="mt-2.5" size="login" textColor="text-white" />
    </div>
  );
};
