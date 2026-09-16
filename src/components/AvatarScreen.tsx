import React, { useState, useRef } from 'react';
import { Camera, Upload, Check } from 'lucide-react';
import { UserAccount, DiceColor } from '../types/game';
import { DEFAULT_AVATARS } from '../lib/storage';
import { DieComponent } from './DieComponent';

interface AvatarScreenProps {
  user: UserAccount;
  onSave: (updatedUser: UserAccount) => void;
  onBack: () => void;
}

const ALL_DICE_COLORS: Array<{ id: DiceColor; name: string; hex: string }> = [
  { id: 'blue', name: 'Blue', hex: '#1f7fd6' },
  { id: 'red', name: 'Red', hex: '#e5352f' },
  { id: 'green', name: 'Green', hex: '#2f9a4f' },
  { id: 'purple', name: 'Purple', hex: '#8e44c9' },
  { id: 'black', name: 'Black', hex: '#222222' },
  { id: 'lblue', name: 'Sky Blue', hex: '#45aaf2' },
  { id: 'orange', name: 'Orange', hex: '#fa8231' },
  { id: 'pink', name: 'Pink', hex: '#fd79a8' },
];

export const AvatarScreen: React.FC<AvatarScreenProps> = ({
  user,
  onSave,
  onBack,
}) => {
  const [name, setName] = useState(user.name);
  const [selectedColor, setSelectedColor] = useState(user.avatar.color);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(user.avatar.image);
  const [tab, setTab] = useState<'presets' | 'upload' | 'initials' | 'dice'>(
    user.avatar.image?.startsWith('data:') ? 'upload' : 'presets'
  );
  const [diceColorA, setDiceColorA] = useState<DiceColor>(user.diceColors?.[0] || 'blue');
  const [diceColorB, setDiceColorB] = useState<DiceColor>(user.diceColors?.[1] || 'red');
  const [activeSlot, setActiveSlot] = useState<1 | 2>(1);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
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
          setSelectedImage(canvas.toDataURL('image/jpeg', 0.85));
          setTab('upload');
        } else {
          setSelectedImage(dataUrl);
          setTab('upload');
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSelectDiceColor = (c: DiceColor) => {
    if (activeSlot === 1) {
      setDiceColorA(c);
      if (c === diceColorB) {
        // Swap or pick another
        const fallback = ALL_DICE_COLORS.find(item => item.id !== c)?.id || 'red';
        setDiceColorB(fallback);
      }
      setActiveSlot(2);
    } else {
      setDiceColorB(c);
      if (c === diceColorA) {
        const fallback = ALL_DICE_COLORS.find(item => item.id !== c)?.id || 'blue';
        setDiceColorA(fallback);
      }
      setActiveSlot(1);
    }
  };

  const handleSave = () => {
    onSave({
      ...user,
      name: name.trim() || 'Player',
      avatar: {
        color: selectedColor,
        name: (name.trim() || 'P1').slice(0, 2).toUpperCase(),
        image: tab !== 'initials' ? selectedImage : undefined,
      },
      diceColors: [diceColorA, diceColorB],
    });
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 flex flex-col items-center select-none">
      <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-3xl p-5 sm:p-6 shadow-2xl">
        <h2 className="text-xl font-black text-[#1c6a35] text-center mb-1">
          Player Profile
        </h2>
        <p className="text-xs text-[#6e533c] text-center mb-4 font-medium">
          Customize your avatar, name, and dice colors
        </p>

        {/* Current Preview */}
        <div className="flex flex-col items-center mb-4">
          <div
            className="w-20 h-20 rounded-full border-4 border-[#e58a1f] shadow-lg flex items-center justify-center text-2xl font-black text-white mb-2 overflow-hidden"
            style={{
              backgroundColor: selectedColor,
              backgroundImage: selectedImage && tab !== 'initials' ? `url(${selectedImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {(!selectedImage || tab === 'initials') && (name.slice(0, 2).toUpperCase() || 'P1')}
          </div>
          <input
            type="text"
            value={name}
            maxLength={14}
            onChange={e => setName(e.target.value)}
            placeholder="Player Name"
            className="text-center font-bold text-base px-3 py-1 bg-white border border-[#d8c89f] rounded-lg text-[#2e2316] focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f]"
          />
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-[#ede3c9] p-1 mb-4 gap-1">
          <button
            onClick={() => setTab('presets')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${tab === 'presets' ? 'bg-[#2f9a4f] text-white shadow-xs' : 'text-[#6e553a]'}`}
          >
            Presets
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${tab === 'upload' ? 'bg-[#2f9a4f] text-white shadow-xs' : 'text-[#6e553a]'}`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
          <button
            onClick={() => setTab('initials')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${tab === 'initials' ? 'bg-[#2f9a4f] text-white shadow-xs' : 'text-[#6e553a]'}`}
          >
            Initials
          </button>
          <button
            onClick={() => setTab('dice')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${tab === 'dice' ? 'bg-[#2f9a4f] text-white shadow-xs' : 'text-[#6e553a]'}`}
          >
            🎲 Dice
          </button>
        </div>

        {/* Tab contents */}
        {tab === 'upload' ? (
          <div className="w-full p-4 mb-4 bg-white/90 rounded-2xl border border-[#ebdcb9] flex flex-col items-center text-center">
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
                  Custom photo loaded!
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
                      setTab('presets');
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
                className="w-full border-2 border-dashed border-[#cbb88a] hover:border-[#1c6a35] hover:bg-[#f6fcf8] rounded-2xl p-4 flex flex-col items-center gap-2 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-[#f2e7cd] group-hover:bg-[#d8f2de] flex items-center justify-center text-[#6e553a] group-hover:text-[#1c6a35] transition-colors">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs font-black text-[#382b1d] group-hover:text-[#1c6a35]">
                  Choose Avatar Photo
                </span>
                <span className="text-[11px] text-[#7d6852] max-w-xs leading-relaxed">
                  Upload any photo from your device. It will automatically be formatted into your avatar.
                </span>
                <button
                  type="button"
                  className="mt-1 px-4 py-1.5 bg-[#1c6a35] text-white text-xs font-bold rounded-xl shadow-xs group-hover:bg-[#227e3f]"
                >
                  Select Photo
                </button>
              </div>
            )}
          </div>
        ) : tab === 'presets' ? (
          <div className="grid grid-cols-5 gap-2 max-h-56 overflow-y-auto p-1 scrollbar-none mb-4">
            {Array.from({ length: 45 }).map((_, idx) => {
              const imgPath = `/assets/avatars/avatar_${idx + 1}.png`;
              const isSelected = selectedImage === imgPath;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(imgPath)}
                  className={`aspect-square rounded-full overflow-hidden border-2 transition-transform active:scale-90 ${isSelected ? 'border-[#2f9a4f] ring-2 ring-[#2f9a4f] scale-105' : 'border-[#d8c89f] hover:border-[#a8986f]'}`}
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
        ) : tab === 'initials' ? (
          <div className="grid grid-cols-4 gap-3 mb-4 p-2">
            {DEFAULT_AVATARS.map(color => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`h-12 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm transition-transform active:scale-95 ${selectedColor === color ? 'ring-3 ring-[#2f9a4f] scale-105' : ''}`}
                style={{ backgroundColor: color }}
              >
                {name.slice(0, 2).toUpperCase() || 'P1'}
              </button>
            ))}
          </div>
        ) : (
          /* Dice Colors tab */
          <div className="flex flex-col mb-4 bg-white/90 border border-[#ebdcb9] rounded-2xl p-3 shadow-xs">
            <div className="text-xs font-extrabold text-[#5e4933] mb-2 text-center uppercase tracking-wide">
              Your In-Game Dice Colors (12 Total)
            </div>

            {/* Active pair preview */}
            <div className="flex items-center justify-center gap-4 mb-3 py-2 bg-[#faf6eb] rounded-xl border border-[#ebdcb9]">
              <div
                onClick={() => setActiveSlot(1)}
                className={`flex flex-col items-center p-2 rounded-xl cursor-pointer transition-all ${activeSlot === 1 ? 'ring-2 ring-[#2f9a4f] bg-white shadow-sm scale-105' : 'opacity-85'}`}
              >
                <span className="text-[10px] font-black text-[#5e4933] mb-1">Color 1 (6 Dice)</span>
                <div className="w-12 h-12">
                  <DieComponent color={diceColorA} value={6} />
                </div>
                <span className="text-[11px] font-bold text-[#2f9a4f] capitalize mt-1">
                  {diceColorA} {activeSlot === 1 ? '●' : ''}
                </span>
              </div>

              <span className="text-sm font-black text-[#8c7456]">+</span>

              <div
                onClick={() => setActiveSlot(2)}
                className={`flex flex-col items-center p-2 rounded-xl cursor-pointer transition-all ${activeSlot === 2 ? 'ring-2 ring-[#2f9a4f] bg-white shadow-sm scale-105' : 'opacity-85'}`}
              >
                <span className="text-[10px] font-black text-[#5e4933] mb-1">Color 2 (6 Dice)</span>
                <div className="w-12 h-12">
                  <DieComponent color={diceColorB} value={1} />
                </div>
                <span className="text-[11px] font-bold text-[#2f9a4f] capitalize mt-1">
                  {diceColorB} {activeSlot === 2 ? '●' : ''}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-[#6e533c] text-center mb-2 font-medium">
              Tap a color below to assign to <strong className="text-[#1c6a35]">Color {activeSlot}</strong>:
            </div>

            {/* Color palette */}
            <div className="grid grid-cols-4 gap-2">
              {ALL_DICE_COLORS.map(c => {
                const isSelected = (activeSlot === 1 && diceColorA === c.id) || (activeSlot === 2 && diceColorB === c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectDiceColor(c.id)}
                    className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all active:scale-95 ${
                      isSelected
                        ? 'border-[#2f9a4f] ring-2 ring-[#2f9a4f] bg-[#eefbf0]'
                        : 'border-[#d8c89f] bg-white hover:bg-[#faf6eb]'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-md shadow-xs border border-black/20"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="text-[10px] font-bold text-[#4a3622] truncate w-full text-center">
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-[#8c7456] text-center mt-2 italic">
              Note: Computer players always use red and blue dice.
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button
            onClick={onBack}
            className="flex-1 py-2.5 bg-[#ebdcb9] hover:bg-[#dfceaa] text-[#42311f] font-bold text-sm rounded-xl transition-transform active:scale-98"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-bold text-sm rounded-xl shadow-md transition-transform active:scale-98"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
};
