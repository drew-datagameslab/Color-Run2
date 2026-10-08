import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types/game';
import {
  ReferralInvite,
  createReferralInvite,
  getUserReferralInvites,
  sendReferralReminder,
  dispatchSmsText,
  buildReferralSmsText,
  generate8DigitReferralCode,
  findRegisteredUserByPhone,
  RegisteredUserPhoneInfo,
  STORE_LINKS,
} from '../lib/referrals';
import { addFriend } from '../lib/friends';
import {
  Phone,
  Send,
  Sparkles,
  Share2,
  Copy,
  Check,
  Clock,
  UserPlus,
  X,
  Smartphone,
  Gift,
  BellRing,
  CheckCircle2,
  Users,
} from 'lucide-react';

interface ChallengeFriendsOverlayProps {
  isOpen: boolean;
  user: UserAccount;
  onClose: () => void;
  onToast?: (msg: string) => void;
  onFriendAdded?: () => void;
}

export const ChallengeFriendsOverlay: React.FC<ChallengeFriendsOverlayProps> = ({
  isOpen,
  user,
  onClose,
  onToast,
  onFriendAdded,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [preferredStore, setPreferredStore] = useState<'apple' | 'google'>('apple');
  const [previewCode, setPreviewCode] = useState(generate8DigitReferralCode());
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<ReferralInvite[]>([]);
  const [lastSentInvite, setLastSentInvite] = useState<ReferralInvite | null>(null);
  const [remindingCode, setRemindingCode] = useState<string | null>(null);
  const [registeredMatchNotice, setRegisteredMatchNotice] = useState<{
    user: RegisteredUserPhoneInfo;
    message: string;
  } | null>(null);

  // Load existing user referral invites
  useEffect(() => {
    if (isOpen && user?.uid) {
      getUserReferralInvites(user.uid).then(list => {
        setInvites(list);
      });
    }
  }, [isOpen, user?.uid]);

  if (!isOpen) return null;

  // Build the message preview
  const { messageText, storeLink } = buildReferralSmsText(
    user.name || 'Your friend',
    previewCode,
    preferredStore
  );

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      if (onToast) onToast('Please enter a phone number to challenge your friend.');
      return;
    }

    setSending(true);
    setRegisteredMatchNotice(null);
    setLastSentInvite(null);

    try {
      // 1. Check if the phone number is associated to an existing registered User
      const registeredUser = await findRegisteredUserByPhone(phoneNumber);

      if (registeredUser) {
        // "If the phone number is associated to a registered User, do not send the text. Simply add the User to the invitee's list of friends."
        if (registeredUser.uid === user.uid) {
          if (onToast) onToast("That's your own phone number! Enter a friend's phone number.");
          setSending(false);
          return;
        }

        // Add to current user's friends list
        await addFriend(user.uid, {
          id: registeredUser.uid,
          name: registeredUser.name,
          color: registeredUser.avatar?.color || '#1f7fd6',
          image: registeredUser.avatar?.image,
        });

        // Add mutual friendship so the inviter also appears on the registered friend's list
        await addFriend(registeredUser.uid, {
          id: user.uid,
          name: user.name,
          color: user.avatar?.color || '#e5352f',
          image: user.avatar?.image,
        });

        if (onFriendAdded) {
          onFriendAdded();
        }

        const noticeMsg = `${registeredUser.name} is already registered on Color Run! Added directly to your Friends list (no SMS text sent).`;
        setRegisteredMatchNotice({
          user: registeredUser,
          message: noticeMsg,
        });

        if (onToast) {
          onToast(`🎉 ${registeredUser.name} is already a Color Run player! Added directly to your friends list.`);
        }

        // DO NOT SEND THE TEXT. Clear input and stop.
        setPhoneNumber('');
        setSending(false);
        return;
      }

      // 2. If NOT a registered user, proceed to send the text with 8-digit referral code
      const invite = await createReferralInvite(user, phoneNumber, preferredStore);
      setLastSentInvite(invite);
      setInvites(prev => [invite, ...prev.filter(i => i.code !== invite.code)]);

      // Open SMS app on user's device
      dispatchSmsText(phoneNumber, invite.messageText);

      if (onToast) {
        onToast(`📱 Referral text dispatched to ${phoneNumber}! Code: ${invite.code}`);
      }

      // Reset input and generate a fresh preview code for next invite
      setPhoneNumber('');
      setPreviewCode(generate8DigitReferralCode());
    } catch (err) {
      console.error('Error in send challenge invite:', err);
      if (onToast) onToast('Error processing challenge invite. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleCopyMessage = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    if (onToast) onToast('📋 Referral message copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendReminder = async (invite: ReferralInvite) => {
    setRemindingCode(invite.code);
    try {
      const res = await sendReferralReminder(invite);
      setInvites(prev =>
        prev.map(i => (i.code === invite.code ? res.updatedInvite : i))
      );
      if (onToast) onToast(`🔔 ${res.message}`);
    } catch {
      if (onToast) onToast('Failed to dispatch reminder text.');
    } finally {
      setRemindingCode(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="relative bg-gradient-to-r from-[#2f9a4f] via-[#268a48] to-[#1f703a] px-4 py-3 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-amber-200">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wide leading-tight drop-shadow-xs">
                Challenge Your Friends
              </h2>
              <span className="text-[10px] text-emerald-100 font-bold">
                +300 Coins for You &amp; Your Friend
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[#3e2e1e]">
          {/* Main Hero Prompt */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-amber-100/80 border border-amber-300/80 rounded-full text-[11px] font-extrabold text-[#7a5933]">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Invite &amp; Play Together</span>
            </div>
            <h3 className="text-base font-black text-[#2e2115] leading-snug">
              Ready to Challenge Your Friends?
            </h3>
            <p className="text-xs text-[#6e553c] font-semibold">
              Send them a link to play the game with you! When they sign in with your referral code, you'll both get a 300 coin bonus and automatically be connected as friends.
            </p>
          </div>

          {/* Phone Number & Preferred Store Form */}
          <form
            onSubmit={handleSendInvite}
            className="bg-[#f2ebdc] border border-[#d6c7a1] rounded-2xl p-3.5 space-y-3 shadow-inner"
          >
            {/* Preferred Store Selector */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#5a422b] mb-1">
                Friend's Preferred Store:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreferredStore('apple')}
                  className={`py-1.5 px-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    preferredStore === 'apple'
                      ? 'bg-black text-white border-black shadow-sm'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 170 170">
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-6.3-9.58-11.24-20.57-14.83-32.96-3.59-12.39-5.39-24.08-5.39-35.08 0-16.74 4.54-30.73 13.62-41.97 9.08-11.24 20.35-16.97 33.8-17.18 5.43 0 11.39 1.48 17.88 4.43 6.49 2.96 10.63 4.52 12.42 4.69 1.42-.17 5.76-1.78 13.01-4.83 7.26-3.04 13.08-4.41 17.47-4.12 13.63.87 24.37 5.69 32.22 14.48-11.85 7.18-17.65 17.18-17.41 30 0 10.22 3.91 18.89 11.74 26 3.59 3.37 7.72 5.87 12.39 7.5-2.61 7.72-5.76 15.65-9.45 23.8zM119.22 33.56c0-7.39 2.61-14.35 7.83-20.87 5.22-6.52 11.85-10.76 19.89-12.69.22 1.3.33 2.48.33 3.52 0 7.39-2.83 14.57-8.48 21.52-5.65 6.96-12.39 11.13-20.22 12.52-.43-1.3-.65-2.6-.65-4z" />
                  </svg>
                  <span>Apple App Store</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreferredStore('google')}
                  className={`py-1.5 px-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    preferredStore === 'google'
                      ? 'bg-[#01875f] text-white border-[#01875f] shadow-sm'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Google Play</span>
                </button>
              </div>
            </div>

            {/* Container for Phone Number */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#5a422b] mb-1">
                Friend's Phone Number:
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-[#9c8a74]" />
                <input
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#d8c89f] rounded-xl text-[#2e2316] font-bold placeholder-[#9c8a74] focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f]"
                />
              </div>
              <p className="text-[10px] text-[#7a6047] mt-1 leading-tight font-medium">
                💡 <span className="font-bold">Smart Friend Match:</span> If this phone number is associated with a registered Color Run user, they'll be added directly to your Friends list without sending an SMS text.
              </p>
            </div>

            {/* Generated 8-Digit Referral Code Badge */}
            <div className="flex items-center justify-between p-2 bg-[#faf4e6] border border-[#d8c89f] rounded-xl">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#e58a1f]" />
                <div>
                  <div className="text-[10px] font-bold text-[#7a6047] uppercase">
                    Your Generated 8-Digit Code
                  </div>
                  <div className="text-sm font-black font-mono tracking-widest text-[#2f9a4f]">
                    {previewCode}
                  </div>
                </div>
              </div>

              <span className="text-[10px] font-extrabold bg-[#e58a1f] text-white px-2 py-0.5 rounded-full shadow-xs">
                300 COIN BONUS
              </span>
            </div>

            {/* Live Message Text Preview */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-[#7a6047] uppercase mb-1">
                <span>Text Message Preview:</span>
                <button
                  type="button"
                  onClick={() => handleCopyMessage(messageText)}
                  className="text-[#1f7fd6] hover:underline flex items-center gap-1 font-extrabold cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                </button>
              </div>

              <div className="p-2.5 bg-white border border-[#d8c89f] rounded-xl text-xs text-[#4a3a2a] italic leading-relaxed">
                "{messageText}"
              </div>
            </div>

            {/* Send Text Button */}
            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 px-4 bg-[#2f9a4f] hover:bg-[#268a48] disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 border-b-3 border-[#1c6b33] cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Dispatching SMS...' : 'Send Text Link to Friend'}</span>
            </button>
          </form>

          {/* Last Sent Confirmation Banner */}
          {lastSentInvite && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start gap-2.5 animate-fade-in">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <span className="font-black text-emerald-900 block">
                  Text Dispatched to {lastSentInvite.phoneNumber}!
                </span>
                <p className="text-emerald-800 text-[11px] leading-snug">
                  Referral code <strong className="font-mono">{lastSentInvite.code}</strong> registered. If they don't sign up right away, you can send them a text reminder below.
                </p>
              </div>
            </div>
          )}

          {/* Registered User Auto-Added Friend Banner (NO SMS SENT) */}
          {registeredMatchNotice && (
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-500 rounded-2xl flex items-start gap-3 shadow-sm animate-fade-in">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0 border-2 border-emerald-600 shadow-xs"
                style={{
                  backgroundColor: registeredMatchNotice.user.avatar?.color || '#2f9a4f',
                  backgroundImage: registeredMatchNotice.user.avatar?.image
                    ? `url(${registeredMatchNotice.user.avatar.image})`
                    : undefined,
                  backgroundSize: 'cover',
                }}
              >
                {!registeredMatchNotice.user.avatar?.image &&
                  registeredMatchNotice.user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-black text-emerald-950 text-sm">
                    {registeredMatchNotice.user.name}
                  </span>
                  <span className="text-[9px] uppercase font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                    Registered User Found
                  </span>
                  <span className="text-[9px] uppercase font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                    No SMS Sent
                  </span>
                </div>
                <p className="text-emerald-900 text-[11px] leading-snug mt-1 font-medium">
                  {registeredMatchNotice.message}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-emerald-800 text-[11px] font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Now available in your "My Friends" list to challenge!</span>
                </div>
              </div>
            </div>
          )}

          {/* Pending Invites & Reminder Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-[#5a422b] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#e58a1f]" />
                <span>Invited Friends &amp; Status</span>
              </h4>
              <span className="text-[10px] font-bold text-[#8c745e]">
                {invites.length} {invites.length === 1 ? 'invite' : 'invites'}
              </span>
            </div>

            {invites.length === 0 ? (
              <div className="p-3 bg-white/70 border border-dashed border-[#d8c89f] rounded-xl text-center text-xs text-[#8c745e] italic">
                No friends invited yet. Enter a phone number above to send your first challenge text!
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {invites.map(inv => {
                  const isPending = !inv.used;
                  return (
                    <div
                      key={inv.code}
                      className="p-2.5 bg-white border border-[#d8c89f] rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#2e2316] bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                            {inv.code}
                          </span>
                          <span className="text-xs font-bold text-[#4a3622] truncate">
                            {inv.phoneNumber}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 mt-1 text-[10px]">
                          {isPending ? (
                            <span className="text-amber-700 font-extrabold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Pending Sign-Up (Code Unused)
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Used by {inv.usedByName || 'Friend'} (Connected!)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* If code was not used, send a text reminder button */}
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleSendReminder(inv)}
                          disabled={remindingCode === inv.code}
                          className="shrink-0 py-1 px-2 bg-[#e58a1f] hover:bg-[#cb7512] disabled:opacity-50 text-white font-extrabold text-[10px] rounded-lg shadow-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                          title="Send a text reminder to use the referral code"
                        >
                          <BellRing className="w-3 h-3" />
                          <span>
                            {remindingCode === inv.code
                              ? 'Sending...'
                              : inv.reminderSent
                              ? 'Resend Text'
                              : 'Send Text Reminder'}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#f0e6d2] px-4 py-2.5 border-t border-[#d8c89f] flex items-center justify-between">
          <span className="text-[10px] text-[#7a6249] font-medium">
            Codes can also be redeemed in the Store's Coupon box
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-[#4a3622] hover:bg-[#382818] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
