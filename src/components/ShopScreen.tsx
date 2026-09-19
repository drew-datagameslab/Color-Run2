import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Volume2,
  Check,
  Sparkles,
  KeyRound,
  Mail,
  ArrowDown,
  Gift,
  Tag,
  ShieldCheck,
  CalendarX,
  AlertTriangle,
  RefreshCw,
  Coins,
  Dices,
  Palette,
} from 'lucide-react';
import { DiceColor, ShopSettings, UserAccount } from '../types/game';
import { getSoundVolume, setSoundVolume, playWinCoinsSound } from '../lib/audio';
import { redeemShopCoupon } from '../lib/storage';
import { redeemReferralCode } from '../lib/referrals';
import { saveEmailSubscriber, markEmailSubscriberVerified } from '../lib/firebase';
import { RisingCoinBubble } from './RisingCoinBubble';
import { AdFreeCheckoutModal } from './AdFreeCheckoutModal';
import { formatBillingDate } from '../lib/billing';
import { DieComponent } from './DieComponent';
import { ColorRunShopLogo } from './Logo';

interface ShopScreenProps {
  user: UserAccount;
  coins: number;
  shopSettings: ShopSettings;
  onUpdateShop: (settings: ShopSettings) => void;
  onAddCoins: (amount: number) => void;
  onSetAdFree: (
    adFree: boolean,
    subscription?: {
      plan?: 'monthly' | 'yearly';
      billingDate?: string;
      recurring?: boolean;
    }
  ) => void;
  onOpenRedeemModal: () => void;
  onBack: () => void;
}

// User specified: Prices for all dice will be 50 coins.
const ALL_COLORS: Array<{ id: DiceColor; name: string; hex: string; price: number }> = [
  { id: 'blue', name: 'Blue', hex: '#1f7fd6', price: 0 },
  { id: 'red', name: 'Red', hex: '#e5352f', price: 0 },
  { id: 'green', name: 'Green', hex: '#2f9a4f', price: 50 },
  { id: 'purple', name: 'Purple', hex: '#8e44c9', price: 50 },
  { id: 'black', name: 'Midnight', hex: '#222222', price: 50 },
  { id: 'lblue', name: 'Sky Blue', hex: '#45aaf2', price: 50 },
  { id: 'orange', name: 'Amber', hex: '#fa8231', price: 50 },
  { id: 'pink', name: 'Neon Pink', hex: '#fd79a8', price: 50 },
];

// User specified: Backgrounds should be 50 coins as well.
const ALL_BGS = [
  { id: 'wood', name: 'Wood Table', price: 0, image: '/media/backgrounds/wood.jpg' },
  { id: 'blue-abstract', name: 'Blue Abstract', price: 50, image: '/media/backgrounds/blue-abstract.jpg' },
  { id: 'purple-abstract', name: 'Purple Abstract', price: 50, image: '/media/backgrounds/purple-abstract.jpg' },
  { id: 'purple-dots', name: 'Purple Dots', price: 50, image: '/media/backgrounds/purple-dots.jpg' },
  { id: 'galaxy', name: 'Night Galaxy', price: 50, image: '/media/backgrounds/galaxy.jpg' },
  { id: 'sky', name: 'Puffy Clouds', price: 50, image: '/media/backgrounds/sky.jpg' },
  { id: 'castle', name: 'Castle Garden', price: 50, image: '/media/backgrounds/castle.jpg' },
  { id: 'cliffs', name: 'Cliffs of Scotland', price: 50, image: '/media/backgrounds/cliffs.jpg' },
];

// Coin Bank packages specified by user:
// 100/$1.99, 200/$3.79, 500/$6.99, 1000/$11.99, 2000/$20.99 (Best Value)
const COIN_PACKAGES = [
  { coins: 100, price: '$1.99 USD', label: '' },
  { coins: 200, price: '$3.79 USD', label: '' },
  { coins: 500, price: '$6.99 USD', label: 'Popular' },
  { coins: 1000, price: '$11.99 USD', label: '' },
  { coins: 2000, price: '$20.99 USD', label: 'Best Value' },
];

export const ShopScreen: React.FC<ShopScreenProps> = ({
  user,
  coins,
  shopSettings,
  onUpdateShop,
  onAddCoins,
  onSetAdFree,
  onOpenRedeemModal,
  onBack,
}) => {
  type ShopTab = 'coins' | 'dice' | 'backgrounds';
  const [activeTab, setActiveTab] = useState<ShopTab>('coins');

  const [vol, setVol] = useState(Math.round((getSoundVolume() / 0.7) * 100));
  const [toastMsg, setToastMsg] = useState('');

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [bubbleCoins, setBubbleCoins] = useState(0);
  const [showBubble, setShowBubble] = useState(false);

  // Email Signup Flow state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState(user.email || '');
  const [selectedCountry, setSelectedCountry] = useState('United States (US)');
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [emailStage, setEmailStage] = useState<'form' | 'congrats' | 'verified'>('form');
  const [activeSimulatedEmail, setActiveSimulatedEmail] = useState<string | null>(null);

  // Focus and highlight coupon button when verified
  const [isCouponHighlighted, setIsCouponHighlighted] = useState(false);

  // Ad-Free checkout screen modal state
  const [checkoutModalPlan, setCheckoutModalPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [showCancelAutoChargeConfirm, setShowCancelAutoChargeConfirm] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleConfirmRemoveAutoCharge = () => {
    onSetAdFree(true, {
      recurring: false,
    });
    setShowCancelAutoChargeConfirm(false);
    showToast('Automatic charge removed. Ad-Free access remains active through your current period.');
  };

  const handleResumeAutoCharge = () => {
    onSetAdFree(true, {
      recurring: true,
    });
    showToast('Automatic recurring renewal has been re-enabled.');
  };

  const handleVolumeChange = (newVal: number) => {
    setVol(newVal);
    setSoundVolume(newVal);
    onUpdateShop({
      ...shopSettings,
      volume: newVal,
    });
  };

  const handleOpenAdFreeCheckout = (plan: 'monthly' | 'yearly') => {
    setCheckoutModalPlan(plan);
  };

  const handleEquipColor = (colorId: DiceColor, slot: 0 | 1) => {
    const isUnlocked = shopSettings.unlockedColors.includes(colorId);
    if (!isUnlocked) {
      const colorDef = ALL_COLORS.find(c => c.id === colorId);
      const price = colorDef ? colorDef.price : 50;
      if (coins < price) {
        showToast('Not enough coins!');
        return;
      }
      onAddCoins(-price);
      const nextUnlocked = [...shopSettings.unlockedColors, colorId];
      const nextEquipped = [...shopSettings.equippedColors] as [DiceColor, DiceColor];
      nextEquipped[slot] = colorId;
      onUpdateShop({
        ...shopSettings,
        unlockedColors: nextUnlocked,
        equippedColors: nextEquipped,
      });
      showToast(`Unlocked ${colorDef?.name || colorId}!`);
    } else {
      const nextEquipped = [...shopSettings.equippedColors] as [DiceColor, DiceColor];
      nextEquipped[slot] = colorId;
      onUpdateShop({
        ...shopSettings,
        equippedColors: nextEquipped,
      });
      showToast(`Equipped as Color ${slot === 0 ? 'A' : 'B'}!`);
    }
  };

  const handleEquipBg = (bgId: string) => {
    const isUnlocked =
      shopSettings.unlockedBgs.includes(bgId) ||
      shopSettings.unlockedBgs.includes(`bg-${bgId}`) ||
      (bgId === 'wood' && (shopSettings.unlockedBgs.includes('bg-wood') || shopSettings.unlockedBgs.includes('wood')));

    if (!isUnlocked) {
      const bgDef = ALL_BGS.find(b => b.id === bgId);
      const price = bgDef ? bgDef.price : 50;
      if (coins < price) {
        showToast('Not enough coins!');
        return;
      }
      onAddCoins(-price);
      onUpdateShop({
        ...shopSettings,
        unlockedBgs: [...shopSettings.unlockedBgs, bgId],
        equippedBg: bgId,
      });
      showToast(`Unlocked ${bgDef?.name || bgId}!`);
    } else {
      onUpdateShop({
        ...shopSettings,
        equippedBg: bgId,
      });
      const bgDef = ALL_BGS.find(b => b.id === bgId);
      showToast(`Equipped ${bgDef?.name || bgId}!`);
    }
  };

  // Handle In-App Purchase of Coin Packs
  const handlePurchaseCoinPack = (amount: number, priceStr: string) => {
    onAddCoins(amount);
    showToast(`🪙 ${amount.toLocaleString()} Coins added (${priceStr})!`);
    playWinCoinsSound();
  };

  // Handle Email Subscription Agreement
  const handleAgreeEmailSignup = async () => {
    const clean = emailInput.trim();
    if (!clean || !clean.includes('@')) {
      showToast('Please enter a valid email address.');
      return;
    }

    try {
      await saveEmailSubscriber({
        email: clean,
        userId: user.uid,
        country: selectedCountry,
        agreedAt: new Date().toISOString(),
        verified: false,
        consentVersion: 'DGL_PROMO_v1.0',
        source: 'ColorRun_Shop_Signup',
      });
    } catch {
      // Continue even if offline
    }

    setEmailStage('congrats');
    setActiveSimulatedEmail(clean);
  };

  // Handle "Verify Email" Button Click from the Email Message
  const handleVerifyEmailClick = async () => {
    if (activeSimulatedEmail) {
      try {
        await markEmailSubscriberVerified(activeSimulatedEmail);
      } catch {
        // Ignore
      }
    }

    // Close the email card, autofill DGLFREE300 into coupon area, and highlight REDEEM CODE
    setIsEmailModalOpen(false);
    setEmailStage('verified');
    setActiveTab('coins');
    setCouponInput('DGLFREE300');
    setIsCouponHighlighted(true);
    setCouponError('');
    setCouponSuccess('Email verified! Click REDEEM CODE below to claim your 300 free coins!');

    // Smooth scroll down to coupon section
    setTimeout(() => {
      const couponElem = document.getElementById('coupon-section');
      if (couponElem) {
        couponElem.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Handle Coupon & Referral Code Redemption
  const handleRedeemCoupon = async () => {
    setCouponError('');
    setCouponSuccess('');

    const cleanInput = couponInput.trim();
    if (!cleanInput) {
      setCouponError('Please enter a coupon code or 8-digit referral code.');
      return;
    }

    // 1. Check standard coupon codes (e.g. DGLFREE300, DGL1000FREE)
    const res = redeemShopCoupon(user.uid, cleanInput);
    if (res.success) {
      setBubbleCoins(res.coins);
      setShowBubble(true);
      setIsCouponHighlighted(false);
      setCouponSuccess(res.message);
      return;
    }

    // 2. Also accept 8-digit friend referral codes!
    try {
      const refRes = await redeemReferralCode(cleanInput, user);
      if (refRes.success) {
        setBubbleCoins(refRes.coins);
        setShowBubble(true);
        setIsCouponHighlighted(false);
        setCouponSuccess(refRes.message);
        return;
      }
      setCouponError(refRes.message || res.message);
    } catch {
      setCouponError(res.message);
    }
  };

  const handleBubbleComplete = () => {
    setShowBubble(false);
    onAddCoins(bubbleCoins);
    playWinCoinsSound();
  };

  return (
    <div className="w-full max-w-lg mx-auto p-2 sm:p-4 flex flex-col items-center select-none flex-1 min-h-0 h-full">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#1c6a35] text-white font-bold text-xs px-4 py-2 rounded-full shadow-lg animate-fade-in pointer-events-none">
          {toastMsg}
        </div>
      )}

      {/* Floating Rising Coin Bubble */}
      <RisingCoinBubble
        amount={bubbleCoins}
        isActive={showBubble}
        onComplete={handleBubbleComplete}
      />

      <div className="w-full flex-1 flex flex-col min-h-0 bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-3xl p-3 sm:p-4.5 shadow-2xl overflow-hidden">
        {/* Top Header: Navigation, Coin Balance & Shop Logo */}
        <div className="flex flex-col gap-1.5 pb-2.5 border-b border-[#ebdcb9] shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-xs sm:text-sm font-bold text-[#4a3622] hover:text-[#1c6a35] bg-white/80 hover:bg-white px-2.5 py-1 rounded-xl border border-[#ebdcb9] transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm text-[#e58a1f] bg-white/95 px-3 py-1 rounded-full border border-[#ebdcb9] shadow-xs">
              <span>🪙</span>
              <span>{coins.toLocaleString()}</span>
            </div>
          </div>

          {/* Color Run Shop Logo at the Top */}
          <div className="flex justify-center items-center py-0.5">
            <ColorRunShopLogo size="md" className="h-12 sm:h-16" />
          </div>

          {/* Section Tabs Across the Top */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#ede0c4]/80 rounded-2xl border border-[#d8c89f]">
            <button
              onClick={() => setActiveTab('coins')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer select-none ${
                activeTab === 'coins'
                  ? 'bg-[#1c6a35] text-white shadow-md'
                  : 'text-[#5e4933] hover:text-[#1c6a35] hover:bg-white/60'
              }`}
            >
              <Coins className="w-4 h-4 shrink-0" />
              <span>Coins</span>
            </button>

            <button
              onClick={() => setActiveTab('dice')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer select-none ${
                activeTab === 'dice'
                  ? 'bg-[#1c6a35] text-white shadow-md'
                  : 'text-[#5e4933] hover:text-[#1c6a35] hover:bg-white/60'
              }`}
            >
              <Dices className="w-4 h-4 shrink-0" />
              <span>Dice</span>
            </button>

            <button
              onClick={() => setActiveTab('backgrounds')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer select-none ${
                activeTab === 'backgrounds'
                  ? 'bg-[#1c6a35] text-white shadow-md'
                  : 'text-[#5e4933] hover:text-[#1c6a35] hover:bg-white/60'
              }`}
            >
              <Palette className="w-4 h-4 shrink-0" />
              <span>Backgrounds</span>
            </button>
          </div>
        </div>

        {/* Scrollable Tab Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-1 py-2 min-h-0">
          {/* ========================================================= */}
          {/* SECTION 1: COINS TAB                                      */}
          {/* ========================================================= */}
          {activeTab === 'coins' && (
            <div className="flex flex-col gap-4 py-1 animate-fade-in">
              {/* 1. COUPON CODE SECTION AT THE TOP */}
              <div
                id="coupon-section"
                className={`bg-white/95 border rounded-2xl p-3.5 sm:p-4 shadow-xs transition-all ${
                  isCouponHighlighted
                    ? 'ring-3 ring-[#2f9a4f] border-[#2f9a4f] bg-[#f2fbf4]'
                    : 'border-[#ebdcb9]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-[#1c6a35]" />
                    <h3 className="font-black text-xs sm:text-sm text-[#42311f] uppercase tracking-wide">
                      Redeem Coupon
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-[#8c7456]">
                    Codes are not case-sensitive
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-[#6a543e]">
                      Coupon Code
                    </label>
                    <input
                      type="text"
                      value={couponInput}
                      onChange={e => {
                        setCouponInput(e.target.value);
                        setCouponError('');
                      }}
                      placeholder="Add your code here."
                      className="w-full uppercase font-mono font-bold text-sm px-3.5 py-2.5 bg-white border border-[#d8c89f] rounded-xl text-[#2e2316] placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:text-[#9e8b75] focus:outline-hidden focus:ring-2 focus:ring-[#1c6a35]"
                    />
                  </div>

                  {/* In-app Popup Message when Email Verified */}
                  {emailStage === 'verified' && isCouponHighlighted && (
                    <div className="p-2.5 rounded-xl bg-[#e3f7e9] border border-[#2f9a4f] flex items-center gap-2 animate-bounce">
                      <ArrowDown className="w-4 h-4 text-[#1c6a35] shrink-0" />
                      <span className="text-xs font-black text-[#145025]">
                        🎉 Email verified! Code autofilled. Click REDEEM CODE below!
                      </span>
                    </div>
                  )}

                  {couponError && (
                    <div className="text-xs font-bold text-[#d62822] bg-[#fdf0ef] border border-[#f5c6cb] px-3 py-1.5 rounded-xl">
                      {couponError}
                    </div>
                  )}

                  {couponSuccess && !isCouponHighlighted && (
                    <div className="text-xs font-bold text-[#145025] bg-[#eef9f1] border border-[#c3e6cb] px-3 py-1.5 rounded-xl">
                      {couponSuccess}
                    </div>
                  )}

                  <button
                    onClick={handleRedeemCoupon}
                    className={`w-full py-2.5 sm:py-3 px-4 font-black text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer ${
                      isCouponHighlighted
                        ? 'bg-gradient-to-r from-[#2f9a4f] to-[#1c6a35] text-white ring-2 ring-[#1c6a35] animate-pulse'
                        : 'bg-[#2f9a4f] hover:bg-[#258241] text-white'
                    }`}
                  >
                    <span>REDEEM CODE</span>
                  </button>
                </div>
              </div>

              {/* SIGN UP FOR EMAILS FOR FREE COINS */}
              <div className="bg-gradient-to-r from-[#eef9f1] via-[#e5f5ea] to-[#d8efe0] border-2 border-[#2f9a4f]/50 rounded-2xl p-3 sm:p-3.5 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#2f9a4f] text-white shadow-xs shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-xs sm:text-sm text-[#145025] leading-tight">
                        Sign up for emails for free coins!
                      </span>
                      <span className="text-[10.5px] font-bold text-[#2f9a4f] mt-0.5">
                        Get 300 free coins sent to your inbox
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsEmailModalOpen(true)}
                    className="py-1.5 sm:py-2 px-3 bg-[#2f9a4f] hover:bg-[#258241] active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Get 300 Coins</span>
                  </button>
                </div>
              </div>

              {/* 2. UNDER REDEMPTION BLOCK: ALL COIN OPTIONS (Coin Bank) */}
              <div className="bg-white/90 border border-[#ebdcb9] rounded-2xl p-3.5 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🏦</span>
                    <h3 className="font-black text-xs sm:text-sm text-[#42311f] uppercase tracking-wide">
                      Coin Bank
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-[#8c7456] uppercase tracking-wider">
                    Instant Credits
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COIN_PACKAGES.map((pkg, idx) => {
                    const isBestValue = pkg.label === 'Best Value';
                    return (
                      <div
                        key={idx}
                        onClick={() => handlePurchaseCoinPack(pkg.coins, pkg.price)}
                        className={`relative p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer group active:scale-98 ${
                          isBestValue
                            ? 'sm:col-span-2 bg-gradient-to-r from-[#fff9e6] via-[#fff3cc] to-[#ffecb3] border-[#f2c14e] shadow-md ring-2 ring-[#f2c14e]/40'
                            : 'bg-white border-[#ebdcb9] hover:border-[#2f9a4f] hover:bg-[#f6fcf8]'
                        }`}
                      >
                        {pkg.label && (
                          <span
                            className={`absolute -top-2.5 right-3 text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs tracking-wide ${
                              isBestValue
                                ? 'bg-gradient-to-r from-[#d62822] to-[#fa8231] text-white'
                                : 'bg-[#2f9a4f] text-white'
                            }`}
                          >
                            {pkg.label}
                          </span>
                        )}

                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">🪙</span>
                          <div className="flex flex-col">
                            <span className="font-black text-sm text-[#2d2215] font-mono">
                              +{pkg.coins.toLocaleString()} Coins
                            </span>
                            <span className="text-[10px] text-[#7a644e] font-medium">
                              Instant unlock
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`py-1.5 px-3 rounded-lg text-xs font-black shadow-xs transition-all pointer-events-none ${
                            isBestValue
                              ? 'bg-[#e58a1f] group-hover:bg-[#d47b14] text-white'
                              : 'bg-[#2f9a4f] group-hover:bg-[#258241] text-white'
                          }`}
                        >
                          {pkg.price}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Go Ad Free Section */}
              <div className="bg-white/90 border border-[#ebdcb9] rounded-2xl p-3.5 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#f2c14e]/20 text-[#1c6a35]">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h3 className="font-black text-xs sm:text-sm text-[#42311f] uppercase tracking-wide">
                      Go Ad Free
                    </h3>
                  </div>
                  {user.isAdFree && (
                    <span className="flex items-center gap-1 text-[10px] font-black bg-[#2f9a4f]/15 text-[#1c6a35] px-2 py-0.5 rounded-full border border-[#2f9a4f]/30">
                      <Check className="w-3 h-3" />
                      <span>AD-FREE ACTIVE</span>
                    </span>
                  )}
                </div>

                {user.isAdFree ? (() => {
                  const isEnrolled = !!user.adFreePlan && user.adFreeRecurring !== false;
                  const isAutoChargeRemoved = !!user.adFreePlan && user.adFreeRecurring === false;

                  return (
                    <div className="bg-[#eefaf1] border border-[#c6ecd0] rounded-xl p-3 text-xs text-[#1c6a35]">
                      <p className="font-bold mb-1">
                        All ads are disabled on this account!
                      </p>
                      <p className="text-[11px] text-[#2d5538] leading-relaxed">
                        Both bottom banner strips and 10-second full-screen ads before game matches are removed.
                      </p>
                      {user.adFreeBillingDate && (
                        <p className="mt-2 text-[11px] font-medium text-[#1c6a35] pt-1.5 border-t border-[#d1f2d9]">
                          Subscription:{' '}
                          <span className="font-bold">
                            {user.adFreePlan === 'yearly' ? 'Yearly ($29.99 USD)' : 'Monthly ($2.99 USD)'}
                          </span>{' '}
                          • Next billing date:{' '}
                          <span className="font-bold">
                            {formatBillingDate(new Date(user.adFreeBillingDate))}
                          </span>
                        </p>
                      )}

                      {/* If user is enrolled in recurring auto-charge */}
                      {isEnrolled && (
                        <div className="mt-2.5 pt-2 border-t border-[#c6ecd0]">
                          {!showCancelAutoChargeConfirm ? (
                            <div>
                              <div className="flex items-center justify-between text-[11px] mb-2 text-[#2d5538]">
                                <span className="font-medium">Upcoming Automatic Charge:</span>
                                <span className="font-bold text-[#1c6a35] bg-white px-2 py-0.5 rounded border border-[#bde7c6]">
                                  Enrolled ({user.adFreePlan === 'yearly' ? '$29.99 USD' : '$2.99 USD'})
                                </span>
                              </div>
                              <button
                                id="remove-auto-charge-button"
                                onClick={() => setShowCancelAutoChargeConfirm(true)}
                                className="w-full py-2 px-3 bg-[#fff1f1] hover:bg-[#fee2e2] active:scale-98 text-[#b91c1c] border border-[#fca5a5] font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
                              >
                                <CalendarX className="w-3.5 h-3.5 text-[#b91c1c]" />
                                <span>Remove Automatic Charge for Upcoming Payment</span>
                              </button>
                            </div>
                          ) : (
                            <div className="p-3 bg-[#fff5f5] border border-[#fca5a5] rounded-xl text-left">
                              <div className="flex items-start gap-2 text-[#991b1b] font-black text-xs mb-1">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-[#dc2626] mt-0.5" />
                                <span>Remove Upcoming Automatic Charge?</span>
                              </div>
                              <p className="text-[11px] text-[#7f1d1d] leading-relaxed mb-2.5">
                                Your upcoming automatic charge of{' '}
                                <span className="font-bold">
                                  {user.adFreePlan === 'yearly' ? '$29.99 USD' : '$2.99 USD'}
                                </span>{' '}
                                on{' '}
                                <span className="font-bold">
                                  {user.adFreeBillingDate ? formatBillingDate(new Date(user.adFreeBillingDate)) : 'the renewal date'}
                                </span>{' '}
                                will be cancelled. You will remain Ad-Free through that date, after which your account will not be charged and ads will resume.
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  id="confirm-remove-auto-charge-btn"
                                  onClick={handleConfirmRemoveAutoCharge}
                                  className="flex-1 py-1.5 px-3 bg-[#dc2626] hover:bg-[#b91c1c] active:scale-98 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                                >
                                  Confirm Removal
                                </button>
                                <button
                                  onClick={() => setShowCancelAutoChargeConfirm(false)}
                                  className="py-1.5 px-3 bg-white hover:bg-stone-100 active:scale-98 text-stone-700 border border-stone-300 font-bold text-xs rounded-lg transition-colors cursor-pointer text-center"
                                >
                                  Keep Auto-Renew
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* If automatic charge has already been removed */}
                      {isAutoChargeRemoved && (
                        <div className="mt-2.5 pt-2 border-t border-[#c6ecd0] flex flex-col gap-1.5 text-[11px]">
                          <div className="flex items-center justify-between text-[#2d5538]">
                            <span className="font-medium">Upcoming Automatic Charge:</span>
                            <span className="font-bold text-[#b91c1c] bg-[#fee2e2] px-2 py-0.5 rounded border border-[#fecaca]">
                              Removed (No upcoming billing)
                            </span>
                          </div>
                          <p className="text-[11px] text-[#4d6352] leading-relaxed">
                            Your automatic renewal has been removed. You will remain Ad-Free until{' '}
                            <span className="font-bold text-[#1c6a35]">
                              {user.adFreeBillingDate ? formatBillingDate(new Date(user.adFreeBillingDate)) : 'your expiration date'}
                            </span>
                            .
                          </p>
                          <button
                            onClick={handleResumeAutoCharge}
                            className="mt-1 w-full py-1.5 px-3 bg-[#eefaf1] hover:bg-[#dcf5e3] active:scale-98 text-[#1c6a35] border border-[#a3e3b3] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Re-enable Automatic Charge</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div>
                    <p className="text-xs text-[#6e533c] mb-3 leading-relaxed">
                      Remove bottom banner strips and the 10-second full-screen ads before game matches.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <button
                        onClick={() => handleOpenAdFreeCheckout('monthly')}
                        className="py-2.5 px-3 bg-[#2f9a4f] hover:bg-[#258241] text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex flex-col items-center justify-center cursor-pointer text-center"
                      >
                        <span>Go Ad-Free Monthly</span>
                        <span className="text-[10px] font-semibold opacity-95 mt-0.5">$2.99 USD / mo</span>
                      </button>
                      <button
                        onClick={() => handleOpenAdFreeCheckout('yearly')}
                        className="relative py-2.5 px-3 bg-[#1c6a35] hover:bg-[#145328] text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex flex-col items-center justify-center cursor-pointer text-center ring-1 ring-[#e58a1f]"
                      >
                        <span className="absolute -top-2 right-2 bg-[#e58a1f] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                          Best Value
                        </span>
                        <span>Go Ad-Free for a Year</span>
                        <span className="text-[10px] font-semibold opacity-95 mt-0.5">$29.99 USD</span>
                      </button>
                    </div>

                    {/* Physical game redemption */}
                    <div className="pt-2 border-t border-[#ebdcb9]/60 flex items-center justify-between">
                      <span className="text-[11px] text-[#8c745e] font-medium">
                        Bought the physical box?
                      </span>
                      <button
                        onClick={onOpenRedeemModal}
                        className="text-xs font-bold text-[#1c6a35] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Enter Code</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sound Volume Slider */}
              <div className="bg-white/80 border border-[#ebdcb9] rounded-2xl p-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#5e4933] mb-2">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-[#1c6a35]" />
                    <span>Sound Effects</span>
                  </span>
                  <span className="font-mono">{vol}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={vol}
                  onChange={e => handleVolumeChange(Number(e.target.value))}
                  className="w-full accent-[#2f9a4f]"
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 2: DICE TAB                                       */}
          {/* ========================================================= */}
          {activeTab === 'dice' && (
            <div className="flex flex-col gap-3 py-1 animate-fade-in">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="font-black text-xs sm:text-sm text-[#42311f] uppercase tracking-wide">
                    Dice Colors
                  </h3>
                  <p className="text-[11px] text-[#7a644e]">
                    Spade face (♠) showing for each available color
                  </p>
                </div>
                <span className="text-xs text-[#8c7456] font-bold bg-white/80 px-2.5 py-1 rounded-lg border border-[#ebdcb9]">
                  50 🪙 each
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {ALL_COLORS.map(color => {
                  const isUnlocked = shopSettings.unlockedColors.includes(color.id);
                  const isEquippedSlot0 = shopSettings.equippedColors[0] === color.id;
                  const isEquippedSlot1 = shopSettings.equippedColors[1] === color.id;
                  const isEquipped = isEquippedSlot0 || isEquippedSlot1;

                  return (
                    <div
                      key={color.id}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isEquipped
                          ? 'bg-[#2f9a4f]/15 border-[#2f9a4f] ring-1 ring-[#2f9a4f]'
                          : 'bg-white/85 border-[#ebdcb9]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-2.5">
                        {/* Die with spade on the face in this color */}
                        <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 drop-shadow-xs">
                          <DieComponent color={color.id} value={4} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-[#3e2e1e] truncate">{color.name}</div>
                          <div className="text-[10px] text-[#7a644e]">
                            {color.price === 0 ? 'Starter' : isUnlocked ? 'Unlocked' : `🪙 ${color.price}`}
                          </div>
                        </div>
                      </div>

                      {!isUnlocked ? (
                        <button
                          onClick={() => handleEquipColor(color.id, 0)}
                          className="w-full py-1 text-xs font-bold bg-[#e58a1f] hover:bg-[#cb7512] text-white rounded-lg transition-transform active:scale-95 cursor-pointer shadow-2xs"
                        >
                          Unlock ({color.price} 🪙)
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEquipColor(color.id, 0)}
                            className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                              isEquippedSlot0
                                ? 'bg-[#2f9a4f] text-white border-[#2f9a4f]'
                                : 'bg-white text-[#42311f] border-[#d8c89f] hover:bg-stone-50'
                            }`}
                          >
                            Set A
                          </button>
                          <button
                            onClick={() => handleEquipColor(color.id, 1)}
                            className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                              isEquippedSlot1
                                ? 'bg-[#2f9a4f] text-white border-[#2f9a4f]'
                                : 'bg-white text-[#42311f] border-[#d8c89f] hover:bg-stone-50'
                            }`}
                          >
                            Set B
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 3: BACKGROUNDS TAB                                */}
          {/* ========================================================= */}
          {activeTab === 'backgrounds' && (
            <div className="flex flex-col gap-3 py-1 animate-fade-in">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="font-black text-xs sm:text-sm text-[#42311f] uppercase tracking-wide">
                    Table Surfaces
                  </h3>
                  <p className="text-[11px] text-[#7a644e]">
                    Choose the backdrop for your rolling table
                  </p>
                </div>
                <span className="text-xs text-[#8c7456] font-bold bg-white/80 px-2.5 py-1 rounded-lg border border-[#ebdcb9]">
                  50 🪙 each
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_BGS.map(bg => {
                  const isUnlocked =
                    shopSettings.unlockedBgs.includes(bg.id) ||
                    shopSettings.unlockedBgs.includes(`bg-${bg.id}`) ||
                    (bg.id === 'wood' && (shopSettings.unlockedBgs.includes('bg-wood') || shopSettings.unlockedBgs.includes('wood')));
                  const isEquipped =
                    shopSettings.equippedBg === bg.id ||
                    shopSettings.equippedBg === `bg-${bg.id}` ||
                    (bg.id === 'wood' && (shopSettings.equippedBg === 'wood' || shopSettings.equippedBg === 'bg-wood'));

                  return (
                    <button
                      key={bg.id}
                      onClick={() => handleEquipBg(bg.id)}
                      className={`p-2.5 rounded-xl text-left border flex items-center gap-2.5 transition-all cursor-pointer ${
                        isEquipped
                          ? 'bg-[#2f9a4f]/15 border-[#2f9a4f] ring-1 ring-[#2f9a4f]'
                          : 'bg-white/85 border-[#ebdcb9] hover:bg-white'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-[#ebdcb9] bg-[#bd9059] flex items-center justify-center shadow-2xs">
                        {bg.image ? (
                          <img src={bg.image} alt={bg.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-b from-[#b5834b] to-[#7d4f20]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#3e2e1e] truncate">{bg.name}</div>
                        <div className="text-[10px] text-[#7a644e]">
                          {isEquipped ? 'Active' : isUnlocked ? 'Unlocked' : `🪙 ${bg.price}`}
                        </div>
                      </div>
                      {isEquipped && <Check className="w-4 h-4 text-[#2f9a4f] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar: Back to Menu Button */}
        <div className="pt-2 border-t border-[#ebdcb9] shrink-0 mt-auto">
          <button
            onClick={onBack}
            className="w-full py-2 bg-[#eae0c5] hover:bg-[#ded1af] text-[#4a3622] font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-transform active:scale-98 cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* EMAIL SIGNUP & VERIFICATION MODAL                         */}
      {/* ========================================================= */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
          <div className="w-full max-w-md bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#ebdcb9] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#2f9a4f] text-white">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#1c6a35]">
                    {emailStage === 'form' ? 'Sign up for emails for free coins!' : 'Check Your Inbox'}
                  </h3>
                  <span className="text-[10px] text-[#7a644e]">
                    Data Games Lab Official Promotional Newsletter
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold flex items-center justify-center text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {emailStage === 'form' ? (
              <div className="flex flex-col gap-3.5 overflow-y-auto pr-1">
                {/* Email input */}
                <div>
                  <label className="block text-xs font-bold text-[#42311f] mb-1">
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#d8c89f] rounded-xl text-sm font-medium text-[#2e2316] focus:outline-hidden focus:ring-2 focus:ring-[#1c6a35]"
                  />
                </div>

                {/* Country selector for regional compliance */}
                <div>
                  <label className="block text-xs font-bold text-[#42311f] mb-1">
                    Account Country / Jurisdiction
                  </label>
                  <select
                    value={selectedCountry}
                    onChange={e => setSelectedCountry(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#d8c89f] rounded-xl text-xs font-medium text-[#2e2316]"
                  >
                    <option value="United States (US)">United States (CAN-SPAM / CCPA)</option>
                    <option value="Canada (CA)">Canada (CASL Compliance)</option>
                    <option value="United Kingdom (UK)">United Kingdom (UK GDPR / PECR)</option>
                    <option value="European Union (EU)">European Union (GDPR)</option>
                    <option value="Australia (AU)">Australia (Spam Act 2003)</option>
                    <option value="International">Other / International</option>
                  </select>
                </div>

                {/* Comprehensive User Agreement & Compliance Verbiage */}
                <div className="p-3 bg-white/90 border border-[#ebdcb9] rounded-xl text-[11px] text-[#5e4933] leading-relaxed flex flex-col gap-2 max-h-36 overflow-y-auto">
                  <div className="flex items-center gap-1 font-bold text-[#1c6a35]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Promotional Email Agreement & Consent</span>
                  </div>
                  <p>
                    By clicking <strong>Agree</strong>, you explicitly consent to receive promotional emails, bonus codes, product updates, and special announcements from <strong>Data Games Lab</strong> for <em>Color Run</em> and other new game releases from Data Games Lab.
                  </p>
                  <p className="text-[10px] text-[#7a644e]">
                    Compliance Notice ({selectedCountry}): You confirm you meet the age requirement for digital consent in your jurisdiction. We respect your privacy: your information will not be sold to third parties. You may withdraw your consent and unsubscribe at any time by clicking the unsubscribe link in any email message or contacting support@datagameslab.com.
                  </p>
                </div>

                {/* Agreement Checkbox */}
                <label className="flex items-center gap-2 text-xs font-bold text-[#3e2e1e] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    className="w-4 h-4 accent-[#2f9a4f] rounded-xs"
                  />
                  <span>I agree to receive promotional emails from Data Games Lab</span>
                </label>

                {/* Agree Green Button */}
                <button
                  onClick={handleAgreeEmailSignup}
                  disabled={!agreedToTerms || !emailInput.trim()}
                  className="w-full py-3 px-4 bg-[#2f9a4f] hover:bg-[#258241] disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Agree &amp; Get 300 Coins</span>
                </button>
              </div>
            ) : (
              /* Congratulations + Simulated Email Inbox preview */
              <div className="flex flex-col gap-3">
                {/* App Screen Message */}
                <div className="p-3.5 rounded-2xl bg-[#e3f7e9] border border-[#2f9a4f] text-center flex flex-col items-center">
                  <Sparkles className="w-6 h-6 text-[#1c6a35] mb-1 animate-pulse" />
                  <span className="font-black text-sm text-[#145025]">
                    Congratulations! Check your email for 300 coins!
                  </span>
                  <span className="text-[11px] text-[#2f9a4f] mt-0.5">
                    We sent an activation link to <strong>{activeSimulatedEmail}</strong>
                  </span>
                </div>

                {/* Simulated Email Envelope & Message */}
                <div className="bg-white border-2 border-[#d8c89f] rounded-2xl p-4 shadow-md flex flex-col text-left">
                  <div className="border-b border-stone-200 pb-2 mb-2.5 text-[11px] text-stone-500 flex flex-col gap-0.5">
                    <div>
                      <span className="font-bold text-stone-700">From: </span>
                      <span>Data Games Lab &lt;newsletter@datagameslab.com&gt;</span>
                    </div>
                    <div>
                      <span className="font-bold text-stone-700">To: </span>
                      <span>{activeSimulatedEmail}</span>
                    </div>
                    <div>
                      <span className="font-bold text-stone-700">Subject: </span>
                      <span className="font-semibold text-stone-800">
                        Verify your email for 300 Free Color Run Coins!
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-stone-700 leading-relaxed mb-4">
                    Thank you for signing up for the Data Games Lab Color Run Newsletter. Please verify that you would like to receive these emails and get 300 free coins for Color Run.
                  </p>

                  <button
                    onClick={handleVerifyEmailClick}
                    className="w-full py-2.5 px-4 bg-[#2f9a4f] hover:bg-[#258241] active:scale-98 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Verify Email</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Go Ad-Free Checkout Screen Modal */}
      {checkoutModalPlan && (
        <AdFreeCheckoutModal
          isOpen={checkoutModalPlan !== null}
          initialPlan={checkoutModalPlan}
          user={user}
          onClose={() => setCheckoutModalPlan(null)}
          onConfirm={(plan, nextBillingDate, recurring) => {
            onSetAdFree(true, {
              plan,
              billingDate: nextBillingDate,
              recurring,
            });
            setCheckoutModalPlan(null);
            showToast(
              `🎉 You are now Ad-Free (${plan === 'yearly' ? 'Yearly' : 'Monthly'})! All ads removed.`
            );
          }}
        />
      )}
    </div>
  );
};
