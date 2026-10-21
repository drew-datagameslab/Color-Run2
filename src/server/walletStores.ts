import type { Firestore } from 'firebase-admin/firestore';
import type { LedgerEntry, MatchTicket, Wallet, WalletStore, WalletTx } from './wallet.ts';
import type { BalloonBoardRecord } from '../lib/balloonBoard.ts';

/**
 * Wallets in Firestore: wallets/{uid}, with matches/{matchId} and ledger/{entry}
 * subcollections. Firestore rules let players read their own wallet but never write it.
 */
export class FirestoreWalletStore implements WalletStore {
  constructor(private db: Firestore) {}

  async getLegacyCoins(uid: string): Promise<number | null> {
    const snap = await this.db.collection('users').doc(uid).get();
    const coins = snap.exists ? snap.get('coins') : undefined;
    return typeof coins === 'number' ? coins : null;
  }

  runTransaction<T>(uid: string, fn: (tx: WalletTx) => Promise<T>): Promise<T> {
    const walletRef = this.db.collection('wallets').doc(uid);
    // Separate from the wallet, which players can read: the hidden prizes must stay hidden
    const balloonRef = this.db.collection('balloonBoards').doc(uid);
    return this.db.runTransaction(async t => {
      const tx: WalletTx = {
        async getWallet() {
          const snap = await t.get(walletRef);
          return snap.exists ? (snap.data() as Wallet) : null;
        },
        async getMatch(matchId) {
          const snap = await t.get(walletRef.collection('matches').doc(matchId));
          return snap.exists ? (snap.data() as MatchTicket) : null;
        },
        setWallet(wallet) {
          t.set(walletRef, wallet);
        },
        setMatch(matchId, ticket) {
          t.set(walletRef.collection('matches').doc(matchId), ticket);
        },
        addLedger(entry: LedgerEntry) {
          t.set(walletRef.collection('ledger').doc(), entry);
        },
        async getBalloonBoard() {
          const snap = await t.get(balloonRef);
          return snap.exists ? (snap.data() as BalloonBoardRecord) : null;
        },
        setBalloonBoard(board) {
          t.set(balloonRef, board);
        },
      };
      return fn(tx);
    });
  }
}

/** In-memory wallets for tests */
export class MemoryWalletStore implements WalletStore {
  wallets = new Map<string, Wallet>();
  matches = new Map<string, MatchTicket>();
  ledger: Array<LedgerEntry & { uid: string }> = [];
  balloonBoards = new Map<string, BalloonBoardRecord>();
  legacyCoins = new Map<string, number>();

  async getLegacyCoins(uid: string): Promise<number | null> {
    return this.legacyCoins.get(uid) ?? null;
  }

  async runTransaction<T>(uid: string, fn: (tx: WalletTx) => Promise<T>): Promise<T> {
    // Stage writes and apply them only if `fn` succeeds, like a real transaction
    const writes: Array<() => void> = [];
    const tx: WalletTx = {
      getWallet: async () => {
        const w = this.wallets.get(uid);
        return w ? structuredClone(w) : null;
      },
      getMatch: async matchId => {
        const m = this.matches.get(`${uid}/${matchId}`);
        return m ? { ...m } : null;
      },
      setWallet: wallet => writes.push(() => this.wallets.set(uid, structuredClone(wallet))),
      setMatch: (matchId, ticket) => writes.push(() => this.matches.set(`${uid}/${matchId}`, { ...ticket })),
      addLedger: entry => writes.push(() => this.ledger.push({ ...entry, uid })),
      getBalloonBoard: async () => {
        const b = this.balloonBoards.get(uid);
        return b ? structuredClone(b) : null;
      },
      setBalloonBoard: board => writes.push(() => this.balloonBoards.set(uid, structuredClone(board))),
    };
    const result = await fn(tx);
    writes.forEach(w => w());
    return result;
  }
}
