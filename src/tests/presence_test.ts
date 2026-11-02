import { PresenceTracker, ROOM_AWAY_AFTER_MS } from '../lib/roomPresence';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

export function runPresenceTests() {
  const t0 = 1_000_000;
  const tracker = new PresenceTracker();

  // Players with no heartbeat at all (older app) always count as present
  assert(!tracker.isAway('old_client', t0 + 10 * ROOM_AWAY_AFTER_MS), 'Unknown players are present');

  // Heartbeats keep a player present; the time is this device's, not the sender's clock
  tracker.observe({ alice: 5, bob: 99_999_999 }, t0); // bob's clock is way off: doesn't matter
  tracker.observe({ alice: 6, bob: 100_000_007 }, t0 + 8000);
  assert(!tracker.isAway('alice', t0 + 20000), 'Alice is present with recent heartbeats');
  assert(!tracker.isAway('bob', t0 + 20000), 'Clock differences between devices do not matter');

  // Bob presses Home: his heartbeat stops changing, so after the limit he is away
  tracker.observe({ alice: 7, bob: 100_000_007 }, t0 + 16000);
  tracker.observe({ alice: 8, bob: 100_000_007 }, t0 + 24000);
  assert(!tracker.isAway('bob', t0 + 8000 + ROOM_AWAY_AFTER_MS - 1), 'Not away before the limit');
  assert(tracker.isAway('bob', t0 + 8000 + ROOM_AWAY_AFTER_MS + 1), 'Away once heartbeats stop');

  // Bob comes back: a new heartbeat makes him present again right away
  tracker.observe({ alice: 9, bob: 100_000_050 }, t0 + 60000);
  assert(!tracker.isAway('bob', t0 + 60001), 'Present again as soon as he returns');
  console.log('✓ Room presence: Home button players become away after 25s and return when they come back');
}
