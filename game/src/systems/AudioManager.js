/**
 * AudioManager — 절차적 합성 기반 오디오 시스템
 *
 * 외부 파일 없이 Web Audio API로 완전 합성:
 * - 바이옴별 고유 음악 아이덴티티 (멜로디 + 패드)
 * - 환경 앰비언트 레이어 (바람, 물, 벌레 등)
 * - 게임플레이 피드백 SFX
 * - 상태 기반 적응형 음악 (탐색 → 긴장 → 위기)
 */

// ── 바이옴 오디오 프로필 ──────────────────────────────────────────
const BIOME_PROFILES = {
  // 스테이지 1-3: 여름 공원 — 밝고 따뜻한 탐색
  park: {
    scale:    [261.63, 293.66, 329.63, 392.00, 440.00, 523.25], // C major pentatonic
    tempo:    72,
    padFreq:  180,
    padType:  'sine',
    padColor: 1200,   // lowpass Hz
    ambience: 'park', // 새소리 + 바람
    mood:     'warm',
    reverbAmt: 0.18,
  },
  // 스테이지 4-5: 연못/습지 — 신비롭고 촉촉한
  pond: {
    scale:    [220.00, 246.94, 277.18, 329.63, 369.99], // A minor pentatonic
    tempo:    58,
    padFreq:  110,
    padType:  'triangle',
    padColor: 700,
    ambience: 'water',
    mood:     'mysterious',
    reverbAmt: 0.35,
  },
  // 스테이지 6-8: 바다 — 광활하고 깊은
  ocean: {
    scale:    [174.61, 196.00, 220.00, 261.63, 293.66], // F major pentatonic
    tempo:    48,
    padFreq:  87,
    padType:  'sine',
    padColor: 500,
    ambience: 'ocean',
    mood:     'vast',
    reverbAmt: 0.55,
  },
  // 스테이지 9-10: 사바나 — 건조하고 긴장된
  savanna: {
    scale:    [146.83, 164.81, 185.00, 220.00, 246.94], // D Dorian
    tempo:    88,
    padFreq:  146,
    padType:  'sawtooth',
    padColor: 900,
    ambience: 'savanna',
    mood:     'tense',
    reverbAmt: 0.2,
  },
  // 스테이지 11-12: 숲 — 어둡고 울창한
  forest: {
    scale:    [130.81, 155.56, 174.61, 196.00, 233.08], // C minor pentatonic
    tempo:    52,
    padFreq:  65,
    padType:  'triangle',
    padColor: 600,
    ambience: 'forest',
    mood:     'eerie',
    reverbAmt: 0.45,
  },
  // 스테이지 13-14: 공룡섬 — 극적이고 원시적
  dino: {
    scale:    [110.00, 123.47, 146.83, 164.81, 185.00], // A Phrygian
    tempo:    96,
    padFreq:  55,
    padType:  'sawtooth',
    padColor: 1400,
    ambience: 'prehistoric',
    mood:     'dramatic',
    reverbAmt: 0.3,
  },
  // 스테이지 15: 우주 — 광막하고 고요한
  space: {
    scale:    [55.00, 73.42, 98.00, 130.81, 196.00], // 광음정
    tempo:    38,
    padFreq:  27.5,
    padType:  'sine',
    padColor: 400,
    ambience: 'space',
    mood:     'void',
    reverbAmt: 0.7,
  },
};

function getBiomeKey(stageId) {
  if (stageId <= 3)  return 'park';
  if (stageId <= 5)  return 'pond';
  if (stageId <= 8)  return 'ocean';
  if (stageId <= 10) return 'savanna';
  if (stageId <= 12) return 'forest';
  if (stageId <= 14) return 'dino';
  return 'space';
}

// ── 임펄스 응답 생성 (알고리즘 리버브) ───────────────────────────
function makeReverb(ctx, duration = 2.0, decay = 2.5) {
  const len = Math.ceil(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

// ── ADSR 엔벨로프 헬퍼 ──────────────────────────────────────────
function adsr(gainNode, ctx, { a = 0.01, d = 0.1, s = 0.6, r = 0.3, peak = 1 } = {}, startTime) {
  const g = gainNode.gain;
  const t = startTime ?? ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + a);
  g.linearRampToValueAtTime(peak * s, t + a + d);
  return t + a + d; // sustain start
}

function release(gainNode, ctx, r = 0.3, startTime) {
  const t = startTime ?? ctx.currentTime;
  gainNode.gain.cancelScheduledValues(t);
  gainNode.gain.setValueAtTime(gainNode.gain.value, t);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + r);
}

// ═══════════════════════════════════════════════════════════════════
export class AudioManager {
  constructor() {
    this._ctx    = null;
    this._ready  = false;

    // 마스터 체인
    this._master      = null;
    this._musicGain   = null;  // 0.0 ~ 1.0
    this._ambGain     = null;
    this._sfxGain     = null;
    this._reverb      = null;
    this._reverbSend  = null;

    // 현재 상태
    this._biomeKey    = null;
    this._profile     = null;
    this._state       = 'menu'; // menu | exploration | tension | danger

    // 음악 노드들 (정리용)
    this._melodyNodes  = [];
    this._padNodes     = [];
    this._ambNodes     = [];
    this._melodyTimer  = null;
    this._seqStep      = 0;

    // 볼륨 설정
    this.masterVolume  = 1.0;
    this.musicVolume   = 0.38;
    this.ambientVolume = 0.28;
    this.sfxVolume     = 0.65;

    this._muted = false;
  }

  // ── 초기화 (첫 유저 인터랙션 시 호출) ──────────────────────────
  init() {
    if (this._ready) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      console.warn('[Audio] Web Audio API 미지원');
      return;
    }

    // 마스터 컴프레서 → 출력
    const comp = this._ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value     = 4;
    comp.attack.value    = 0.003;
    comp.release.value   = 0.25;
    comp.connect(this._ctx.destination);

    this._master = this._ctx.createGain();
    this._master.gain.value = 1.0;
    this._master.connect(comp);

    this._musicGain = this._ctx.createGain();
    this._musicGain.gain.value = this.musicVolume;
    this._musicGain.connect(this._master);

    this._ambGain = this._ctx.createGain();
    this._ambGain.gain.value = this.ambientVolume;
    this._ambGain.connect(this._master);

    this._sfxGain = this._ctx.createGain();
    this._sfxGain.gain.value = this.sfxVolume;
    this._sfxGain.connect(this._master);

    // 공유 리버브
    this._reverb = makeReverb(this._ctx, 2.2, 2.8);
    this._reverb.connect(this._master);
    this._reverbSend = this._ctx.createGain();
    this._reverbSend.gain.value = 0.2;
    this._reverbSend.connect(this._reverb);

    this._ready = true;
  }

  // ── 바이옴 전환 ─────────────────────────────────────────────────
  setBiome(stageId) {
    if (!this._ready) this.init();
    if (!this._ready) return;
    const key = getBiomeKey(stageId);
    if (key === this._biomeKey) return;
    this._biomeKey = key;
    this._profile  = BIOME_PROFILES[key];
    this._seqStep  = 0;
    this._crossfadeTo(key);
  }

  _crossfadeTo(key) {
    // 기존 음악 페이드아웃 + 앰비언트 페이드아웃
    this._fadeOutCurrent(0.8, () => {
      this._stopAllMusic();
      this._stopAllAmbient();
      this._startMusic();
      this._startAmbient();
    });
  }

  _fadeOutCurrent(dur, cb) {
    if (!this._ready) { cb?.(); return; }
    const g = this._musicGain.gain;
    g.cancelScheduledValues(this._ctx.currentTime);
    g.setValueAtTime(g.value, this._ctx.currentTime);
    g.linearRampToValueAtTime(0, this._ctx.currentTime + dur);
    setTimeout(cb, dur * 1000);
  }

  _fadeInMusic(dur = 1.5) {
    if (!this._ready) return;
    const g = this._musicGain.gain;
    g.cancelScheduledValues(this._ctx.currentTime);
    g.setValueAtTime(0, this._ctx.currentTime);
    g.linearRampToValueAtTime(this.musicVolume, this._ctx.currentTime + dur);
  }

  // ── 음악: 패드 + 멜로디 시퀀서 ─────────────────────────────────
  _startMusic() {
    if (!this._profile) return;
    this._startPad();
    this._scheduleMelody();
    this._fadeInMusic(1.5);
  }

  /** 드론/패드 — 지속적인 화음 기반 텍스처 */
  _startPad() {
    const p   = this._profile;
    const ctx = this._ctx;
    const root = p.padFreq;

    // 3성부 화음 (근음 + 5도 + 옥타브)
    const freqs = [root, root * 1.498, root * 2]; // 근음, 완전5도, 옥타브
    const gains = [0.18, 0.10, 0.07];

    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const env  = ctx.createGain();
      const filt = ctx.createBiquadFilter();

      osc.type = p.padType;
      osc.frequency.value = freq;

      // LFO로 미세 비브라토 (생동감)
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.15 + i * 0.07;
      lfoG.gain.value = freq * 0.003;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      lfo.start();

      filt.type = 'lowpass';
      filt.frequency.value = p.padColor;
      filt.Q.value = 0.8;

      env.gain.value = gains[i];
      osc.connect(filt);
      filt.connect(env);
      env.connect(this._musicGain);
      // 리버브 센드
      env.connect(this._reverbSend);

      osc.start();
      this._padNodes.push(osc, env, filt, lfo, lfoG);
    });
  }

  /** 멜로디 시퀀서 — 스케일 기반 아르페지오 */
  _scheduleMelody() {
    if (!this._profile) return;
    const p   = this._profile;
    const ctx = this._ctx;
    const bps = p.tempo / 60;       // beats per second
    const interval = (60 / p.tempo) * 1000; // ms per beat

    const playNote = () => {
      if (!this._ready || !this._profile) return;
      const now   = ctx.currentTime;
      const scale = p.scale;

      // 음악적 패턴: 4분의 3박자로 무작위 선택 (단조로움 방지)
      const noteIdx = this._getNextNoteIdx(scale.length);
      const octave  = Math.random() > 0.7 ? 2 : 1; // 30%확률 옥타브 업
      const freq    = scale[noteIdx] * octave;
      const dur     = (60 / p.tempo) * (Math.random() > 0.6 ? 2 : 1); // 2배 길이 변화

      this._playMelodyNote(freq, now, dur);

      this._melodyTimer = setTimeout(playNote, interval * (Math.random() > 0.4 ? 1 : 2));
    };

    // 첫 박자 딜레이
    this._melodyTimer = setTimeout(playNote, 600);
  }

  _notePattern = [0, 2, 4, 2, 1, 3, 0, 4]; // 순환 패턴 (단조로움 방지)
  _patternPos  = 0;

  _getNextNoteIdx(scaleLen) {
    // 가중치: 저음 쪽 더 자주 (안정적인 느낌)
    if (Math.random() < 0.25) return Math.floor(Math.random() * scaleLen);
    const i = this._patternPos % this._notePattern.length;
    this._patternPos++;
    return this._notePattern[i] % scaleLen;
  }

  _playMelodyNote(freq, time, duration) {
    const ctx  = this._ctx;
    const osc  = ctx.createOscillator();
    const env  = ctx.createGain();
    const filt = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.value = freq;
    filt.type = 'lowpass';
    filt.frequency.value = 3000;

    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.22, time + 0.015);
    env.gain.exponentialRampToValueAtTime(0.08, time + duration * 0.5);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.1);

    osc.connect(filt);
    filt.connect(env);
    env.connect(this._musicGain);
    env.connect(this._reverbSend);

    osc.start(time);
    osc.stop(time + duration + 0.2);

    const node = { osc, env, filt };
    this._melodyNodes.push(node);
    // 일정 시간 후 자동 정리
    setTimeout(() => {
      const i = this._melodyNodes.indexOf(node);
      if (i !== -1) this._melodyNodes.splice(i, 1);
    }, (duration + 0.5) * 1000);
  }

  // ── 앰비언트 레이어 ─────────────────────────────────────────────
  _startAmbient() {
    const type = this._profile?.ambience;
    if (!type) return;

    switch (type) {
      case 'park':       this._ambPark();       break;
      case 'water':      this._ambWater();      break;
      case 'ocean':      this._ambOcean();      break;
      case 'savanna':    this._ambSavanna();    break;
      case 'forest':     this._ambForest();     break;
      case 'prehistoric':this._ambPrehistoric();break;
      case 'space':      this._ambSpace();      break;
    }
  }

  /** 공원: 바람 + 새 + 나뭇잎 */
  _ambPark() {
    // 부드러운 바람 (밴드패스 노이즈)
    this._addWindLayer(0.12, 400, 200);
    // 새소리 시뮬레이션 (짧은 FM 버스트)
    this._scheduleBirdSongs();
  }

  /** 연못: 물 + 개구리 */
  _ambWater() {
    this._addWaterLayer(0.18);
    this._scheduleFrogCalls();
  }

  /** 바다: 파도 + 갈매기 */
  _ambOcean() {
    this._addWaveLayer(0.25);
  }

  /** 사바나: 건조한 바람 + 귀뚜라미 */
  _ambSavanna() {
    this._addWindLayer(0.08, 600, 400);
    this._addCricketLayer(0.09);
  }

  /** 숲: 두꺼운 벌레 소리 + 나무 삐걱임 */
  _ambForest() {
    this._addCricketLayer(0.18);
    this._addWindLayer(0.06, 300, 100);
  }

  /** 공룡섬: 낮은 드론 + 화산 럼블 */
  _ambPrehistoric() {
    this._addDroneLayer(55, 0.12);
    this._addRumbleLayer(0.08);
  }

  /** 우주: 거의 무음 + 매우 낮은 전자 허밍 */
  _ambSpace() {
    this._addDroneLayer(27.5, 0.06);
  }

  // ── 앰비언트 생성기들 ──────────────────────────────────────────

  _addWindLayer(vol, centerHz = 500, bwHz = 300) {
    const ctx    = this._ctx;
    const buf    = this._makeNoiseBuffer(3);
    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    src.loop     = true;

    const filt   = ctx.createBiquadFilter();
    filt.type    = 'bandpass';
    filt.frequency.value = centerHz;
    filt.Q.value = centerHz / bwHz;

    // LFO로 바람 세기 변화
    const lfo  = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoG.gain.value     = vol * 0.4;

    const env  = ctx.createGain();
    env.gain.value = vol;

    lfo.connect(lfoG);
    lfoG.connect(env.gain);
    src.connect(filt);
    filt.connect(env);
    env.connect(this._ambGain);
    lfo.start(); src.start();

    this._ambNodes.push(src, filt, env, lfo, lfoG);
  }

  _addWaterLayer(vol) {
    const ctx  = this._ctx;
    const buf  = this._makeNoiseBuffer(4);
    const src  = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;

    const filt = ctx.createBiquadFilter();
    filt.type  = 'lowpass';
    filt.frequency.value = 800;

    // 물결 LFO
    const lfo  = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.3;
    lfoG.gain.value     = vol * 0.35;

    const env = ctx.createGain();
    env.gain.value = vol;
    lfo.connect(lfoG); lfoG.connect(env.gain);
    src.connect(filt); filt.connect(env);
    env.connect(this._ambGain);
    lfo.start(); src.start();
    this._ambNodes.push(src, filt, env, lfo, lfoG);
  }

  _addWaveLayer(vol) {
    const ctx  = this._ctx;
    const buf  = this._makeNoiseBuffer(5);
    const src  = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;

    const filt = ctx.createBiquadFilter();
    filt.type  = 'lowpass';
    filt.frequency.value = 600;

    // 파도 리듬 LFO (느린 주기)
    const lfo  = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoG.gain.value     = vol * 0.6;

    const env = ctx.createGain(); env.gain.value = vol;
    lfo.connect(lfoG); lfoG.connect(env.gain);
    src.connect(filt); filt.connect(env);
    env.connect(this._ambGain);
    env.connect(this._reverbSend);
    lfo.start(); src.start();
    this._ambNodes.push(src, filt, env, lfo, lfoG);
  }

  _addCricketLayer(vol) {
    // 귀뚜라미: 고주파 주기적 버즈 (4kHz 근처)
    const ctx  = this._ctx;
    const osc  = ctx.createOscillator();
    osc.type   = 'square';
    osc.frequency.value = 4200;

    const filt = ctx.createBiquadFilter();
    filt.type  = 'bandpass';
    filt.frequency.value = 4200;
    filt.Q.value = 20;

    // 귀뚜라미 리듬 LFO (초당 약 3번 울음)
    const lfo  = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.type   = 'square';
    lfo.frequency.value = 3.0;
    lfoG.gain.value     = vol;

    const env = ctx.createGain(); env.gain.value = 0;
    lfo.connect(lfoG); lfoG.connect(env.gain);
    osc.connect(filt); filt.connect(env);
    env.connect(this._ambGain);
    lfo.start(); osc.start();
    this._ambNodes.push(osc, filt, env, lfo, lfoG);
  }

  _addDroneLayer(freq, vol) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.value = freq;
    const env = ctx.createGain(); env.gain.value = vol;
    osc.connect(env); env.connect(this._ambGain);
    env.connect(this._reverbSend);
    osc.start();
    this._ambNodes.push(osc, env);
  }

  _addRumbleLayer(vol) {
    const ctx  = this._ctx;
    const buf  = this._makeNoiseBuffer(2);
    const src  = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type  = 'lowpass';
    filt.frequency.value = 120;
    const env  = ctx.createGain(); env.gain.value = vol;
    src.connect(filt); filt.connect(env);
    env.connect(this._ambGain);
    src.start();
    this._ambNodes.push(src, filt, env);
  }

  /** 새소리 버스트 스케줄러 */
  _scheduleBirdSongs() {
    const play = () => {
      if (!this._ready) return;
      const ctx  = this._ctx;
      const now  = ctx.currentTime;
      const freq = 1200 + Math.random() * 1600; // 고음 새소리 범위

      const osc  = ctx.createOscillator();
      osc.type   = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.9, now + 0.12);

      const env  = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.06, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(env); env.connect(this._ambGain);
      osc.start(now); osc.stop(now + 0.25);

      // 2~6초 뒤 다음 새소리
      const t = (2000 + Math.random() * 4000);
      this._ambNodes.push({ _birdTimeout: setTimeout(play, t) });
    };
    setTimeout(play, 1500);
  }

  /** 개구리 소리 스케줄러 */
  _scheduleFrogCalls() {
    const play = () => {
      if (!this._ready) return;
      const ctx = this._ctx;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type  = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.08);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.04, now + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      const filt = ctx.createBiquadFilter();
      filt.type  = 'bandpass'; filt.frequency.value = 200; filt.Q.value = 3;

      osc.connect(filt); filt.connect(env); env.connect(this._ambGain);
      osc.start(now); osc.stop(now + 0.15);

      setTimeout(play, 1200 + Math.random() * 3000);
    };
    setTimeout(play, 2000);
  }

  /** 화이트 노이즈 버퍼 생성 */
  _makeNoiseBuffer(seconds = 3) {
    const len = this._ctx.sampleRate * seconds;
    const buf = this._ctx.createBuffer(1, len, this._ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── 정리 ─────────────────────────────────────────────────────────
  _stopAllMusic() {
    clearTimeout(this._melodyTimer);
    this._melodyNodes.forEach(n => {
      try { n.osc?.stop(); } catch {}
    });
    this._padNodes.forEach(n => {
      try { n.stop?.(); } catch {}
      try { n.disconnect(); } catch {}
    });
    this._melodyNodes = [];
    this._padNodes    = [];
  }

  _stopAllAmbient() {
    this._ambNodes.forEach(n => {
      if (n._birdTimeout) { clearTimeout(n._birdTimeout); return; }
      try { n.stop?.(); } catch {}
      try { n.disconnect(); } catch {}
    });
    this._ambNodes = [];
  }

  // ═══════════════════════════════════════════════════════════════
  // ── SFX ────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════

  /** 포획 성공 — 상승 아르페지오 + 반짝임 */
  sfxCaptureSuccess() {
    if (!this._ready) return;
    const ctx  = this._ctx;
    const now  = ctx.currentTime;
    const root = this._profile?.scale[0] ?? 261.63;

    // 3음 상승 아르페지오
    [root * 2, root * 2.5, root * 3].forEach((freq, i) => {
      const t   = now + i * 0.07;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type  = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.35, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(env); env.connect(this._sfxGain);
      osc.start(t); osc.stop(t + 0.35);
    });

    // 반짝이는 고음 shimmer
    const shimmer = ctx.createOscillator();
    const shEnv   = ctx.createGain();
    shimmer.type  = 'triangle';
    shimmer.frequency.value = root * 6;
    shEnv.gain.setValueAtTime(0, now + 0.12);
    shEnv.gain.linearRampToValueAtTime(0.12, now + 0.15);
    shEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    shimmer.connect(shEnv); shEnv.connect(this._sfxGain);
    shimmer.start(now + 0.12); shimmer.stop(now + 0.5);
  }

  /** 포획 실패 — 짧은 하강음 */
  sfxCaptureFail() {
    if (!this._ready) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
    env.gain.setValueAtTime(0.2, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(env); env.connect(this._sfxGain);
    osc.start(now); osc.stop(now + 0.25);
  }

  /** 피격 — 둔탁한 임팩트 */
  sfxDamage() {
    if (!this._ready) return;
    const ctx  = this._ctx;
    const now  = ctx.currentTime;

    // 로우 임팩트
    const osc  = ctx.createOscillator();
    const env  = ctx.createGain();
    const dist = ctx.createWaveShaper();
    osc.type   = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    // 소프트 클리핑
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = x / (1 + Math.abs(x) * 3);
    }
    dist.curve = curve;
    env.gain.setValueAtTime(0.5, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(dist); dist.connect(env); env.connect(this._sfxGain);
    osc.start(now); osc.stop(now + 0.25);

    // 잡음 타격감
    const buf = this._makeNoiseBuffer(0.1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type  = 'lowpass'; filt.frequency.value = 300;
    const nEnv = ctx.createGain(); nEnv.gain.value = 0.3;
    nEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(filt); filt.connect(nEnv); nEnv.connect(this._sfxGain);
    src.start(now); src.stop(now + 0.2);
  }

  /** 스테이지 클리어 — 팡파레 */
  sfxStageComplete() {
    if (!this._ready) return;
    const ctx  = this._ctx;
    const now  = ctx.currentTime;
    const root = this._profile?.scale[0] ?? 261.63;

    // 4음 상승 팡파레
    const melody = [root, root * 1.25, root * 1.5, root * 2];
    melody.forEach((freq, i) => {
      const t   = now + i * 0.12;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type  = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.4, t + 0.03);
      env.gain.linearRampToValueAtTime(0.25, t + 0.15);
      env.gain.exponentialRampToValueAtTime(0.001, t + (i === 3 ? 0.8 : 0.25));
      osc.connect(env); env.connect(this._sfxGain);
      env.connect(this._reverbSend);
      osc.start(t); osc.stop(t + 1.0);
    });
  }

  /** 스테이지 실패 — 하강 음울한 코드 */
  sfxStageFail() {
    if (!this._ready) return;
    const ctx  = this._ctx;
    const now  = ctx.currentTime;
    const root = this._profile?.scale[0] ?? 220;

    [root * 1.5, root * 1.2, root].forEach((freq, i) => {
      const t   = now + i * 0.18;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type  = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.28, t + 0.04);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(env); env.connect(this._sfxGain);
      osc.start(t); osc.stop(t + 0.8);
    });
  }

  /** 웨이브 완료 알림음 */
  sfxWaveComplete() {
    if (!this._ready) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.1);
    env.gain.setValueAtTime(0.2, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(env); env.connect(this._sfxGain);
    osc.start(now); osc.stop(now + 0.4);
  }

  /** UI 클릭음 */
  sfxUIClick() {
    if (!this._ready) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type  = 'sine';
    osc.frequency.value = 1200;
    env.gain.setValueAtTime(0.08, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(env); env.connect(this._sfxGain);
    osc.start(now); osc.stop(now + 0.08);
  }

  /** 콤보 증가음 (콤보 숫자에 따라 높아짐) */
  sfxCombo(comboCount) {
    if (!this._ready) return;
    const ctx  = this._ctx;
    const now  = ctx.currentTime;
    const freq = 440 * Math.pow(1.06, Math.min(comboCount, 20));
    const osc  = ctx.createOscillator();
    const env  = ctx.createGain();
    osc.type   = 'sine';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.18, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(env); env.connect(this._sfxGain);
    osc.start(now); osc.stop(now + 0.15);
  }

  // ── 게임 상태 전환 ──────────────────────────────────────────────
  setState(state) {
    if (this._state === state) return;
    this._state = state;
    if (!this._ready) return;

    const ctx = this._ctx;
    switch (state) {
      case 'exploration':
        this._musicGain.gain.linearRampToValueAtTime(this.musicVolume, ctx.currentTime + 1.5);
        this._ambGain.gain.linearRampToValueAtTime(this.ambientVolume, ctx.currentTime + 1.0);
        break;
      case 'tension':
        // 음악 약간 낮추고 앰비언트 강조
        this._musicGain.gain.linearRampToValueAtTime(this.musicVolume * 0.7, ctx.currentTime + 2.0);
        this._ambGain.gain.linearRampToValueAtTime(this.ambientVolume * 1.4, ctx.currentTime + 1.5);
        break;
      case 'menu':
      case 'pause':
        this._musicGain.gain.linearRampToValueAtTime(this.musicVolume * 0.3, ctx.currentTime + 0.8);
        this._ambGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        break;
    }
  }

  // ── 볼륨 제어 ────────────────────────────────────────────────────
  setMasterVolume(v) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (!this._ready || !this._master) return;
    // 음소거 중이면 실제 게인은 건드리지 않음 (음소거 해제 시 반영)
    if (!this._muted) {
      this._master.gain.linearRampToValueAtTime(this.masterVolume, this._ctx.currentTime + 0.15);
    }
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (!this._ready || !this._musicGain) return;
    this._musicGain.gain.linearRampToValueAtTime(this.musicVolume, this._ctx.currentTime + 0.15);
  }

  setAmbientVolume(v) {
    this.ambientVolume = Math.max(0, Math.min(1, v));
    if (!this._ready || !this._ambGain) return;
    this._ambGain.gain.linearRampToValueAtTime(this.ambientVolume, this._ctx.currentTime + 0.15);
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (!this._ready || !this._sfxGain) return;
    this._sfxGain.gain.linearRampToValueAtTime(this.sfxVolume, this._ctx.currentTime + 0.15);
  }

  // ── 음소거 토글 ──────────────────────────────────────────────────
  toggleMute() {
    this._muted = !this._muted;
    if (!this._ready) return;
    this._master.gain.linearRampToValueAtTime(
      this._muted ? 0 : 1.0,
      this._ctx.currentTime + 0.3
    );
    return this._muted;
  }

  // ── 정리 ────────────────────────────────────────────────────────
  dispose() {
    this._stopAllMusic();
    this._stopAllAmbient();
    try { this._ctx?.close(); } catch {}
    this._ready = false;
  }
}

// 싱글턴
export const audioManager = new AudioManager();
