/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Bytewords (BCR-2020-012), minimal style as used by Uniform Resources.
 * Word list is the normative 256-word table from that paper.
 */

import { crc32Ieee } from './codebook-tafelwort.js';

// Concatenated 4-letter words, index = byte value. BCR-2020-012.
const WORDS =
  'ableacidalsoapexaquaarchatomauntawayaxisbackbaldbarnbeltbetabias' +
  'bluebodybragbrewbulbbuzzcalmcashcatschefcityclawcodecolacookcost' +
  'cruxcurlcuspcyandarkdatadaysdelidicedietdoordowndrawdropdrumdull' +
  'dutyeacheasyechoedgeepicevenexamexiteyesfactfairfernfigsfilmfish' +
  'fizzflapflewfluxfoxyfreefrogfuelfundgalagamegeargemsgiftgirlglow' +
  'goodgraygrimgurugushgyrohalfhanghardhawkheathelphighhillholyhope' +
  'hornhutsicedideaidleinchinkyintoirisironitemjadejazzjoinjoltjowl' +
  'judojugsjumpjunkjurykeepkenokeptkeyskickkilnkingkitekiwiknoblamb' +
  'lavalazyleaflegsliarlimplionlistlogoloudloveluaulucklungmainmany' +
  'mathmazememomenumeowmildmintmissmonknailnavyneednewsnextnoonnote' +
  'numbobeyoboeomitonyxopenovalowlspaidpartpeckplaypluspoempoolpose' +
  'puffpumapurrquadquizraceramprealredorichroadrockroofrubyruinruns' +
  'rustsafesagascarsetssilkskewslotsoapsolosongstubsurfswantacotask' +
  'taxitenttiedtimetinytoiltombtoystriptunatwinuglyundouniturgeuser' +
  'vastveryvetovialvibeviewvisavoidvowswallwandwarmwaspwavewaxywebs' +
  'whatwhenwhizwolfworkyankyawnyellyogayurtzapszerozestzinczonezoom';

const LOOKUP = new Int16Array(26 * 26).fill(-1);
for (let i = 0; i < 256; i++) {
  const a = WORDS.charCodeAt(i * 4) - 97;
  const b = WORDS.charCodeAt(i * 4 + 3) - 97;
  LOOKUP[b * 26 + a] = i;
}

function crc4(bytes) {
  const crc = crc32Ieee(bytes);
  return Uint8Array.of((crc >>> 24) & 0xff, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff);
}

function withCrc(bytes) {
  const out = new Uint8Array(bytes.length + 4);
  out.set(bytes, 0);
  out.set(crc4(bytes), bytes.length);
  return out;
}

function word4(i) {
  const o = i * 4;
  return WORDS.slice(o, o + 4);
}

/**
 * Minimal Bytewords: first+last letter of each word, including CRC-32 of the body.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function encodeBytewordsMinimal(bytes) {
  const body = withCrc(bytes);
  let s = '';
  for (let i = 0; i < body.length; i++) {
    const o = body[i] * 4;
    s += WORDS[o] + WORDS[o + 3];
  }
  return s;
}

export function encodeBytewordsStandard(bytes) {
  const body = withCrc(bytes);
  const words = [];
  for (let i = 0; i < body.length; i++) words.push(word4(body[i]));
  return words.join(' ');
}

/**
 * @param {string} text
 * @param {'minimal' | 'standard'} style
 * @returns {Uint8Array}
 */
export function decodeBytewords(text, style = 'minimal') {
  const raw = String(text || '').toLowerCase();
  const buf = [];
  if (style === 'minimal') {
    const letters = raw.replace(/[^a-z]/g, '');
    if (letters.length < 10 || letters.length % 2 !== 0) {
      throw Object.assign(new Error('bytewords.err.length'), { code: 'bytewords.err.length' });
    }
    for (let i = 0; i < letters.length; i += 2) {
      buf.push(decodePair(letters[i], letters[i + 1]));
    }
  } else {
    const words = raw.trim().split(/\s+/);
    if (words.length < 5) {
      throw Object.assign(new Error('bytewords.err.length'), { code: 'bytewords.err.length' });
    }
    for (const w of words) {
      if (w.length !== 4) {
        throw Object.assign(new Error('bytewords.err.word'), { code: 'bytewords.err.word' });
      }
      const v = decodePair(w[0], w[3]);
      if (word4(v) !== w) {
        throw Object.assign(new Error('bytewords.err.word'), { code: 'bytewords.err.word' });
      }
      buf.push(v);
    }
  }
  const bytes = Uint8Array.from(buf);
  const body = bytes.subarray(0, bytes.length - 4);
  const got = bytes.subarray(bytes.length - 4);
  const expect = crc4(body);
  if (got[0] !== expect[0] || got[1] !== expect[1] || got[2] !== expect[2] || got[3] !== expect[3]) {
    throw Object.assign(new Error('bytewords.err.checksum'), { code: 'bytewords.err.checksum' });
  }
  return body;
}

function decodePair(a, b) {
  const x = a.charCodeAt(0) - 97;
  const y = b.charCodeAt(0) - 97;
  if (x < 0 || x > 25 || y < 0 || y > 25) {
    throw Object.assign(new Error('bytewords.err.word'), { code: 'bytewords.err.word' });
  }
  const v = LOOKUP[y * 26 + x];
  if (v < 0) {
    throw Object.assign(new Error('bytewords.err.word'), { code: 'bytewords.err.word' });
  }
  return v;
}
