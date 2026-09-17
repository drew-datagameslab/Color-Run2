import React, { useState, useRef } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Check,
  Sparkles,
  User,
  Palette,
  Dices,
  HardDrive,
  ShieldCheck,
  LogOut,
  Mail,
  Fingerprint,
  Camera,
  Upload,
  Image as ImageIcon,
  Phone,
} from 'lucide-react';
import { UserAccount, DiceColor, ShopSettings } from '../types/game';
import { DEFAULT_AVATARS } from '../lib/storage';
import { DieComponent } from './DieComponent';
import { getSoundVolume, setSoundVolume, playSfx } from '../lib/audio';
import { registerUserPhoneNumber } from '../lib/referrals';

interface ProfileModalProps {
  isOpen: boolean;
  user: UserAccount;
  shopSettings: ShopSettings;
  coins: number;
  onClose: () => void;
  onSaveUser: (updatedUser: UserAccount) => void;
  onUpdateShop: (updatedShop: ShopSettings) => void;
  onOpenFiles?: () => void;
  onLogOut?: () => void;
  onToast: (msg: string) => void;
}

const ALL_DICE_COLORS: Array<{ id: DiceColor; name: string; hex: string }> = [
  { id: 'blue', name: 'Blue', hex: '#1f7fd6' },
  { id: 'red', name: 'Red', hex: '#e5352f' },
  { id: 'green', name: 'Green', hex: '#2f9a4f' },
  { id: 'purple', name: 'Purple', hex: '#8e44c9' },
  { id: 'black', name: 'Midnight', hex: '#222222' },
  { id: 'lblue', name: 'Sky Blue', hex: '#45aaf2' },
  { id: 'orange', name: 'Amber', hex: '#fa8231' },
  { id: 'pink', name: 'Neon Pink', hex: '#fd79a8' },
];

const ALL_BACKGROUNDS: Array<{ id: string; name: string; previewClass: string; desc: string }> = [
  { id: 'bg-wood', name: 'Classic Wood', previewClass: 'bg-wood', desc: 'Warm mahogany grain' },
  { id: 'bg-galaxy', name: 'Night Galaxy', previewClass: 'bg-galaxy', desc: 'Cosmic deep space' },
  { id: 'bg-sky', name: 'Puffy Clouds', previewClass: 'bg-sky', desc: 'Sunny blue skies' },
  { id: 'bg-castle', name: 'Castle Garden', previewClass: 'bg-castle', desc: 'Majestic floral stone' },
  { id: 'bg-cliffs', name: 'Cliffs of Scotland', previewClass: 'bg-cliffs', desc: 'Highlands coastline' },
  { id: 'bg-velvet', name: 'Emerald Velvet Felt', previewClass: 'bg-velvet', desc: 'Casino green felt' },
  { id: 'bg-midnight', name: 'Midnight Blue Felt', previewClass: 'bg-midnight', desc: 'Sleek luxury navy' },
  { id: 'bg-marble', name: 'Dark Slate Marble', previewClass: 'bg-marble', desc: 'Modern charcoal stone' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  user,
  shopSettings,
  coins,
  onClose,
  onSaveUser,
  onUpdateShop,
  onOpenFiles,
  onLogOut,
  onToast,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'volume' | 'dice' | 'backgrounds' | 'avatar' | 'account'>('avatar');

  // User state
  const [name, setName] = useState(user.name);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [selectedColor, setSelectedColor] = useState(user.avatar.color);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(user.avatar.image);
  const [avatarSubTab, setAvatarSubTab] = useState<'presets' | 'upload' | 'initials'>(
    user.avatar.image ? (user.avatar.image.startsWith('data:') ? 'upload' : 'presets') : 'presets'
  );
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onToast('Please upload an image file (PNG, JPG, or WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Auto-resize and square-crop image using canvas for snappy loading
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetDim = 256;
        canvas.width = targetDim;
        canvas.height = targetDim;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetDim, targetDim);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setSelectedImage(compressed);
          setAvatarSubTab('upload');
          onToast('Photo avatar ready! Tap Save & Close.');
        } else {
          setSelectedImage(dataUrl);
          setAvatarSubTab('upload');
          onToast('Photo avatar loaded!');
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Dice state
  const [diceColorA, setDiceColorA] = useState<DiceColor>(user.diceColors?.[0] || shopSettings.equippedColors[0] || 'blue');
  const [diceColorB, setDiceColorB] = useState<DiceColor>(user.diceColors?.[1] || shopSettings.equippedColors[1] || 'red');
  const [activeSlot, setActiveSlot] = useState<1 | 2>(1);

  // Background state
  const [equippedBg, setEquippedBg] = useState<string>(shopSettings.equippedBg || 'bg-wood');

  // Volume state
  const [volPct, setVolPct] = useState<number>(() => Math.round((getSoundVolume() / 0.7) * 100));
  const [prevVol, setPrevVol] = useState<number>(volPct > 0 ? volPct : 70);

  const handleVolumeChange = (newPct: number) => {
    setVolPct(newPct);
    setSoundVolume(newPct);
    onUpdateShop({
      ...shopSettings,
      volume: newPct,
    });
  };

  const toggleMute = () => {
    if (volPct > 0) {
      setPrevVol(volPct);
      handleVolumeChange(0);
      onToast('Audio muted');
    } else {
      handleVolumeChange(prevVol > 0 ? prevVol : 70);
      onToast('Audio unmuted');
    }
  };

  const handleSelectDiceColor = (c: DiceColor) => {
    let nextA = diceColorA;
    let nextB = diceColorB;

    if (activeSlot === 1) {
      nextA = c;
      if (c === nextB) {
        nextB = ALL_DICE_COLORS.find(item => item.id !== c)?.id || 'red';
      }
      setDiceColorA(nextA);
      setDiceColorB(nextB);
      setActiveSlot(2);
    } else {
      nextB = c;
      if (c === nextA) {
        nextA = ALL_DICE_COLORS.find(item => item.id !== c)?.id || 'blue';
      }
      setDiceColorA(nextA);
      setDiceColorB(nextB);
      setActiveSlot(1);
    }

    // Auto-update both user dice and shop settings
    onSaveUser({
      ...user,
      diceColors: [nextA, nextB],
    });
    onUpdateShop({
      ...shopSettings,
      equippedColors: [nextA, nextB],
    });
    onToast(`Equipped ${c} dice!`);
  };

  const handleSelectBg = (bgId: string) => {
    setEquippedBg(bgId);
    onUpdateShop({
      ...shopSettings,
      equippedBg: bgId,
    });
    const bgName = ALL_BACKGROUNDS.find(b => b.id === bgId)?.name || 'Background';
    onToast(`Equipped ${bgName}!`);
  };

  const handleSaveAndClose = () => {
    const trimmed = name.trim() || 'Player';
    const cleanPhone = phoneNumber.trim();
    const updatedUser: UserAccount = {
      ...user,
      name: trimmed,
      phoneNumber: cleanPhone || undefined,
      avatar: {
        color: selectedColor,
        name: trimmed.slice(0, 2).toUpperCase(),
        image: avatarSubTab !== 'initials' ? selectedImage : undefined,
      },
      diceColors: [diceColorA, diceColorB],
    };

    if (cleanPhone) {
      registerUserPhoneNumber(updatedUser, cleanPhone);
    }

    onSaveUser(updatedUser);
    onUpdateShop({
      ...shopSettings,
      equippedColors: [diceColorA, diceColorB],
      equippedBg,
      volume: volPct,
    });

    onClose();
    onToast('Profile updated!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#181818] text-white p-3 px-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full border border-[#f2c14e] flex items-center justify-center font-bold text-xs text-white overflow-hidden"
              style={{
                backgroundColor: selectedColor,
                backgroundImage: selectedImage && avatarSubTab !== 'initials' ? `url(${selectedImage})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {(!selectedImage || avatarSubTab === 'initials') && (name.slice(0, 2).toUpperCase() || 'P1')}
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xs uppercase tracking-wider text-white">
                Player Profile &amp; Settings
              </span>
              <span className="text-[10px] text-[#f2c14e] font-mono font-bold flex items-center gap-1">
                <span>🪙</span>
                <span>{coins.toLocaleString()} Coins</span>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#2a2a2a] hover:bg-[#383838] text-white flex items-center justify-center transition-colors border border-white/10 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-5 gap-1 p-1.5 sm:p-2 bg-[#ede3c9] border-b border-[#ebdcb9]">
          <button
            onClick={() => setActiveTab('avatar')}
            className={`py-2 px-1 text-[11px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'avatar'
                ? 'bg-[#1c6a35] text-white shadow-sm scale-102'
                : 'text-[#5c442d] hover:bg-black/5'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Avatar</span>
          </button>

          <button
            onClick={() => setActiveTab('dice')}
            className={`py-2 px-1 text-[11px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'dice'
                ? 'bg-[#1c6a35] text-white shadow-sm scale-102'
                : 'text-[#5c442d] hover:bg-black/5'
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Dice</span>
          </button>

          <button
            onClick={() => setActiveTab('backgrounds')}
            className={`py-2 px-1 text-[11px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'backgrounds'
                ? 'bg-[#1c6a35] text-white shadow-sm scale-102'
                : 'text-[#5c442d] hover:bg-black/5'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Theme</span>
          </button>

          <button
            onClick={() => setActiveTab('volume')}
            className={`py-2 px-1 text-[11px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'volume'
                ? 'bg-[#1c6a35] text-white shadow-sm scale-102'
                : 'text-[#5c442d] hover:bg-black/5'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Volume</span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`py-2 px-1 text-[11px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'account'
                ? 'bg-[#1c6a35] text-white shadow-sm scale-102'
                : 'text-[#5c442d] hover:bg-black/5'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Account</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[60vh]">
          {/* TAB 1: AVATAR & NAME */}
          {activeTab === 'avatar' && (
            <div className="flex flex-col items-center">
              {/* Avatar Preview */}
              <div className="flex flex-col items-center mb-3">
                <div
                  className="w-18 h-18 rounded-full border-3 border-[#f2c14e] shadow-lg flex items-center justify-center text-xl font-black text-white mb-2 overflow-hidden"
                  style={{
                    backgroundColor: selectedColor,
                    backgroundImage: selectedImage && avatarSubTab !== 'initials' ? `url(${selectedImage})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {(!selectedImage || avatarSubTab === 'initials') && (name.slice(0, 2).toUpperCase() || 'P1')}
                </div>
                <div className="w-full max-w-xs">
                  <label className="text-[10px] font-black uppercase text-[#6d5138] tracking-wider block text-center mb-1">
                    Player Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    maxLength={14}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter Name"
                    className="w-full text-center font-black text-sm px-3 py-1.5 bg-white border border-[#d8c89f] rounded-xl text-[#2e2316] focus:outline-hidden focus:ring-2 focus:ring-[#1c6a35]"
                  />
                </div>
              </div>

              {/* Sub-tab: Presets vs Upload vs Initials */}
              <div className="w-full flex rounded-xl bg-[#ede3c9] p-1 mb-3 gap-1">
                <button
                  onClick={() => setAvatarSubTab('presets')}
                  className={`flex-1 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                    avatarSubTab === 'presets' ? 'bg-[#2f9a4f] text-white shadow-xs' : 'text-[#6e553a]'
                  }`}
                >
                  Presets (45)
                </button>
                <button
                  onClick={() => setAvatarSubTab('upload')}
                  className={`flex-1 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    avatarSubTab === 'upload' ? 'bg-[#2f9a4f] text-white shadow-xs' : 'text-[#6e553a]'
                  }`}
                >
                  <Camera className="w-3 h-3" />
                  <span>Upload Photo</span>
                </button>
                <button
                  onClick={() => setAvatarSubTab('initials')}
                  className={`flex-1 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                    avatarSubTab === 'initials' ? 'bg-[#2f9a4f] text-white shadow-xs' : 'text-[#6e553a]'
                  }`}
                >
                  Initials
                </button>
              </div>

              {avatarSubTab === 'presets' && (
                <div className="w-full grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 bg-white/60 rounded-2xl border border-[#ebdcb9]">
                  {Array.from({ length: 45 }).map((_, idx) => {
                    const imgPath = `/assets/avatars/avatar_${idx + 1}.png`;
                    const isSelected = selectedImage === imgPath;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(imgPath)}
                        className={`aspect-square rounded-full overflow-hidden border-2 transition-transform active:scale-90 cursor-pointer ${
                          isSelected
                            ? 'border-[#2f9a4f] ring-2 ring-[#2f9a4f] scale-105 shadow-sm'
                            : 'border-[#d8c89f] hover:border-[#a8986f]'
                        }`}
                      >
                        <img
                          src={imgPath}
                          alt={`Avatar ${idx + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {avatarSubTab === 'upload' && (
                <div className="w-full p-4 bg-white/80 rounded-2xl border border-[#ebdcb9] flex flex-col items-center text-center">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />

                  {selectedImage && (selectedImage.startsWith('data:') || selectedImage.startsWith('blob:')) ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <img
                          src={selectedImage}
                          alt="Custom Avatar Preview"
                          className="w-20 h-20 rounded-full object-cover border-3 border-[#2f9a4f] shadow-md"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-[#2f9a4f] text-white p-1 rounded-full shadow-xs">
                          <Check className="w-3 h-3" />
                        </div>
                      </div>
                      <p className="text-xs font-bold text-[#1c6a35]">
                        Custom photo avatar ready!
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="px-3 py-1.5 bg-[#2f9a4f] hover:bg-[#258241] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Change Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(undefined);
                            setAvatarSubTab('presets');
                            onToast('Custom photo removed');
                          }}
                          className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-[#cbb88a] hover:border-[#1c6a35] hover:bg-[#f6fcf8] rounded-2xl p-4 sm:p-5 flex flex-col items-center gap-2 transition-all cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#f2e7cd] group-hover:bg-[#d8f2de] flex items-center justify-center text-[#6e553a] group-hover:text-[#1c6a35] transition-colors">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-black text-[#382b1d] group-hover:text-[#1c6a35]">
                        Click or Drag to Upload Avatar Photo
                      </span>
                      <span className="text-[11px] text-[#7d6852] max-w-xs leading-relaxed">
                        Choose any JPG, PNG, or WEBP photo. It will be centered and cropped into your player profile.
                      </span>
                      <button
                        type="button"
                        className="mt-1 px-4 py-1.5 bg-[#1c6a35] text-white text-xs font-bold rounded-xl shadow-xs group-hover:bg-[#227e3f]"
                      >
                        Choose Photo
                      </button>
                    </div>
                  )}
                </div>
              )}

              {avatarSubTab === 'initials' && (
                <div className="w-full grid grid-cols-4 gap-2.5 p-2 bg-white/60 rounded-2xl border border-[#ebdcb9]">
                  {DEFAULT_AVATARS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`h-11 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-xs transition-transform active:scale-95 cursor-pointer ${
                        selectedColor === color ? 'ring-3 ring-[#1c6a35] scale-105' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {name.slice(0, 2).toUpperCase() || 'P1'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DICE COLORS */}
          {activeTab === 'dice' && (
            <div className="flex flex-col">
              <div className="text-center mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-[#5e4933]">
                  Customize Your 12 Dice
                </span>
                <p className="text-[11px] text-[#785b3f] mt-0.5">
                  Select your two favorite colors (6 dice each)
                </p>
              </div>

              {/* Active Pair Preview */}
              <div className="flex items-center justify-center gap-4 mb-4 py-3 bg-white/80 rounded-2xl border border-[#ebdcb9] shadow-xs">
                <div
                  onClick={() => setActiveSlot(1)}
                  className={`flex flex-col items-center p-2 rounded-xl cursor-pointer transition-all ${
                    activeSlot === 1
                      ? 'ring-2 ring-[#1c6a35] bg-[#eefbf0] shadow-sm scale-105'
                      : 'hover:bg-black/5 opacity-80'
                  }`}
                >
                  <span className="text-[10px] font-black text-[#5e4933] mb-1">Color 1 (6 Dice)</span>
                  <div className="w-12 h-12">
                    <DieComponent color={diceColorA} value={6} />
                  </div>
                  <span className="text-[11px] font-black text-[#1c6a35] capitalize mt-1">
                    {diceColorA} {activeSlot === 1 ? '●' : ''}
                  </span>
                </div>

                <span className="text-lg font-black text-[#8c7456]">+</span>

                <div
                  onClick={() => setActiveSlot(2)}
                  className={`flex flex-col items-center p-2 rounded-xl cursor-pointer transition-all ${
                    activeSlot === 2
                      ? 'ring-2 ring-[#1c6a35] bg-[#eefbf0] shadow-sm scale-105'
                      : 'hover:bg-black/5 opacity-80'
                  }`}
                >
                  <span className="text-[10px] font-black text-[#5e4933] mb-1">Color 2 (6 Dice)</span>
                  <div className="w-12 h-12">
                    <DieComponent color={diceColorB} value={1} />
                  </div>
                  <span className="text-[11px] font-black text-[#1c6a35] capitalize mt-1">
                    {diceColorB} {activeSlot === 2 ? '●' : ''}
                  </span>
                </div>
              </div>

              <div className="text-[11px] font-bold text-[#6e533c] text-center mb-2">
                Tap a color to assign to <strong className="text-[#1c6a35]">Color {activeSlot}</strong>:
              </div>

              {/* Color Grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {ALL_DICE_COLORS.map(c => {
                  const isSelected =
                    (activeSlot === 1 && diceColorA === c.id) || (activeSlot === 2 && diceColorB === c.id);
                  const isOtherSlot =
                    (activeSlot === 1 && diceColorB === c.id) || (activeSlot === 2 && diceColorA === c.id);

                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectDiceColor(c.id)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'border-[#1c6a35] ring-2 ring-[#1c6a35] bg-[#eefbf0] shadow-sm'
                          : isOtherSlot
                          ? 'border-[#c9b877] bg-[#fbf7ee] opacity-75'
                          : 'border-[#d8c89f] bg-white hover:bg-[#faf6eb]'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-lg shadow-xs border border-black/20"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-[10px] font-black text-[#4a3622] truncate w-full text-center">
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="text-[10px] text-[#8c7456] text-center italic bg-white/50 p-2 rounded-xl border border-[#ebdcb9]">
                💡 Computer players strictly use blue and red dice.
              </div>
            </div>
          )}

          {/* TAB 3: BACKGROUNDS / THEMES */}
          {activeTab === 'backgrounds' && (
            <div className="flex flex-col">
              <div className="text-center mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-[#5e4933]">
                  Table Backgrounds
                </span>
                <p className="text-[11px] text-[#785b3f] mt-0.5">
                  Choose the surface theme for your gameplay
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {ALL_BACKGROUNDS.map(bg => {
                  const isEquipped = equippedBg === bg.id;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => handleSelectBg(bg.id)}
                      className={`relative p-2.5 rounded-2xl border-2 flex flex-col items-center text-left transition-all active:scale-97 cursor-pointer overflow-hidden shadow-xs ${
                        isEquipped
                          ? 'border-[#1c6a35] ring-2 ring-[#1c6a35] bg-[#eefbf0]'
                          : 'border-[#d8c89f] bg-white hover:border-[#a8986f]'
                      }`}
                    >
                      {/* Swatch */}
                      <div
                        className={`w-full h-16 rounded-xl mb-2 shadow-inner border border-black/20 ${bg.previewClass}`}
                      />
                      <div className="w-full flex items-center justify-between">
                        <span className="font-black text-xs text-[#3d2c1c] truncate">
                          {bg.name}
                        </span>
                        {isEquipped && (
                          <span className="bg-[#1c6a35] text-white p-0.5 rounded-full">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#785b3f] truncate w-full">
                        {bg.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: VOLUME & AUDIO */}
          {activeTab === 'volume' && (
            <div className="flex flex-col">
              <div className="text-center mb-4">
                <span className="text-xs font-black uppercase tracking-wider text-[#5e4933]">
                  Game Audio &amp; Sound Effects
                </span>
                <p className="text-[11px] text-[#785b3f] mt-0.5">
                  Adjust roll sounds, victory fanfares, and chimes
                </p>
              </div>

              {/* Volume Slider Card */}
              <div className="w-full bg-white/90 border border-[#ebdcb9] rounded-2xl p-4 shadow-xs mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMute}
                      className={`p-2 rounded-xl transition-all cursor-pointer ${
                        volPct > 0
                          ? 'bg-[#1c6a35]/15 text-[#1c6a35] hover:bg-[#1c6a35]/25'
                          : 'bg-[#e5352f]/15 text-[#e5352f]'
                      }`}
                      title={volPct > 0 ? 'Mute Audio' : 'Unmute Audio'}
                    >
                      {volPct > 0 ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>
                    <div>
                      <span className="text-xs font-black text-[#3d2c1c] block">
                        Master Volume
                      </span>
                      <span className="text-[11px] text-[#785b3f] font-mono">
                        {volPct === 0 ? 'Muted' : `${volPct}%`}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={toggleMute}
                    className="text-xs font-black text-[#1c6a35] hover:underline cursor-pointer"
                  >
                    {volPct > 0 ? 'Mute' : 'Restore'}
                  </button>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volPct}
                  onChange={e => handleVolumeChange(parseInt(e.target.value, 10))}
                  className="w-full accent-[#1c6a35] h-2 bg-[#ebdcb9] rounded-lg cursor-pointer"
                />
              </div>

              {/* Test Sound SFX Buttons */}
              <div className="w-full bg-white/90 border border-[#ebdcb9] rounded-2xl p-3 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#6d5138] block text-center mb-2">
                  Test Sound Effects
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => playSfx('s4')}
                    className="p-2 bg-[#fbf7ee] hover:bg-[#ede3c9] text-[#3d2c1c] font-black text-[11px] rounded-xl border border-[#d8c89f] active:scale-95 transition-all flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <span>🎲</span>
                    <span>Dice Roll</span>
                  </button>
                  <button
                    onClick={() => playSfx('add')}
                    className="p-2 bg-[#fbf7ee] hover:bg-[#ede3c9] text-[#3d2c1c] font-black text-[11px] rounded-xl border border-[#d8c89f] active:scale-95 transition-all flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <span>✨</span>
                    <span>Bonus Chime</span>
                  </button>
                  <button
                    onClick={() => playSfx('fanfare')}
                    className="p-2 bg-[#fbf7ee] hover:bg-[#ede3c9] text-[#3d2c1c] font-black text-[11px] rounded-xl border border-[#d8c89f] active:scale-95 transition-all flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <span>🎺</span>
                    <span>Fanfare</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ACCOUNT, FIREBASE & CLOUD FILES */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-3">
              {/* Profile Overview Card */}
              <div className="bg-white/90 border border-[#ebdcb9] rounded-2xl p-3.5 shadow-xs flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full border-2 border-[#f2c14e] flex items-center justify-center font-black text-sm text-white overflow-hidden bg-[#e58a1f] shrink-0"
                  style={{
                    backgroundColor: user.avatar.color,
                    backgroundImage: user.avatar.image ? `url(${user.avatar.image})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {!user.avatar.image && (user.name.slice(0, 2).toUpperCase() || 'P1')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-[#2d2217] truncate">
                      {user.name}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#1c6a35]/15 text-[#1c6a35]">
                      {user.provider || (user.isGuest ? 'Guest' : 'Member')}
                    </span>
                  </div>
                  <div className="text-xs text-[#785b3f] flex items-center gap-1.5 truncate mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-[#9c8a74] shrink-0" />
                    <span className="truncate">{user.email || 'guest@colorrun.local'}</span>
                  </div>
                  <div className="text-[10px] text-[#9c8a74] font-mono flex items-center gap-1 mt-0.5 truncate">
                    <Fingerprint className="w-3 h-3 shrink-0" />
                    <span className="truncate">UID: {user.uid}</span>
                  </div>
                </div>
              </div>

              {/* Phone Number for Friend Challenges */}
              <div className="bg-[#fcfaf5] border border-[#d8c89f] rounded-2xl p-3 shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#2f9a4f]/15 flex items-center justify-center text-[#1c6a35]">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#2e2316]">
                        Phone Number
                      </h4>
                      <p className="text-[10px] text-[#785b3f]">
                        For Friend Challenges &amp; Direct Match
                      </p>
                    </div>
                  </div>
                  {user.phoneNumber && (
                    <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Linked
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#9c8a74]" />
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#d8c89f] rounded-xl text-[#2e2316] font-bold placeholder-[#9c8a74] focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f]"
                  />
                </div>
                <p className="text-[10px] text-[#785b3f] leading-snug">
                  When other players challenge you using your phone number, you'll be automatically connected as friends without sending SMS texts.
                </p>
              </div>

              {/* Cloud Files & Storage Section */}
              <div className="bg-[#fcfaf5] border border-[#d8c89f] rounded-2xl p-3 shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#2f9a4f]/15 flex items-center justify-center text-[#1c6a35]">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#2e2316]">
                        Firebase Cloud Files
                      </h4>
                      <p className="text-[10px] text-[#785b3f]">
                        Upload, view, download &amp; delete files
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[#6d5138] leading-relaxed">
                  Your files and metadata are securely stored in your personal Firebase Firestore storage space.
                </p>

                {onOpenFiles && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenFiles();
                    }}
                    className="w-full py-2.5 px-3 bg-[#1c6a35] hover:bg-[#15542a] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>Open My Cloud File Manager</span>
                  </button>
                )}
              </div>

              {/* Security & Firestore Integration Card */}
              <div className="bg-[#f5fbf7] border border-[#b2e2c0] rounded-2xl p-3 flex items-start gap-2.5 text-xs text-[#1c6a35]">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">Firestore Security Active</span>
                  <span className="text-[10px] text-[#2c7744] leading-normal">
                    Database path: <code className="bg-white/80 px-1 py-0.5 rounded font-mono">/users/{user.uid}/files</code>.
                    Firestore security rules enforce that only your authenticated account can access this data.
                  </span>
                </div>
              </div>

              {/* Sign Out / Switch Account */}
              {onLogOut && (
                <button
                  onClick={() => {
                    onClose();
                    onLogOut();
                  }}
                  className="w-full py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 shadow-xs flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer mt-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Account</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#ede3c9] border-t border-[#ebdcb9] flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#dfceaa] hover:bg-[#d0bea0] text-[#42311f] font-black text-xs rounded-xl transition-all cursor-pointer active:scale-98"
          >
            Close
          </button>
          <button
            onClick={handleSaveAndClose}
            className="flex-1 py-2.5 bg-[#1c6a35] hover:bg-[#15542a] text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-98"
          >
            Save &amp; Apply
          </button>
        </div>
      </div>
    </div>
  );
};
