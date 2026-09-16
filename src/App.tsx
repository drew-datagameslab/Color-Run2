import React, { useState, useEffect } from 'react';
import { GameSettings, PlayerUnit, ShopSettings, UserAccount, Friend, DiceColor } from './types/game';
import {
  getInitialUser,
  saveUser,
  getUserCoins,
  addCoins,
  getShopSettings,
  saveShopSettings,
  redeemHomeGameCode,
  setAdFree,
  hasClaimedDailyBonus,
  markDailyBonusClaimed,
} from './lib/storage';
import { getLocalFriends, syncFriendsFromFirestore, removeFriend } from './lib/friends';
import { initAudio, unlockAudio } from './lib/audio';
import { Header } from './components/Header';
import { SignInScreen } from './components/SignInScreen';
import { AvatarScreen } from './components/AvatarScreen';
import { MainMenuScreen } from './components/MainMenuScreen';
import { ModeSelectScreen } from './components/ModeSelectScreen';
import { ChallengeFriendModal } from './components/ChallengeFriendModal';
import { PickGameScreen } from './components/PickGameScreen';
import { PlayScreen } from './components/PlayScreen';
import { WinnerScreen } from './components/WinnerScreen';
import { ShopScreen } from './components/ShopScreen';
import { ScoreboardScreen } from './components/ScoreboardScreen';
import { RulesModal } from './components/RulesModal';
import { StandingsSheet } from './components/StandingsSheet';
import { StripAd } from './components/StripAd';
import { FullScreenAd } from './components/FullScreenAd';
import { RedeemCodeModal } from './components/RedeemCodeModal';
import { ProfileModal } from './components/ProfileModal';
import { MenuModal } from './components/MenuModal';
import { UserFilesModal } from './components/UserFilesModal';
import { DailyBonusOverlay } from './components/DailyBonusOverlay';
import { subscribeToAuth, logOut, syncUserProfileToFirestore } from './lib/firebase';

export default function App() {
  const [user, setUser] = useState<UserAccount>(() => getInitialUser());
  const [coins, setCoins] = useState<number>(() => getUserCoins(user.uid));
  const [shopSettings, setShopSettings] = useState<ShopSettings>(() => getShopSettings());
  const [screen, setScreen] = useState<
    'signin' | 'avatar' | 'mainmenu' | 'modeselect' | 'pickgame' | 'play' | 'winner' | 'shop' | 'scoreboard'
  >('signin');

  const [gameMode, setGameMode] = useState<'online' | 'cpu' | 'pass_and_play' | 'challenge' | 'challenge_friend'>('online');
  const [friends, setFriends] = useState<Friend[]>(() => getLocalFriends(user.uid));
  const [isChallengeFriendModalOpen, setIsChallengeFriendModalOpen] = useState(false);
  const [selectedChallengeFriend, setSelectedChallengeFriend] = useState<Friend | null>(null);
  const [currentGameSettings, setCurrentGameSettings] = useState<GameSettings | null>(null);
  const [pendingGameSettings, setPendingGameSettings] = useState<GameSettings | null>(null);
  const [isFullScreenAdActive, setIsFullScreenAdActive] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);

  const [gameWinner, setGameWinner] = useState<PlayerUnit | null>(null);
  const [finalUnits, setFinalUnits] = useState<PlayerUnit[]>([]);

  // Modals
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isStandingsOpen, setIsStandingsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isDailyBonusOpen, setIsDailyBonusOpen] = useState(false);
  const [toastNotice, setToastNotice] = useState('');

  const triggerToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(''), 2500);
  };

  // Check Daily Gift Dice Roll Overlay when player opens the app for first time each day
  useEffect(() => {
    if (screen !== 'signin' && user.uid) {
      if (!hasClaimedDailyBonus(user.uid)) {
        const timer = setTimeout(() => {
          setIsDailyBonusOpen(true);
        }, 700);
        return () => clearTimeout(timer);
      }
    }
  }, [screen, user.uid]);

  const handleClaimDailyBonus = (wonCoins: number) => {
    markDailyBonusClaimed(user.uid);
    handleUpdateCoins(wonCoins);
    triggerToast(`🎉 +${wonCoins} Daily Bonus Coins claimed!`);
  };

  // Subscribe to Firebase Auth changes
  useEffect(() => {
    const unsubscribe = subscribeToAuth(authedUser => {
      if (authedUser) {
        setUser(authedUser);
        saveUser(authedUser);
        const storedCoins = getUserCoins(authedUser.uid);
        setCoins(storedCoins);
        setScreen(prev => (prev === 'signin' ? 'mainmenu' : prev));
        syncFriendsFromFirestore(authedUser.uid).then(f => setFriends(f));
      }
    });
    return () => unsubscribe();
  }, []);

  // Synchronize friends when entering mode select screen
  useEffect(() => {
    if (screen === 'modeselect' && user.uid) {
      setFriends(getLocalFriends(user.uid));
    }
  }, [screen, user.uid]);

  // Pre-load and unlock audio
  useEffect(() => {
    initAudio();
    const handleFirstTouch = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', handleFirstTouch);
      window.removeEventListener('keydown', handleFirstTouch);
    };
    window.addEventListener('pointerdown', handleFirstTouch);
    window.addEventListener('keydown', handleFirstTouch);
    return () => {
      window.removeEventListener('pointerdown', handleFirstTouch);
      window.removeEventListener('keydown', handleFirstTouch);
    };
  }, []);

  const handleUpdateCoins = (delta: number) => {
    const updated = addCoins(user.uid, delta);
    setCoins(updated);
    if (!user.isGuest) {
      syncUserProfileToFirestore(user, updated).catch(() => {});
    }
  };

  const handleSaveUser = (updatedUser: UserAccount) => {
    setUser(updatedUser);
    saveUser(updatedUser);
    if (!updatedUser.isGuest) {
      syncUserProfileToFirestore(updatedUser, coins).catch(() => {});
    }
    if (updatedUser.diceColors) {
      const nextShop = {
        ...shopSettings,
        equippedColors: updatedUser.diceColors,
      };
      setShopSettings(nextShop);
      saveShopSettings(nextShop);
    }
  };

  const handleLogOut = async () => {
    try {
      await logOut();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    const guestUser = getInitialUser();
    setUser(guestUser);
    setCoins(getUserCoins(guestUser.uid));
    setScreen('signin');
    triggerToast('Logged out of Color Run');
  };

  const handleHeaderBack = () => {
    if (screen === 'play') {
      if (window.confirm('Leave this game and return to the main menu?')) {
        setScreen('mainmenu');
        triggerToast('Returned to Main Menu');
      }
    } else if (screen === 'pickgame') {
      setScreen('modeselect');
    } else if (
      screen === 'modeselect' ||
      screen === 'shop' ||
      screen === 'scoreboard' ||
      screen === 'avatar' ||
      screen === 'winner'
    ) {
      setScreen('mainmenu');
    }
  };

  const handleLeaveGameFromMenu = () => {
    if (window.confirm('Leave this game and return to the main menu?')) {
      setScreen('mainmenu');
      triggerToast('Returned to Main Menu');
    }
  };

  const handleUpdateShop = (updatedSettings: ShopSettings) => {
    setShopSettings(updatedSettings);
    saveShopSettings(updatedSettings);
  };

  const handleSetAdFree = (
    adFree: boolean,
    subscription?: {
      plan?: 'monthly' | 'yearly';
      billingDate?: string;
      recurring?: boolean;
    }
  ) => {
    const updated = setAdFree(user, adFree, subscription);
    setUser(updated);
    if (!updated.isGuest) {
      syncUserProfileToFirestore(updated, coins).catch(() => {});
    }
  };

  const handleRedeemCode = (code: string): boolean => {
    const result = redeemHomeGameCode(user, code);
    if (result.success) {
      setUser(result.user);
      triggerToast(result.message);
      return true;
    }
    return false;
  };

  const handleStartGame = (settings: GameSettings) => {
    // If game has a buy-in, deduct it from player balance
    if (settings.buyIn && settings.buyIn > 0) {
      if (coins < settings.buyIn) {
        triggerToast(`Not enough coins — need 🪙 ${settings.buyIn} to play`);
        return;
      }
      handleUpdateCoins(-settings.buyIn);
    }

    if (user.isAdFree) {
      // Direct access without ad interruption
      setCurrentGameSettings(settings);
      setScreen('play');
    } else {
      // 10-second full-screen ad before game play screen
      setPendingGameSettings(settings);
      setIsFullScreenAdActive(true);
    }
  };

  const handleFullScreenAdComplete = () => {
    setIsFullScreenAdActive(false);
    if (pendingGameSettings) {
      setCurrentGameSettings(pendingGameSettings);
      setPendingGameSettings(null);
    }
    setScreen('play');
  };

  const handleGameOver = (winner: PlayerUnit, units: PlayerUnit[]) => {
    setGameWinner(winner);
    setFinalUnits(units);

    // If game has payouts configured, award human player according to their final rank
    if (currentGameSettings?.payouts && currentGameSettings.payouts.length > 0) {
      const human = units.find(u => !u.isCPU);
      if (human && human.place) {
        const placeIdx = human.place - 1;
        const payout = currentGameSettings.payouts[placeIdx] || 0;
        if (payout > 0) {
          handleUpdateCoins(payout);
          triggerToast(`You won 🪙 ${payout} for ${human.place === 1 ? '1st' : human.place === 2 ? '2nd' : '3rd'} place!`);
        }
      }
    } else if (!winner.isCPU) {
      handleUpdateCoins(150); // Winner bonus!
    }
    setScreen('winner');
  };

  const handlePlayAgain = () => {
    if (currentGameSettings) {
      handleStartGame(currentGameSettings);
    } else {
      setScreen('modeselect');
    }
  };

  return (
    <div
      className={`min-h-[100dvh] text-stone-900 transition-colors duration-300 font-sans flex flex-col justify-between ${shopSettings.equippedBg}`}
    >
      {/* Top USER Bar anchored to the top of every page (except initial signin screen) */}
      {screen !== 'signin' && (
        <Header
          user={user}
          coins={coins}
          currentScreen={screen}
          onOpenMenu={() => setIsMenuModalOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onBack={screen !== 'mainmenu' ? handleHeaderBack : undefined}
        />
      )}

      {/* Global Toast */}
      {toastNotice && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#1c6a35] text-white font-bold text-xs px-4 py-2 rounded-full shadow-lg animate-fade-in pointer-events-none">
          {toastNotice}
        </div>
      )}

      {/* Screen Router */}
      <main className="flex-1 flex flex-col justify-center">
        {screen === 'signin' && (
          <SignInScreen
            onSignedIn={u => {
              handleSaveUser(u);
              setScreen('mainmenu');
              triggerToast(`Welcome, ${u.name}!`);
            }}
            onPlayGuest={() => {
              setScreen('mainmenu');
              triggerToast('Playing as Guest');
            }}
          />
        )}

        {screen === 'avatar' && (
          <AvatarScreen
            user={user}
            onSave={u => {
              handleSaveUser(u);
              setScreen('mainmenu');
            }}
            onBack={() => setScreen('mainmenu')}
          />
        )}

        {screen === 'mainmenu' && (
          <MainMenuScreen
            onPlay={() => setScreen('modeselect')}
            onOpenShop={() => setScreen('shop')}
            onOpenScoreboard={() => setScreen('scoreboard')}
            onOpenRules={() => setIsRulesOpen(true)}
            onOpenTournament={() => triggerToast('🏆 Tournament Mode arriving in next update!')}
          />
        )}

        {screen === 'modeselect' && (
          <ModeSelectScreen
            friends={friends}
            onSelectMode={mode => {
              if (mode === 'challenge_friend') {
                setSelectedChallengeFriend(null);
                setIsChallengeFriendModalOpen(true);
              } else if (mode === 'pass_and_play') {
                const userDiceColors: [DiceColor, DiceColor] = user.diceColors || shopSettings.equippedColors;
                handleStartGame({
                  playersCount: 2,
                  mode: 'pass_and_play',
                  threshold: 250,
                  colorA: userDiceColors[0],
                  colorB: userDiceColors[1],
                  slots: [
                    {
                      name: user.name,
                      type: 'human',
                      color: user.avatar.color,
                      image: user.avatar.image,
                      diceColors: userDiceColors,
                    },
                    {
                      name: 'Player 2',
                      type: 'human',
                      color: '#1f7fd6',
                      diceColors: ['blue', 'red'],
                    },
                  ],
                });
              } else {
                setGameMode('online');
                setScreen('pickgame');
              }
            }}
            onSelectFriend={friend => {
              setSelectedChallengeFriend(friend);
              setIsChallengeFriendModalOpen(true);
            }}
            onBack={() => setScreen('mainmenu')}
          />
        )}

        {screen === 'pickgame' && (
          <PickGameScreen
            mode={gameMode}
            user={user}
            coins={coins}
            equippedColors={shopSettings.equippedColors}
            onStartGame={handleStartGame}
            onBack={() => setScreen('modeselect')}
            onToast={triggerToast}
          />
        )}

        {screen === 'play' && currentGameSettings && (
          <PlayScreen
            settings={currentGameSettings}
            user={user}
            onGameOver={handleGameOver}
            onOpenMenu={() => setIsStandingsOpen(true)}
            onExitGame={() => setScreen('mainmenu')}
          />
        )}

        {screen === 'winner' && gameWinner && (
          <WinnerScreen
            winner={gameWinner}
            units={finalUnits}
            settings={currentGameSettings}
            onPlayAgain={handlePlayAgain}
            onHome={() => setScreen('mainmenu')}
          />
        )}

        {screen === 'shop' && (
          <ShopScreen
            user={user}
            coins={coins}
            shopSettings={shopSettings}
            onUpdateShop={handleUpdateShop}
            onAddCoins={handleUpdateCoins}
            onSetAdFree={handleSetAdFree}
            onOpenRedeemModal={() => setIsRedeemModalOpen(true)}
            onBack={() => setScreen('mainmenu')}
          />
        )}

        {screen === 'scoreboard' && (
          <ScoreboardScreen
            isUnlocked={!!user.scoreboardUnlocked}
            onUnlockCode={handleRedeemCode}
            onBack={() => setScreen('mainmenu')}
          />
        )}
      </main>

      {/* Placeholder Strip Ad at Bottom */}
      {!user.isAdFree && (
        <StripAd onRemoveAdsClick={() => setIsRedeemModalOpen(true)} />
      )}

      {/* 10-Second Full-Screen Interstitial Ad on entering PlayScreen */}
      {isFullScreenAdActive && (
        <FullScreenAd
          onComplete={handleFullScreenAdComplete}
          onRedeemCode={handleRedeemCode}
        />
      )}

      {/* Home Game User Guide Code Redemption Modal */}
      <RedeemCodeModal
        isOpen={isRedeemModalOpen}
        onClose={() => setIsRedeemModalOpen(false)}
        onRedeem={handleRedeemCode}
      />

      {/* Rules Modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* Standings Sheet */}
      <StandingsSheet
        isOpen={isStandingsOpen}
        units={finalUnits.length ? finalUnits : []}
        threshold={currentGameSettings?.threshold || 250}
        isElimination={false}
        onClose={() => setIsStandingsOpen(false)}
        onOpenRules={() => setIsRulesOpen(true)}
        onNewGame={() => {
          setIsStandingsOpen(false);
          setScreen('modeselect');
        }}
      />

      {/* User Profile & Customization Modal (Volume, Dice, Backgrounds, Avatars, Account) */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        user={user}
        shopSettings={shopSettings}
        coins={coins}
        onClose={() => setIsProfileModalOpen(false)}
        onSaveUser={handleSaveUser}
        onUpdateShop={handleUpdateShop}
        onOpenFiles={() => setIsFilesModalOpen(true)}
        onLogOut={handleLogOut}
        onToast={triggerToast}
      />

      {/* Cheeseburger Navigation Menu (Leave game -> Main Menu, Shop, Rules, Settings, Files) */}
      <MenuModal
        isOpen={isMenuModalOpen}
        user={user}
        coins={coins}
        currentScreen={screen}
        shopSettings={shopSettings}
        onClose={() => setIsMenuModalOpen(false)}
        onLeaveGame={handleLeaveGameFromMenu}
        onGoToShop={() => setScreen('shop')}
        onGoToMainMenu={() => setScreen('mainmenu')}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenScoreboard={() => setScreen('scoreboard')}
        onLogOut={handleLogOut}
        onUpdateShop={handleUpdateShop}
        onToast={triggerToast}
      />

      {/* Firebase Cloud User Files & Storage Modal */}
      <UserFilesModal
        isOpen={isFilesModalOpen}
        user={user}
        onClose={() => setIsFilesModalOpen(false)}
        onToast={triggerToast}
      />

      {/* Challenge A Friend Modal */}
      {isChallengeFriendModalOpen && (
        <ChallengeFriendModal
          friends={friends}
          initialFriend={selectedChallengeFriend}
          user={user}
          coins={coins}
          equippedColors={shopSettings.equippedColors}
          onStartGame={handleStartGame}
          onRemoveFriend={async friendId => {
            const updated = await removeFriend(user.uid, friendId);
            setFriends(updated);
            triggerToast('Friend removed.');
          }}
          onClose={() => setIsChallengeFriendModalOpen(false)}
          onToast={triggerToast}
        />
      )}

      {/* Daily Bonus Dice Roll Overlay (Resets at midnight local time) */}
      <DailyBonusOverlay
        isOpen={isDailyBonusOpen}
        onClaim={handleClaimDailyBonus}
        onClose={() => setIsDailyBonusOpen(false)}
      />
    </div>
  );
}
