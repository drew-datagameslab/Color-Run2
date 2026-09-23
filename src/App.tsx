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
  DEFAULT_AVATARS,
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
import { MatchmakingScreen } from './components/MatchmakingScreen';
import { GameInviteOverlay } from './components/GameInviteOverlay';
import { RulesModal } from './components/RulesModal';
import { StandingsSheet } from './components/StandingsSheet';
import { StripAd } from './components/StripAd';
import { FullScreenAd } from './components/FullScreenAd';
import { RedeemCodeModal } from './components/RedeemCodeModal';
import { ProfileModal } from './components/ProfileModal';
import { MenuModal } from './components/MenuModal';
import { UserFilesModal } from './components/UserFilesModal';
import { DailyBonusOverlay } from './components/DailyBonusOverlay';
import { ChallengeFriendsOverlay } from './components/ChallengeFriendsOverlay';
import { PortraitLockOverlay } from './components/PortraitLockOverlay';
import { shouldShow24hReferralOverlay, dismiss24hReferralOverlay } from './lib/referrals';
import { subscribeToAuth, logOut, syncUserProfileToFirestore } from './lib/firebase';
import { createChallengeRoom, joinChallengeRoom, GameRoom } from './lib/matchmaking';
import {
  sendChallengeInvites,
  respondToChallengeInvite,
  subscribeToMyInvites,
  GameInvite,
} from './lib/invites';
import {
  startPresenceHeartbeat,
  subscribeToOnlinePresence,
  mergeFriendsWithPresence,
} from './lib/presence';

export default function App() {
  const [user, setUser] = useState<UserAccount>(() => getInitialUser());
  const [coins, setCoins] = useState<number>(() => getUserCoins(user.uid));
  const [shopSettings, setShopSettings] = useState<ShopSettings>(() => getShopSettings());
  const [screen, setScreen] = useState<
    'signin' | 'avatar' | 'mainmenu' | 'modeselect' | 'pickgame' | 'play' | 'winner' | 'shop' | 'scoreboard' | 'challenge_lobby'
  >('signin');

  const [gameMode, setGameMode] = useState<'online' | 'cpu' | 'pass_and_play' | 'challenge' | 'challenge_friend'>('online');
  const [friends, setFriends] = useState<Friend[]>(() => getLocalFriends(user.uid));
  const [isChallengeFriendModalOpen, setIsChallengeFriendModalOpen] = useState(false);
  const [selectedChallengeFriend, setSelectedChallengeFriend] = useState<Friend | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<GameInvite | null>(null);
  const [challengeLobbyConfig, setChallengeLobbyConfig] = useState<{
    room: GameRoom;
    buyIn: number;
    playerCount: 2 | 3 | 4 | 5 | 6 | 8;
    isHost: boolean;
  } | null>(null);
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
  const [isChallengeFriendsOpen, setIsChallengeFriendsOpen] = useState(false);
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

  // Subscribe to real-time challenge invites for this user
  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = subscribeToMyInvites(user, invite => {
        setIncomingInvite(invite);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleStartChallengeRoom = async (selectedFriends: Friend[], buyIn: number) => {
    try {
      const equippedDice = shopSettings.equippedColors;
      const room = await createChallengeRoom(user, equippedDice, selectedFriends, buyIn);
      await sendChallengeInvites(room.id, room.roomCode || '', user, selectedFriends, buyIn);
      setChallengeLobbyConfig({
        room,
        buyIn,
        playerCount: room.playerCount,
        isHost: true,
      });
      setScreen('challenge_lobby');
      triggerToast('🏆 Challenge room created! Waiting for players to join…');
    } catch (err) {
      console.warn('Error starting challenge room:', err);
      triggerToast('Could not create challenge room. Please try again.');
    }
  };

  const handleAcceptInvite = async (invite: GameInvite) => {
    try {
      await respondToChallengeInvite(invite.id, invite.roomId, user.uid, 'joined');
      const joinedRoom = await joinChallengeRoom(
        invite.roomId,
        user,
        shopSettings.equippedColors
      );
      setIncomingInvite(null);

      if (joinedRoom) {
        setChallengeLobbyConfig({
          room: joinedRoom,
          buyIn: invite.buyIn,
          playerCount: joinedRoom.playerCount || 2,
          isHost: false,
        });
        setScreen('challenge_lobby');
        triggerToast(`Joined ${invite.hostName}'s challenge lobby!`);
      } else {
        triggerToast('Could not connect to challenge room.');
      }
    } catch (err) {
      console.warn('Error accepting invite:', err);
      triggerToast('Failed to join challenge.');
    }
  };

  const handleWillJoinWhenDone = async (invite: GameInvite) => {
    try {
      await respondToChallengeInvite(invite.id, invite.roomId, user.uid, 'will_join_later');
      setIncomingInvite(null);
      triggerToast(`Let ${invite.hostName} know you'll join when done!`);
    } catch (err) {
      console.warn('Error replying to invite:', err);
    }
  };

  const handleDismissInvite = async (invite: GameInvite) => {
    try {
      await respondToChallengeInvite(invite.id, invite.roomId, user.uid, 'dismissed');
      setIncomingInvite(null);
    } catch (err) {
      console.warn('Error dismissing invite:', err);
    }
  };

  // Check 24-hour post-signup Referral Overlay:
  // "After the user has signed up, after 24 hours, let's create an overlay that says:
  // Ready to Challenge Your Friends? Send them a link to play the game with you!"
  useEffect(() => {
    if (screen !== 'signin' && user?.uid && !user.isGuest) {
      if (shouldShow24hReferralOverlay(user)) {
        const timer = setTimeout(() => {
          setIsChallengeFriendsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [screen, user]);

  const handleClaimDailyBonus = (wonCoins: number) => {
    markDailyBonusClaimed(user.uid);
    handleUpdateCoins(wonCoins);
    triggerToast(`🎉 +${wonCoins} Daily Bonus Coins claimed!`);
  };

  // Subscribe to Firebase Auth changes
  useEffect(() => {
    const unsubscribe = subscribeToAuth(authedUser => {
      if (authedUser) {
        setUser(prevUser => {
          const localUser = getInitialUser();
          const effective = prevUser || localUser;
          const merged: UserAccount = {
            ...effective,
            ...authedUser,
            name:
              authedUser.name &&
              authedUser.name !== 'Color Roller' &&
              authedUser.name !== 'Guest Roller' &&
              authedUser.name !== 'Player'
                ? authedUser.name
                : effective?.name || authedUser.name,
            avatar: {
              ...authedUser.avatar,
              color: effective?.avatar?.color || authedUser.avatar?.color || DEFAULT_AVATARS[0],
              image: effective?.avatar?.image !== undefined ? effective.avatar.image : authedUser.avatar?.image,
            },
            diceColors: effective?.diceColors || authedUser.diceColors || ['blue', 'red'],
          };
          saveUser(merged);
          return merged;
        });
        const storedCoins = getUserCoins(authedUser.uid);
        setCoins(storedCoins);
        setScreen(prev => (prev === 'signin' ? 'mainmenu' : prev));
        syncFriendsFromFirestore(authedUser.uid).then(f => setFriends(f));
      }
    });
    return () => unsubscribe();
  }, []);

  // Start live presence heartbeat so other devices and friends immediately see this player online
  useEffect(() => {
    if (user && user.uid) {
      const stopHeartbeat = startPresenceHeartbeat(user);
      return () => stopHeartbeat();
    }
  }, [user]);

  // Subscribe to real-time online presence in Firestore to keep friends list updated
  useEffect(() => {
    const unsub = subscribeToOnlinePresence(presenceMap => {
      setFriends(prev => mergeFriendsWithPresence(prev, presenceMap, user.uid));
    });
    return () => unsub();
  }, [user.uid]);

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
    if (user.uid) {
      syncUserProfileToFirestore(user, updated).catch(() => {});
    }
  };

  const handleSaveUser = (updatedUser: UserAccount) => {
    setUser(updatedUser);
    saveUser(updatedUser);
    if (updatedUser.uid) {
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
      setIsMenuModalOpen(true);
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
    setScreen('mainmenu');
    triggerToast('Returned to Main Menu');
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

    if (user.isAdFree || settings.adPlayedDuringMatchmaking) {
      // Direct access without ad interruption (or ad already played during 15s matchmaking lobby)
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
    setScreen('pickgame');
  };

  const bgClass = shopSettings.equippedBg.startsWith('bg-')
    ? `${shopSettings.equippedBg} ${shopSettings.equippedBg.slice(3)}`
    : `bg-${shopSettings.equippedBg} ${shopSettings.equippedBg}`;

  return (
    <div
      className={`h-[100dvh] max-h-[100dvh] text-stone-900 transition-colors duration-300 font-sans flex flex-col justify-between overflow-hidden select-none ${bgClass}`}
    >
      {/* Landscape orientation lock overlay: prompts user to rotate to portrait */}
      <PortraitLockOverlay />

      {/* Responsive framing for Folded Outer Screens, Unfolded Inner Screens (Z-Fold 8, Z-Fold 8 Ultra, Apple Duo), and Tablets */}
      <div
        className="game-viewport-container flex flex-col justify-between"
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

        {/* Live Challenge Game Invite Banner Overlay */}
        <GameInviteOverlay
          invite={incomingInvite}
          isInActiveGame={screen === 'play'}
          onAcceptAndJoin={handleAcceptInvite}
          onJoinWhenDone={handleWillJoinWhenDone}
          onDismiss={handleDismissInvite}
        />

        {/* Screen Router */}
        <main className={`flex-1 flex flex-col min-h-0 overflow-hidden ${screen === 'play' ? 'justify-between' : screen === 'shop' ? 'justify-start' : 'justify-center'}`}>
        {screen === 'signin' && (
          <SignInScreen
            onSignedIn={u => {
              handleSaveUser(u);
              const storedCoins = getUserCoins(u.uid);
              setCoins(storedCoins);
              syncFriendsFromFirestore(u.uid).then(f => setFriends(f));
              setScreen('mainmenu');
              triggerToast(`Welcome, ${u.name}!`);
            }}
            onPlayGuest={() => {
              setScreen('mainmenu');
              triggerToast('Playing as Guest');
            }}
            onToast={triggerToast}
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
              } else if (mode === 'cpu') {
                setGameMode('cpu');
                setScreen('pickgame');
              } else {
                setGameMode('online');
                setScreen('pickgame');
              }
            }}
            onSelectFriend={friend => {
              setSelectedChallengeFriend(friend);
              setIsChallengeFriendModalOpen(true);
            }}
            onInviteFriends={() => setIsChallengeFriendsOpen(true)}
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
            onAddCoins={handleUpdateCoins}
          />
        )}

        {screen === 'play' && currentGameSettings && (
          <PlayScreen
            settings={currentGameSettings}
            user={user}
            onGameOver={handleGameOver}
            onOpenMenu={() => setIsStandingsOpen(true)}
            onAwardPrize={(amount, place) => {
              handleUpdateCoins(amount);
              triggerToast(`🪙 Awarded ${amount} coins for finishing in ${place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`} place!`);
            }}
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

        {screen === 'challenge_lobby' && challengeLobbyConfig && (
          <MatchmakingScreen
            playerCount={challengeLobbyConfig.playerCount}
            buyIn={challengeLobbyConfig.buyIn}
            tier="standard"
            user={user}
            equippedColors={shopSettings.equippedColors}
            initialRoom={challengeLobbyConfig.room}
            friends={friends}
            isChallengeMode={true}
            onMatchReady={settings => {
              setChallengeLobbyConfig(null);
              handleStartGame(settings);
            }}
            onCancel={() => {
              setChallengeLobbyConfig(null);
              setScreen('modeselect');
              triggerToast('Challenge cancelled.');
            }}
            onToast={triggerToast}
          />
        )}
      </main>

        {/* Placeholder Strip Ad at Bottom (PlayScreen includes its own native compact banner) */}
        {!user.isAdFree && screen !== 'play' && (
          <StripAd onRemoveAdsClick={() => setIsRedeemModalOpen(true)} />
        )}
      </div>

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
        onOpenChallengeFriends={() => setIsChallengeFriendsOpen(true)}
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
          onStartChallengeRoom={handleStartChallengeRoom}
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

      {/* 24-Hour Post-Signup Challenge Friends Referral Overlay */}
      <ChallengeFriendsOverlay
        isOpen={isChallengeFriendsOpen}
        user={user}
        onClose={() => {
          dismiss24hReferralOverlay(user.uid);
          setIsChallengeFriendsOpen(false);
        }}
        onToast={triggerToast}
        onFriendAdded={async () => {
          const updated = await syncFriendsFromFirestore(user.uid);
          setFriends(updated);
        }}
      />
    </div>
  );
}
