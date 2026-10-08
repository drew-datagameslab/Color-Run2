# Security Specification & Test Protocol: Color Run Backend

## 1. Data Invariants

1. **Admin Authorization**: Administrative operations (unrestricted user modifications, email subscriber listing, coin balance changes, ad-free provisioning, room deletion) are restricted to:
   - `drew@datagameslab.com` signed in with Google (verified email), or the master admin UID, and
   - accounts granted in the admin portal: `/admins/{uid}`, or `/admins/{emailKey}` for a verified email.
   The app has no admin password or admin sign-in form; the Admin Backend menu item only appears for these accounts. Players can read only their own `/admins` record; listing admins is admin-only.
2. **PII Isolation & Anti-Harvesting**:
   - `users/{userId}`: Document read is restricted to the owner (`request.auth.uid == userId`) or an admin. General listing of all users is forbidden to non-admins to prevent email and phone harvesting.
   - `emailSubscribers/{subId}`: Listing is restricted to `isAdmin()`. Non-admins cannot view or enumerate subscriber emails.
   - `phoneIndex/{phoneId}`: Listing is restricted to `isAdmin()`. Exact lookup (`get`) requires authentication; arbitrary enumeration is forbidden.
3. **Friend List Integrity**: `users/{userId}/friends/{friendId}` can only be written or read by the account owner (`request.auth.uid == userId`) or an admin. Cross-user write pollution is strictly rejected.
4. **Economy & Privilege Protection**:
   - Players cannot modify their own `coins`, `isAdFree`, `adFreePlan`, `scoreboardUnlocked`, or self-assign `role`/`isAdmin` during updates. New profiles start with exactly 200 coins.
   - The real coin balance is in `/wallets/{uid}` (with `matches` and `ledger` subcollections). Players can read their own wallet; no client, including admins, can write it. Deleting and recreating a profile does not reset it.
   - Only the server (`server.ts`, Firebase Admin SDK) changes balances. Every coin endpoint requires a Firebase ID token and uses the uid from that token, never from the request.
   - The server decides amounts from `src/lib/economy.ts` and the mission, level and coupon catalogs: daily bonus dice are rolled on the server once per UTC day; mission, level and coupon rewards are paid once; free coins, referrals and coin packs have per-day limits; buy-ins are charged when a game starts, and the prize is paid once per game ticket from the shared payout table.
   - Setting a balance directly (`/api/admin/coins/set`) is admin-only.
5. **Presence & Multiplayer State Integrity**:
   - `presence/{userId}`: Only the authenticated user matching `userId` can write their own heartbeat.
   - `rooms/{roomId}`: Unauthenticated reads and writes are blocked.
   - `game_invites/{inviteId}` and `friend_requests/{requestId}`: Only sender or recipient can access or modify invites.

---

## 2. The "Dirty Dozen" Malicious Payloads

1. **Malicious Payload 1: Unauthenticated Room Deletion**
   - Target: `DELETE /rooms/room_123`
   - Auth: `null` (Anonymous / Unauthenticated)
   - Expected: `PERMISSION_DENIED`

2. **Malicious Payload 2: Email Subscriber Harvesting (List Attack)**
   - Target: `LIST /emailSubscribers`
   - Auth: `{ uid: 'attacker_1', email: 'attacker@evil.com' }`
   - Expected: `PERMISSION_DENIED`

3. **Malicious Payload 3: Phone Index Directory Scraping**
   - Target: `LIST /phoneIndex`
   - Auth: `{ uid: 'attacker_2' }`
   - Expected: `PERMISSION_DENIED`

4. **Malicious Payload 4: Arbitrary User Profile Snooping**
   - Target: `GET /users/victim_user_99`
   - Auth: `{ uid: 'snooper_3' }`
   - Expected: `PERMISSION_DENIED`

5. **Malicious Payload 5: Friends List Injection (Cross-User Write)**
   - Target: `SET /users/victim_user_99/friends/friend_spoof`
   - Auth: `{ uid: 'attacker_4' }`
   - Expected: `PERMISSION_DENIED`

6. **Malicious Payload 6: Self-Granted 1,000,000 Coins**
   - Target: `UPDATE /users/player_5` with `{ coins: 1000000 }`
   - Auth: `{ uid: 'player_5' }` (Non-admin owner)
   - Expected: `PERMISSION_DENIED`

7. **Malicious Payload 7: Self-Assigned Ad-Free Bypass**
   - Target: `UPDATE /users/player_6` with `{ isAdFree: true }`
   - Auth: `{ uid: 'player_6' }` (Non-admin owner)
   - Expected: `PERMISSION_DENIED`

8. **Malicious Payload 8: Self-Assigned Admin Role Escalation**
   - Target: `UPDATE /users/player_7` with `{ role: 'admin', isAdmin: true }`
   - Auth: `{ uid: 'player_7' }`
   - Expected: `PERMISSION_DENIED`

9. **Malicious Payload 9: Forged Admin Account Creation**
   - Target: `SET /admins/attacker_uid` with `{ role: 'admin' }`
   - Auth: `{ uid: 'attacker_uid' }` (Not an existing admin)
   - Expected: `PERMISSION_DENIED`

10. **Malicious Payload 10: Presence Impersonation Attack**
    - Target: `SET /presence/target_victim_uid` with `{ inGame: false }`
    - Auth: `{ uid: 'impersonator_8' }`
    - Expected: `PERMISSION_DENIED`

11. **Malicious Payload 11: Game Invite Interception by Third-Party**
    - Target: `GET /game_invites/invite_between_alice_and_bob`
    - Auth: `{ uid: 'eavesdropper_9' }` (Neither alice nor bob)
    - Expected: `PERMISSION_DENIED`

12. **Malicious Payload 12: Public Unauthenticated Presence Wipe**
    - Target: `DELETE /presence/alice_uid`
    - Auth: `null`
    - Expected: `PERMISSION_DENIED`

---

13. **Malicious Payload 13: Direct Wallet Write**
    - Target: `SET /wallets/player_5` with `{ balance: 1000000 }`
    - Auth: `{ uid: 'player_5' }`
    - Expected: `PERMISSION_DENIED`

14. **Malicious Payload 14: Admin by Email Without Google Sign-In**
    - Target: `LIST /users`
    - Auth: `{ uid: 'x', email: 'drew@datagameslab.com', email_verified: true, sign_in_provider: 'password' }`
    - Expected: `PERMISSION_DENIED`

15. **Malicious Payload 15: Unauthenticated Coin Endpoints**
    - Target: `POST /api/admin/coins/set` or `POST /api/coins/grant` with no or forged `Authorization` header
    - Expected: `401`

16. **Malicious Payload 16: Repeated Prize Claim**
    - Target: `POST /api/match/payout` twice with the same `matchId`
    - Expected: second call `409`

---

## 3. Tests
- Firestore rules: payloads 6, 9, 13 and 14, plus the admin and wallet read rules, were checked against the Firestore emulator with `@firebase/rules-unit-testing` (version 6.5.1).
- Server: `src/tests/wallet_test.ts` (run with `npm test`) covers the wallet limits, one-time claims, game tickets and the sign-in checks (payloads 15–16).

## 4. Known Gaps (not yet implemented)
- Coin packs are not charged: `coin_pack` grants are allowed (5 per day) for testing. Before launch, verify App Store / Google Play receipts on the server.
- Game results come from the players' devices, so a modified app can still claim a better finishing place (one prize per game, from the payout table).
- Missions and XP are tracked on the device; the server only limits each reward to once per period.
- `rooms` and `lobbies` can be updated by any signed-in player.
