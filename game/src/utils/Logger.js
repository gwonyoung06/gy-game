/**
 * Logger — 런타임 로그 수집기
 *
 * - console.log / warn / error 를 가로채 원형 버퍼에 저장
 * - window.onerror / unhandledrejection 도 캡처
 * - 오류 발생 시 localStorage 자동 백업
 * - F8 키 → hunters_debug_YYYYMMDD_HHMMSS.txt 다운로드
 * - 게임 내 Ctrl+Shift+L → 오버레이 토글
 */

const MAX_ENTRIES = 600;
const LS_KEY = 'hunters_crash_log';

class Logger {
  constructor() {
    this._buf   = [];   // { t, level, msg }
    this._start = Date.now();
    this._overlayEl = null;
    this._overlayVisible = false;

    this._patchConsole();
    this._patchWindowErrors();
    this._bindKeys();

    this.info('Logger initialized');
  }

  // ── 콘솔 패치 ────────────────────────────────────────────────
  _patchConsole() {
    const orig = {
      log:   console.log.bind(console),
      warn:  console.warn.bind(console),
      error: console.error.bind(console),
    };

    console.log = (...a) => {
      orig.log(...a);
      this._push('log', a);
    };
    console.warn = (...a) => {
      orig.warn(...a);
      this._push('warn', a);
    };
    console.error = (...a) => {
      orig.error(...a);
      this._push('error', a);
      this._autosave();   // 에러 즉시 백업
    };

    this._origConsole = orig;
  }

  // ── 전역 에러 캐치 ────────────────────────────────────────────
  _patchWindowErrors() {
    window.addEventListener('error', e => {
      this._push('CRASH', [`${e.message}`, `  at ${e.filename}:${e.lineno}:${e.colno}`]);
      this._autosave();
    });
    window.addEventListener('unhandledrejection', e => {
      this._push('PROMISE', [String(e.reason)]);
      this._autosave();
    });
  }

  // ── 버퍼에 추가 ───────────────────────────────────────────────
  _push(level, args) {
    const elapsed = ((Date.now() - this._start) / 1000).toFixed(2);
    const msg = args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');

    this._buf.push({ t: elapsed, level, msg });
    if (this._buf.length > MAX_ENTRIES) this._buf.shift();

    // 오버레이가 열려있으면 실시간 갱신
    if (this._overlayVisible) this._updateOverlay();
  }

  // ── 공개 API ──────────────────────────────────────────────────
  info(msg)  { this._push('info',  [msg]); }
  warn(msg)  { this._push('warn',  [msg]); }
  error(msg) { this._push('error', [msg]); this._autosave(); }

  mark(label) {
    this._push('MARK', [`━━━ ${label} ━━━`]);
  }

  // ── localStorage 자동 백업 (최근 200줄만) ─────────────────────
  _autosave() {
    try {
      const lines = this._buf.slice(-200).map(e =>
        `[${e.t}s][${e.level}] ${e.msg}`
      ).join('\n');
      localStorage.setItem(LS_KEY, lines);
    } catch {}
  }

  // ── 파일 다운로드 ─────────────────────────────────────────────
  download() {
    const now  = new Date();
    const pad  = n => String(n).padStart(2, '0');
    const name = `hunters_debug_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.txt`;

    const header = [
      '=== HUNTERS Debug Log ===',
      `Date   : ${now.toLocaleString()}`,
      `URL    : ${location.href}`,
      `UA     : ${navigator.userAgent}`,
      `Entries: ${this._buf.length}`,
      '=========================',
      '',
    ].join('\n');

    const body = this._buf.map(e =>
      `[${e.t.padStart(8)}s] [${e.level.padEnd(7)}] ${e.msg}`
    ).join('\n');

    const blob = new Blob([header + body], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);

    this._push('info', [`로그 다운로드: ${name}`]);
  }

  // ── 인게임 오버레이 ───────────────────────────────────────────
  _createOverlay() {
    const el = document.createElement('div');
    el.id = '_logOverlay';
    el.style.cssText = `
      position:fixed;bottom:0;left:0;right:0;height:220px;
      background:rgba(0,0,0,0.88);color:#0f0;font:11px/1.45 monospace;
      overflow-y:auto;padding:6px 10px;z-index:99999;
      border-top:2px solid #0a0;pointer-events:auto;
    `;
    // 닫기 버튼
    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = 'position:absolute;top:4px;right:8px;background:none;border:none;color:#0f0;font-size:14px;cursor:pointer;';
    close.addEventListener('click', () => this.toggleOverlay());
    el.appendChild(close);

    const content = document.createElement('div');
    content.id = '_logContent';
    el.appendChild(content);
    document.body.appendChild(el);
    this._overlayEl = el;
  }

  _updateOverlay() {
    const content = document.getElementById('_logContent');
    if (!content) return;
    const last40 = this._buf.slice(-40);
    content.textContent = last40.map(e =>
      `[${e.t}s][${e.level}] ${e.msg}`
    ).join('\n');
    // 자동 스크롤
    if (this._overlayEl) this._overlayEl.scrollTop = this._overlayEl.scrollHeight;
  }

  toggleOverlay() {
    if (!this._overlayEl) this._createOverlay();
    this._overlayVisible = !this._overlayVisible;
    this._overlayEl.style.display = this._overlayVisible ? 'block' : 'none';
    if (this._overlayVisible) this._updateOverlay();
  }

  // ── 키 바인딩 ─────────────────────────────────────────────────
  _bindKeys() {
    window.addEventListener('keydown', e => {
      // F8 → 파일 다운로드
      if (e.key === 'F8') {
        e.preventDefault();
        this.download();
      }
      // Ctrl+Shift+L → 오버레이 토글
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        this.toggleOverlay();
      }
    });
  }
}

// 싱글톤 export
export const logger = new Logger();
