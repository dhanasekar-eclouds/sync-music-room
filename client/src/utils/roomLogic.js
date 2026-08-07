const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 6, rng = Math.random) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(rng() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function classifyConnectionQuality(rttSeconds) {
  const ms = rttSeconds * 1000;
  if (ms < 150) return 'excellent';
  if (ms < 400) return 'good';
  return 'poor';
}

export function computeSkipVotesNeeded(totalUserCount) {
  return Math.max(1, Math.ceil(totalUserCount / 2));
}

export function computeDisplayPosition(playbackState, now = Date.now()) {
  if (!playbackState.isPlaying) return playbackState.position;
  return playbackState.position + (now - playbackState.timestamp) / 1000;
}
