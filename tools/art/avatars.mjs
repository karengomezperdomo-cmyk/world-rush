import { Canvas, rng } from './lib/pixel.mjs';

/** Provisional 12x12 pixel avatars (players will use their own World App profile picture later). */
const SKINS = ['#f2c6a0', '#d9a070', '#a8703c', '#7a4a2a', '#f5d5b8', '#c68a5a'];
const HAIRS = ['#2a1a12', '#5a3a20', '#d9a030', '#c2331e', '#1a1a2a', '#8a5aa0', '#3aa0c0'];
const BACKS = ['#1c2a63', '#3a1c63', '#1c5a63', '#632a1c', '#1c6340', '#63421c'];
const SHIRTS = ['#ff8a3a', '#35d6ff', '#2ee59d', '#ffc23e', '#ff4d5a', '#a06ad8'];

export function avatar(index) {
  const r = rng(300 + index * 17);
  const c = new Canvas(12, 12);
  c.fill(r.pick(BACKS));
  const skin = r.pick(SKINS);
  const hair = r.pick(HAIRS);
  c.rect(2, 10, 8, 2, r.pick(SHIRTS)); // shoulders
  c.rect(5, 9, 2, 1, skin); // neck
  c.circle(6, 6, 3, skin); // face
  c.rect(3, 2, 6, 2, hair); // hair top
  if (r() < 0.6) {
    c.rect(2, 3, 1, 4, hair);
    c.rect(9, 3, 1, 4, hair);
  }
  c.set(5, 6, '#150b1e'); // eyes
  c.set(7, 6, '#150b1e');
  c.hline(5, 8, 3, '#a04a3a'); // mouth
  return c;
}

export const AVATAR_COUNT = 8;
