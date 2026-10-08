import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Check,
  Sparkles,
  User,
  Palette,
  Dices,
  LogOut,
  Mail,
  Fingerprint,
  Camera,
  Upload,
  Image as ImageIcon,
  Phone,
  Trophy,
  Award,
  Lock,
  BookOpen,
  Users,
  UserMinus,
  UserPlus,
  UserCheck,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { UserAccount, DiceColor, ShopSettings, Friend, FriendRequest } from '../types/game';
import { DEFAULT_AVATARS } from '../lib/storage';
import { DieComponent } from './DieComponent';
import { getSoundVolume, setSoundVolume, playSfx } from '../lib/audio';
import { registerUserPhoneNumber } from '../lib/referrals';
import {
  getLocalFriends,
  getFriendRequests,
  removeFriend,
  acceptFriendRequest,
  deleteFriendRequest,
} from '../lib/friends';
import {
  LEVEL_REWARDS,
  calculateLevelFromTotalXp,
  executePrestige,
  generateDefaultMissions,
  PRESET_NAME_COLORS,
  Mission,
} from '../lib/levelSystem';

interface ProfileModalProps {
  isOpen: boolean;
  user: UserAccount;
  shopSettings: ShopSettings;
  coins: number;
  friends?: Friend[];
  onFriendsChange?: (friends: Friend[]) => void;
  friendRequests?: FriendRequest[];
  onFriendRequestsChange?: (requests: FriendRequest[]) => void;
  onClose: () => void;
  onSaveUser: (updatedUser: UserAccount) => void;
  onUpdateShop: (updatedShop: ShopSettings) => void;
  onOpenFiles?: () => void;
  onLogOut?: () => void;
  onToast: (msg: string) => void;
  onOpenRules?: (tab?: 'rules' | 'levels') => void;
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
  friends,
  onFriendsChange,
  friendRequests,
  onFriendRequestsChange,
  onClose,
  onSaveUser,
  onUpdateShop,
  onOpenFiles,
  onLogOut,
  onToast,
  onOpenRules,
}) => {
  const [activeTab, setActiveTab] = useState<'volume' | 'dice' | 'backgrounds' | 'avatar' | 'account' | 'level'>('avatar');

  // User state
  const [name, setName] = useState(user.name);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [selectedColor, setSelectedColor] = useState(user.avatar.color || DEFAULT_AVATARS[0]);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(user.avatar.image);
  const [selectedNameColor, setSelectedNameColor] = useState<string>(user.nameColor || '');
  const [selectedTitle, setSelectedTitle] = useState<string>(user.title || '');
  const [selectedBanner, setSelectedBanner] = useState<string>(user.banner || '');
  const [missions, setMissions] = useState<Mission[]>(() =>
    user.missions && user.missions.length > 0 ? user.missions : generateDefaultMissions()
  );
  const [avatarSubTab, setAvatarSubTab] = useState<'presets' | 'upload' | 'initials'>(
    user.avatar.image ? (user.avatar.image.startsWith('data:') ? 'upload' : 'presets') : 'initials'
  );
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Friends & Requests state
  const [localFriends, setLocalFriends] = useState<Friend[]>(() =>
    friends && friends.length > 0 ? friends : getLocalFriends(user.uid)
  );
  const [localRequests, setLocalRequests] = useState<FriendRequest[]>(() =>
    friendRequests || getFriendRequests(user.uid)
  );
  const wasOpenRef = useRef(false);
  const prevUidRef = useRef(user.uid);

  // Sync profile form fields only when the modal opens or the signed-in user changes
  useEffect(() => {
    if (isOpen && (!wasOpenRef.current || prevUidRef.current !== user.uid)) {
      wasOpenRef.current = true;
      prevUidRef.current = user.uid;
      setName(user.name);
      setPhoneNumber(user.phoneNumber || '');
      setSelectedColor(user.avatar.color || DEFAULT_AVATARS[0]);
      setSelectedImage(user.avatar.image || undefined);
      setSelectedNameColor(user.nameColor || '');
      setSelectedTitle(user.title || '');
      setSelectedBanner(user.banner || '');
      if (user.missions && user.missions.length > 0) {
        setMissions(user.missions);
      }
      setDiceColorA(user.diceColors?.[0] || shopSettings.equippedColors[0] || 'blue');
      setDiceColorB(user.diceColors?.[1] || shopSettings.equippedColors[1] || 'red');
      setAvatarSubTab(
        user.avatar.image
          ? (user.avatar.image.startsWith('data:') ? 'upload' : 'presets')
          : 'initials'
      );
      setEquippedBg(shopSettings.equippedBg || 'bg-wood');
      setVolPct(Math.round((getSoundVolume() / 0.7) * 100));
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, user, shopSettings]);

  // Keep friends and friend requests synced independently so live presence heartbeats never reset form edits
  useEffect(() => {
    if (isOpen) {
      const currentFl = friends && friends.length > 0 ? friends : getLocalFriends(user.uid);
      setLocalFriends(currentFl);
      const currentRq = friendRequests || getFriendRequests(user.uid);
      setLocalRequests(currentRq);
    }
  }, [isOpen, user.uid, friends, friendRequests]);

  const handleRemoveFriendInAccount = async (friendId: string, friendName: string) => {
    const updated = await removeFriend(user.uid, friendId, user.name);
    setLocalFriends(updated);
    onFriendsChange?.(updated);
    onToast(`Removed ${friendName} from friends`);
    playSfx('add');
  };

  const handleAcceptRequestInAccount = async (req: FriendRequest) => {
    const res = await acceptFriendRequest(user.uid, user.name, req);
    setLocalFriends(res.friends);
    setLocalRequests(res.requests);
    onFriendsChange?.(res.friends);
    onFriendRequestsChange?.(res.requests);
    onToast(`✨ Added ${req.fromName} as a friend!`);
    playSfx('fanfare');
  };

  const handleDeleteRequestInAccount = async (req: FriendRequest) => {
    const remaining = await deleteFriendRequest(user.uid, req.id);
    setLocalRequests(remaining);
    onFriendRequestsChange?.(remaining);
    onToast(`Deleted friend request from ${req.fromName}`);
    playSfx('add');
  };

  const sortedFriends = [...localFriends].sort((a, b) => {
    const aAccepted = a.accepted !== false && !a.removedByThem;
    const bAccepted = b.accepted !== false && !b.removedByThem;
    if (aAccepted !== bAccepted) return aAccepted ? -1 : 1;

    const aOnline = a.status === 'online';
    const bOnline = b.status === 'online';
    if (aOnline !== bOnline) return aOnline ? -1 : 1;

    return a.name.localeCompare(b.name);
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onToast('Please upload an image file (PNG, JPG, or WEBP)');
      return;
    }

    const applyUploadedAvatar = (finalImgUrl: string) => {
      setSelectedImage(finalImgUrl);
      setAvatarSubTab('upload');
      const trimmed = name.trim() || user.name || 'Player';
      const updatedUser: UserAccount = {
        ...user,
        name: trimmed,
        avatar: {
          color: selectedColor,
          name: trimmed.slice(0, 2).toUpperCase(),
          image: finalImgUrl,
        },
      };
      onSaveUser(updatedUser);
      playSfx('add');
      onToast('Photo avatar uploaded & saved!');
    };

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
          applyUploadedAvatar(compressed);
        } else {
          applyUploadedAvatar(dataUrl);
        }
      };
      img.onerror = () => {
        applyUploadedAvatar(dataUrl);
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

  const handlePrestigeClick = () => {
    if ((user.level || 1) < 50) return;
    const prestigedState = executePrestige({
      level: user.level || 1,
      totalXp: user.totalXp || 0,
      xp: user.xp || 0,
      prestige: user.prestige || 0,
      unlockedRewards: user.unlockedRewards || [],
      unlockedEmotes: user.unlockedEmotes || [],
      unlockedTitles: user.unlockedTitles || [],
      unlockedBanners: user.unlockedBanners || [],
      rankedUnlocked: true,
      missions,
    });
    const updatedUser: UserAccount = {
      ...user,
      ...prestigedState,
    };
    onSaveUser(updatedUser);
    onToast(`⭐ Congratulations! You activated Prestige ${prestigedState.prestige}! Permanent badge and border unlocked.`);
    playSfx('fanfare');
  };

  const handleClaimMission = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission || !mission.completed || mission.claimed) return;
    const updatedMissions = missions.map(m => m.id === missionId ? { ...m, claimed: true } : m);
    setMissions(updatedMissions);

    const earnedXp = mission.rewardXp;
    const currentTotalXp = user.totalXp || 0;
    const newTotalXp = currentTotalXp + earnedXp;
    const newCalc = calculateLevelFromTotalXp(newTotalXp);

    const updatedUser: UserAccount = {
      ...user,
      totalXp: newTotalXp,
      xp: newCalc.xpInLevel,
      level: newCalc.level,
      missions: updatedMissions,
      rankedUnlocked: newCalc.level >= 10 || user.rankedUnlocked,
    };
    onSaveUser(updatedUser);
    playSfx('add');
    onToast(`🎯 Claimed ${earnedXp} XP from "${mission.title}"!`);
  };

  const handleSaveAndClose = () => {
    const trimmed = name.trim() || 'Player';
    const cleanPhone = phoneNumber.trim();
    const finalImage = avatarSubTab === 'initials' ? undefined : selectedImage;
    const updatedUser: UserAccount = {
      ...user,
      name: trimmed,
      phoneNumber: cleanPhone || undefined,
      avatar: {
        color: selectedColor,
        name: trimmed.slice(0, 2).toUpperCase(),
        image: finalImage,
      },
      diceColors: [diceColorA, diceColorB],
      nameColor: selectedNameColor || undefined,
      title: selectedTitle || undefined,
      banner: selectedBanner || undefined,
      missions,
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

  if (!isOpen) return null;

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
        <div className="grid grid-cols-6 gap-1 p-1 sm:p-1.5 bg-[#ede3c9] border-b border-[#ebdcb9]">
          <button
            onClick={() => setActiveTab('avatar')}
            className={`py-1.5 px-0.5 text-[10px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
              activeTab === 'avatar'
                ? 'bg-[#1c6a35] text-white shadow-sm scale-102'
                : 'text-[#5c442d] hover:bg-black/5'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Avatar</span>
          </button>

          <button
            onClick={() => setActiveTab('level')}
            className={`py-1.5 px-0.5 text-[10px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
              activeTab === 'level'
                ? 'bg-[#1c6a35] text-white shadow-sm scale-102'
                : 'text-[#5c442d] hover:bg-black/5'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Lv.{user.level || 1}</span>
          </button>

          <button
            onClick={() => setActiveTab('dice')}
            className={`py-1.5 px-0.5 text-[10px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
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
            className={`py-1.5 px-0.5 text-[10px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
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
            className={`py-1.5 px-0.5 text-[10px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
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
            className={`py-1.5 px-0.5 text-[10px] sm:text-xs font-black rounded-xl flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
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
                  }}
                >
                  {selectedImage && avatarSubTab !== 'initials' ? (
                    <img
                      src={selectedImage}
                      alt={name || 'Avatar'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    name.slice(0, 2).toUpperCase() || 'P1'
                  )}
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
                      onClick={() => {
                        setSelectedColor(color);
                        setSelectedImage(undefined);
                      }}
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

              {/* Custom Player Name Color (Unlocked at Level 5) */}
              <div className="w-full mt-4 p-3 bg-white/70 rounded-2xl border border-[#ebdcb9]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-[#8c5700]" />
                    <span className="text-xs font-black uppercase text-[#4a3622]">
                      Custom Name Color
                    </span>
                  </div>
                  {(user.level || 1) >= 5 ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 font-extrabold text-[10px]">
                      UNLOCKED (Lv. 5)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 font-bold text-[10px] flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Unlocks at Lv. 5</span>
                    </span>
                  )}
                </div>

                {(user.level || 1) >= 5 ? (
                  <div>
                    <p className="text-[11px] text-[#6d5138] mb-2 font-medium">
                      Select your custom player name color displayed in matches, the top user bar, and leaderboards:
                    </p>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {PRESET_NAME_COLORS.map(c => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setSelectedNameColor(c.hex)}
                          className={`py-1.5 px-2 rounded-xl text-[10px] font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            selectedNameColor === c.hex
                              ? 'border-black ring-2 ring-black/40 scale-105 shadow-sm'
                              : 'border-black/10 hover:border-black/30'
                          }`}
                          style={{ backgroundColor: c.hex, color: '#1a1a1a' }}
                        >
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedNameColor('')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${
                          !selectedNameColor ? 'bg-stone-800 text-white' : 'bg-white text-stone-700'
                        }`}
                      >
                        Default White
                      </button>
                      <span className="text-[11px] font-bold text-[#6d5138]">Preview:</span>
                      <span
                        className="font-black text-sm uppercase px-2 py-0.5 rounded bg-black/80 shadow-xs"
                        style={{ color: selectedNameColor || '#ffffff' }}
                      >
                        {name || 'Player'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#8c745e] leading-snug">
                    Reach <strong>Level 5</strong> to unlock customizable player name colors across the entire game!
                  </p>
                )}
              </div>

              {/* Profile Titles & Banners (Unlocked at Level 25) */}
              <div className="w-full mt-3 p-3 bg-white/70 rounded-2xl border border-[#ebdcb9]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#8c5700]" />
                    <span className="text-xs font-black uppercase text-[#4a3622]">
                      Profile Title &amp; Banner
                    </span>
                  </div>
                  {(user.level || 1) >= 25 ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 font-extrabold text-[10px]">
                      UNLOCKED (Lv. 25)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 font-bold text-[10px] flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Unlocks at Lv. 25</span>
                    </span>
                  )}
                </div>

                {(user.level || 1) >= 25 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#6d5138]">
                      Choose your honor title to display under your name:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Color Champion', 'High Roller', 'Dice Maestro', ...(user.prestige ? [`Prestige ${user.prestige} Legend`] : [])].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTitle(t)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            selectedTitle === t
                              ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-xs'
                              : 'bg-white text-stone-700 hover:bg-stone-50 border-stone-300'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#8c745e] leading-snug">
                    Reach <strong>Level 25</strong> to unlock exclusive honor titles and custom profile header banners!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB: LEVEL & PROGRESSION */}
          {activeTab === 'level' && (
            <div className="flex flex-col gap-3">
              {/* Level & XP Overview Card */}
              {(() => {
                const info = calculateLevelFromTotalXp(user.totalXp || 0);
                return (
                  <div className="w-full bg-gradient-to-br from-[#f8f1df] to-[#ebdcb9] border-2 border-[#d3be89] rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-md border-2 ${
                          user.prestige && user.prestige > 0
                            ? 'bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 text-stone-950 border-yellow-200 animate-pulse'
                            : 'bg-emerald-600 text-white border-emerald-400'
                        }`}>
                          {user.prestige && user.prestige > 0 ? `⭐${info.level}` : info.level}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-black text-base text-[#2e1d0f]">
                              Level {info.level}
                            </h3>
                            {user.prestige && user.prestige > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 font-black text-[10px] border border-amber-400">
                                Prestige {user.prestige}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#6e533c] font-medium">
                            {user.title || 'Color Roller'} • Total XP: {(user.totalXp || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {info.level >= 50 && (
                        <button
                          onClick={handlePrestigeClick}
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-stone-950 font-black text-xs rounded-xl shadow-md border border-yellow-200 transition-transform active:scale-95 cursor-pointer animate-bounce-subtle"
                        >
                          ⭐ PRESTIGE NOW!
                        </button>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full mb-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#5c4228] mb-1">
                        <span>XP Progress</span>
                        <span>
                          {info.level >= 50
                            ? 'Max Level (Prestige Access Ready)'
                            : `${info.xpInLevel} / ${info.xpNeededForNext} XP (${info.progressPercent}%)`}
                        </span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-[#ded0b2] overflow-hidden p-0.5 border border-[#c4b38d]">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-400 rounded-full transition-all duration-700"
                          style={{ width: `${info.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {onOpenRules && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenRules('levels');
                        }}
                        className="mt-2.5 w-full py-1.5 px-3 bg-[#1c6a35]/10 hover:bg-[#1c6a35]/15 text-[#1c6a35] font-black text-xs rounded-xl border border-[#1c6a35]/25 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>View XP Earning Guide &amp; Rules</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Missions Section */}
              <div className="w-full bg-white/80 border border-[#ebdcb9] rounded-2xl p-3 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🎯</span>
                    <h4 className="font-black text-xs uppercase text-[#382717] tracking-wider">
                      Active Missions
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-[#8c745e]">
                    Earn 50 to 200 XP
                  </span>
                </div>

                <div className="space-y-2">
                  {missions.map(mission => (
                    <div
                      key={mission.id}
                      className="p-2.5 rounded-xl bg-[#faf6eb] border border-[#e4d6b6] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase ${
                            mission.type === 'daily'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {mission.type}
                          </span>
                          <span className="font-black text-xs text-[#2e1d0f] truncate">
                            {mission.title}
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[9px]">
                            +{mission.rewardXp} XP
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6d5138] leading-tight">
                          {mission.description}
                        </p>
                      </div>

                      {mission.claimed ? (
                        <span className="px-2 py-1 rounded-lg bg-stone-200 text-stone-600 font-bold text-[10px] shrink-0 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Claimed</span>
                        </span>
                      ) : mission.completed ? (
                        <button
                          onClick={() => handleClaimMission(mission.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] shadow-xs shrink-0 cursor-pointer active:scale-95"
                        >
                          Claim XP
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-[#8c745e] shrink-0 font-mono">
                          {mission.current}/{mission.target}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Level Rewards Road (Levels 2 to 50) */}
              <div className="w-full bg-white/80 border border-[#ebdcb9] rounded-2xl p-3 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <h4 className="font-black text-xs uppercase text-[#382717] tracking-wider">
                      Road to Level 50 Rewards
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-[#8c745e]">
                    Current: Level {user.level || 1}
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {LEVEL_REWARDS.map(reward => {
                    const isUnlocked = (user.level || 1) >= reward.level;
                    return (
                      <div
                        key={reward.level}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                          isUnlocked
                            ? 'bg-[#f0fbf3] border-emerald-300 text-[#144d27]'
                            : 'bg-[#faf6eb] border-[#e4d6b6] text-stone-600 opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                              isUnlocked
                                ? 'bg-emerald-600 text-white'
                                : 'bg-stone-300 text-stone-600'
                            }`}
                          >
                            Lv.{reward.level}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{reward.icon}</span>
                              <span className="font-black text-xs truncate">
                                {reward.title}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#6e533c] leading-tight truncate">
                              {reward.description}
                            </p>
                          </div>
                        </div>

                        {isUnlocked ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 font-extrabold text-[9px] shrink-0 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>UNLOCKED</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 font-bold text-[9px] shrink-0 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Lv. {reward.level}</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
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

              {/* Friends & Requests Section (Under Phone Number) */}
              <div className="bg-[#fcfaf5] border border-[#d8c89f] rounded-2xl p-3 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#ebdcb9] pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#2f9a4f]/15 flex items-center justify-center text-[#1c6a35]">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[#2e2316]">
                        Friends &amp; Requests
                      </h4>
                      <p className="text-[10px] text-[#785b3f]">
                        Manage active friends and incoming requests
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#f3ecda] text-[#785b3f] border border-[#d8c89f]">
                    {sortedFriends.filter(f => f.accepted !== false).length} Active
                  </span>
                </div>

                {/* Accepted Friends List (Sorted to the top) */}
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-black text-[#4a3b2c] flex items-center justify-between">
                    <span>Active Friends</span>
                    <span className="text-[10px] text-[#8e7660] font-normal">
                      {sortedFriends.filter(f => f.accepted !== false).length} accepted
                    </span>
                  </div>

                  {sortedFriends.filter(f => f.accepted !== false).length === 0 ? (
                    <div className="text-[11px] text-[#8e7660] italic py-2 text-center bg-white/60 rounded-xl border border-[#d8c89f]/60">
                      No active friends yet. Add friends during matches!
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                      {sortedFriends
                        .filter(f => f.accepted !== false)
                        .map(friend => {
                          const isOnline = friend.status === 'online' && !friend.removedByThem;
                          return (
                            <div
                              key={friend.id}
                              className="flex items-center justify-between p-2 bg-white rounded-xl border border-[#e4d6b6] shadow-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="relative">
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 border border-black/10"
                                    style={{
                                      backgroundColor: friend.color || '#2f9a4f',
                                      backgroundImage: friend.image ? `url(${friend.image})` : undefined,
                                      backgroundSize: 'cover',
                                    }}
                                  >
                                    {!friend.image && friend.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${
                                      isOnline ? 'bg-emerald-500' : 'bg-stone-400'
                                    }`}
                                  />
                                </div>
                                <div className="min-w-0 flex flex-col">
                                  <span className="text-xs font-black text-[#2e2316] truncate">
                                    {friend.name}
                                  </span>
                                  <span className="text-[9px] font-bold text-[#8e7660] flex items-center gap-1">
                                    <span
                                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                                        isOnline ? 'bg-emerald-500' : 'bg-stone-400'
                                      }`}
                                    />
                                    {isOnline ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              </div>

                              {/* Remove Friend Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveFriendInAccount(friend.id, friend.name)}
                                className="py-1 px-2 text-[10px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                                title="Remove as friend"
                              >
                                <UserMinus className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Friend Requests List (Under active friends) */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-[#ebdcb9]">
                  <div className="text-[11px] font-black text-[#4a3b2c] flex items-center justify-between">
                    <span>Friend Requests</span>
                    {localRequests.filter(r => r.status === 'pending' || r.status === 'dismissed').length > 0 && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        {localRequests.filter(r => r.status === 'pending' || r.status === 'dismissed').length} Pending
                      </span>
                    )}
                  </div>

                  {localRequests.filter(r => r.status === 'pending' || r.status === 'dismissed').length === 0 ? (
                    <div className="text-[11px] text-[#8e7660] italic py-2 text-center bg-white/60 rounded-xl border border-[#d8c89f]/60">
                      No pending friend requests
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                      {localRequests
                        .filter(r => r.status === 'pending' || r.status === 'dismissed')
                        .map(req => (
                          <div
                            key={req.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-2 bg-amber-50/70 rounded-xl border border-amber-200/80 gap-2 shadow-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 border border-black/10"
                                style={{
                                  backgroundColor: req.fromColor || '#e58a1f',
                                  backgroundImage: req.fromImage ? `url(${req.fromImage})` : undefined,
                                  backgroundSize: 'cover',
                                }}
                              >
                                {!req.fromImage && req.fromName.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex flex-col">
                                <span className="text-xs font-black text-[#2e2316] truncate">
                                  {req.fromName}
                                </span>
                                <span className="text-[9px] text-[#8e7660]">
                                  sent you a friend request
                                </span>
                              </div>
                            </div>

                            {/* Two buttons: Add Friend and Delete */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => handleAcceptRequestInAccount(req)}
                                className="py-1 px-2.5 bg-[#2f9a4f] hover:bg-[#258241] text-white font-black text-[10px] rounded-lg shadow-2xs flex items-center gap-1 transition-transform active:scale-95 cursor-pointer"
                              >
                                <UserPlus className="w-3 h-3" />
                                <span>Add Friend</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteRequestInAccount(req)}
                                className="py-1 px-2 text-[10px] font-bold text-red-700 bg-red-100/70 hover:bg-red-200 border border-red-300 rounded-lg flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
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
