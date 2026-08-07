import { describe, it, expect } from 'vitest';
import {
  generateRoomCode,
  classifyConnectionQuality,
  computeSkipVotesNeeded,
  computeDisplayPosition,
} from './roomLogic';

describe('generateRoomCode', () => {
  it('generates a code of the requested length', () => {
    expect(generateRoomCode(6, () => 0)).toHaveLength(6);
    expect(generateRoomCode(4, () => 0)).toHaveLength(4);
  });

  it('never includes visually ambiguous characters (I, O, 0, 1)', () => {
    for (const rng of [() => 0, () => 0.5, () => 0.999]) {
      const code = generateRoomCode(50, rng);
      expect(code).not.toMatch(/[IO01]/);
    }
  });
});

describe('classifyConnectionQuality', () => {
  it('classifies sub-150ms RTT as excellent', () => {
    expect(classifyConnectionQuality(0.05)).toBe('excellent');
    expect(classifyConnectionQuality(0.149)).toBe('excellent');
  });

  it('classifies 150-399ms RTT as good', () => {
    expect(classifyConnectionQuality(0.15)).toBe('good');
    expect(classifyConnectionQuality(0.399)).toBe('good');
  });

  it('classifies 400ms+ RTT as poor', () => {
    expect(classifyConnectionQuality(0.4)).toBe('poor');
    expect(classifyConnectionQuality(1.2)).toBe('poor');
  });
});

describe('computeSkipVotesNeeded', () => {
  it('requires a majority, rounded up', () => {
    expect(computeSkipVotesNeeded(1)).toBe(1);
    expect(computeSkipVotesNeeded(2)).toBe(1);
    expect(computeSkipVotesNeeded(3)).toBe(2);
    expect(computeSkipVotesNeeded(4)).toBe(2);
    expect(computeSkipVotesNeeded(5)).toBe(3);
  });

  it('never returns less than 1 even for an empty room', () => {
    expect(computeSkipVotesNeeded(0)).toBe(1);
  });
});

describe('computeDisplayPosition', () => {
  it('returns the stored position when paused', () => {
    const state = { isPlaying: false, position: 42, timestamp: 1000 };
    expect(computeDisplayPosition(state, 5000)).toBe(42);
  });

  it('adds elapsed wall-clock time when playing', () => {
    const state = { isPlaying: true, position: 10, timestamp: 1000 };
    expect(computeDisplayPosition(state, 3500)).toBeCloseTo(12.5);
  });
});
