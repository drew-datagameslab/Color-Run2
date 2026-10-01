# Security Specification & Test Protocol: Color Run Backend

## 1. Data Invariants

1. **Admin Authorization**: Administrative operations (unrestricted user modifications, email subscriber listing, arbitrary coin adjustments, ad-free provisioning, room deletion) are strictly restricted to authenticated accounts with an entry in `/admins/{adminId}` or verified admin credentials.
2. **PII Isolation & Anti-Harvesting**:
   - `users/{userId}`: Document read is restricted to the owner (`request.auth.uid == userId`) or an admin. General listing of all users is forbidden to non-admins to prevent email and phone harvesting.
   - `emailSubscribers/{subId}`: Listing is restricted to `isAdmin()`. Non-admins cannot view or enumerate subscriber emails.
   - `phoneIndex/{phoneId}`: Listing is restricted to `isAdmin()`. Exact lookup (`get`) requires authentication; arbitrary enumeration is forbidden.
3. **Friend List Integrity**: `users/{userId}/friends/{friendId}` can only be written or read by the account owner (`request.auth.uid == userId`) or an admin. Cross-user write pollution is strictly rejected.
4. **Economy & Privilege Protection**:
   - Players cannot modify their own `coins`, `isAdFree`, `adFreePlan`, `scoreboardUnlocked`, or self-assign `role`/`isAdmin` during updates.
   - Only `isAdmin()` or controlled backend transitions can modify restricted economy fields.
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

## 3. Test Runner Specification (`firestore.rules.test.ts`)
All 12 attack vectors are prevented by the hardened ABAC security rules with default-deny, role-based admin checks, and strict field immutability constraints.
