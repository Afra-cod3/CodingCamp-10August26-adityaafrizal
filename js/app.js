(function () {
  'use strict';

  // ─── Event Bus ───────────────────────────────────────────────
  const EventBus = (function () {
    // Internal map: event name → array of handlers
    const _handlers = new Map();

    return {
      /**
       * Register a handler for the given event.
       * @param {string} event
       * @param {Function} handler
       */
      on(event, handler) {
        if (!_handlers.has(event)) {
          _handlers.set(event, []);
        }
        _handlers.get(event).push(handler);
      },

      /**
       * Remove a specific handler for the given event.
       * @param {string} event
       * @param {Function} handler
       */
      off(event, handler) {
        if (!_handlers.has(event)) return;
        const filtered = _handlers.get(event).filter(function (h) {
          return h !== handler;
        });
        _handlers.set(event, filtered);
      },

      /**
       * Invoke all handlers registered for the given event, passing data.
       * @param {string} event
       * @param {*} [data]
       */
      emit(event, data) {
        if (!_handlers.has(event)) return;
        // Snapshot the array so handlers added during emit don't run immediately
        _handlers.get(event).slice().forEach(function (h) {
          h(data);
        });
      },
    };
  })();

  /** Named constants for all events used across the app. */
  const Events = {
    TIMER_COMPLETE:   'timer:complete',
    NOTIFICATION_ACK: 'notification:ack',
    STORAGE_ERROR:    'storage:error',
  };

  // ─── UI Helpers ──────────────────────────────────────────────
  const UIHelpers = (function () {
    // Track the previous focus element so we can restore it after modal dismiss
    var _previousFocus = null;
    // Auto-dismiss timer id for storage error toast
    var _storageErrorTimerId = null;

    /**
     * Create an HTMLElement with given tag, attributes, and children.
     * @param {string} tag
     * @param {Object|null} attrs  - key/value pairs; use 'className' for class
     * @param {...(string|HTMLElement)} children
     * @returns {HTMLElement}
     */
    function createElement(tag, attrs) {
      var el = document.createElement(tag);
      if (attrs) {
        Object.keys(attrs).forEach(function (key) {
          var val = attrs[key];
          if (key === 'className') {
            el.className = val;
          } else if (key === 'htmlFor') {
            el.htmlFor = val;
          } else if (typeof val === 'boolean') {
            if (val) el.setAttribute(key, '');
          } else {
            el.setAttribute(key, val);
          }
        });
      }
      // Rest params: children from arguments[2] onward
      for (var i = 2; i < arguments.length; i++) {
        var child = arguments[i];
        if (child == null) continue;
        if (typeof child === 'string' || typeof child === 'number') {
          el.appendChild(document.createTextNode(String(child)));
        } else if (child instanceof HTMLElement || child instanceof Node) {
          el.appendChild(child);
        }
      }
      return el;
    }

    /**
     * Escape HTML special characters to their entities.
     * @param {string} str
     * @returns {string}
     */
    function sanitizeText(str) {
      if (typeof str !== 'string') return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    /**
     * Trap focus inside a container element.
     * Returns a cleanup function to remove the listener.
     * @param {HTMLElement} containerEl
     * @returns {Function} cleanup
     */
    function _trapFocus(containerEl) {
      var focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      function handleKeyDown(e) {
        if (e.key !== 'Tab') return;
        var focusable = Array.prototype.slice.call(
          containerEl.querySelectorAll(focusableSelectors)
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          // Shift+Tab: if focus is on first element, wrap to last
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: if focus is on last element, wrap to first
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      containerEl.addEventListener('keydown', handleKeyDown);
      return function cleanup() {
        containerEl.removeEventListener('keydown', handleKeyDown);
      };
    }

    // Cleanup function for focus trap (stored so dismissNotification can remove it)
    var _focusTrapCleanup = null;

    /**
     * Show the notification modal with a given message.
     * Traps focus inside the modal until dismissed.
     * @param {string} message
     */
    function showNotification(message) {
      var modal = document.getElementById('notification-modal');
      if (!modal) return;

      // Save currently focused element to restore later
      _previousFocus = document.activeElement;

      // Set message text
      var msgEl = document.getElementById('notification-message');
      if (msgEl) {
        msgEl.textContent = message;
      }

      // Ensure dismiss button is wired up (it exists in HTML, just attach handler once)
      var dismissBtn = document.getElementById('notification-dismiss');
      if (dismissBtn && !dismissBtn.dataset.bound) {
        dismissBtn.addEventListener('click', function () {
          dismissNotification();
        });
        dismissBtn.dataset.bound = 'true';
      }

      // Show the modal
      modal.hidden = false;

      // Trap focus inside modal
      if (_focusTrapCleanup) {
        _focusTrapCleanup();
      }
      _focusTrapCleanup = _trapFocus(modal);

      // Move focus into modal (to the dismiss button)
      if (dismissBtn) {
        dismissBtn.focus();
      }
    }

    /**
     * Hide the notification modal and emit NOTIFICATION_ACK.
     */
    function dismissNotification() {
      var modal = document.getElementById('notification-modal');
      if (!modal) return;

      // Remove focus trap
      if (_focusTrapCleanup) {
        _focusTrapCleanup();
        _focusTrapCleanup = null;
      }

      modal.hidden = true;

      // Restore focus to wherever it was before modal opened
      if (_previousFocus && typeof _previousFocus.focus === 'function') {
        _previousFocus.focus();
        _previousFocus = null;
      }

      EventBus.emit(Events.NOTIFICATION_ACK);
    }

    /**
     * Show a toast-style storage error that auto-dismisses after 5 seconds.
     * The user can also close it manually.
     * Uses #storage-banner as the toast container.
     * @param {string} message
     */
    function showStorageError(message) {
      var banner = document.getElementById('storage-banner');
      if (!banner) return;

      // Set message
      var msgSpan = document.getElementById('storage-banner-message');
      if (msgSpan) {
        msgSpan.textContent = message;
      }

      // Wire up dismiss button once
      var dismissBtn = document.getElementById('storage-banner-dismiss');
      if (dismissBtn && !dismissBtn.dataset.bound) {
        dismissBtn.addEventListener('click', function () {
          _hideStorageBanner();
        });
        dismissBtn.dataset.bound = 'true';
      }

      // Show the banner
      banner.hidden = false;

      // Clear any existing auto-dismiss timer
      if (_storageErrorTimerId !== null) {
        clearTimeout(_storageErrorTimerId);
      }

      // Auto-dismiss after 5 seconds
      _storageErrorTimerId = setTimeout(function () {
        _hideStorageBanner();
        _storageErrorTimerId = null;
      }, 5000);
    }

    /**
     * Hide the storage error banner and clear any pending timer.
     */
    function _hideStorageBanner() {
      var banner = document.getElementById('storage-banner');
      if (banner) {
        banner.hidden = true;
      }
      if (_storageErrorTimerId !== null) {
        clearTimeout(_storageErrorTimerId);
        _storageErrorTimerId = null;
      }
    }

    return {
      createElement: createElement,
      sanitizeText: sanitizeText,
      showNotification: showNotification,
      dismissNotification: dismissNotification,
      showStorageError: showStorageError,
    };
  })();

  // ─── Storage Manager ─────────────────────────────────────────
  const StorageManager = (function () {
    /** Unique, stable keys — prefix avoids collision with other apps on the same origin. */
    const KEYS = {
      TODOS: 'tld_todos_v1',
      LINKS: 'tld_links_v1',
      THEME: 'tld_theme_v1',
      POMODORO_DURATION: 'tld_pomodoro_duration_v1',
    };

    /**
     * Generic read helper.
     * 1. getItem in try/catch → null returns []
     * 2. JSON.parse in a separate try/catch → invalid JSON returns [] with a console.warn
     * 3. Validates result is an Array → non-array returns [] with a console.warn
     * @param {string} key
     * @returns {Array}
     */
    function _read(key) {
      var raw;
      try {
        raw = localStorage.getItem(key);
      } catch (e) {
        console.warn('[StorageManager] Could not read key "' + key + '":', e);
        return [];
      }

      if (raw === null) {
        return [];
      }

      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.warn('[StorageManager] Corrupted JSON for key "' + key + '" — ignoring data:', e);
        return [];
      }

      if (!Array.isArray(parsed)) {
        console.warn('[StorageManager] Data for key "' + key + '" is not an array — ignoring data.');
        return [];
      }

      return parsed;
    }

    /**
     * Generic write helper.
     * Serialises items with JSON.stringify, then calls localStorage.setItem — all inside try/catch.
     * @param {string} key
     * @param {Array} items
     * @returns {{ ok: boolean, error?: string }}
     */
    function _write(key, items) {
      try {
        var json = JSON.stringify(items);
        localStorage.setItem(key, json);
        return { ok: true };
      } catch (e) {
        console.warn('[StorageManager] Could not write key "' + key + '":', e);
        return { ok: false, error: e.message };
      }
    }

    return {
      /**
       * Read the stored Todo_Item array.
       * Returns [] when storage is unavailable, key is missing, JSON is corrupt, or value is not an array.
       * @returns {Todo_Item[]}
       */
      readTodos: function () {
        return _read(KEYS.TODOS);
      },

      /**
       * Persist the Todo_Item array to LocalStorage.
       * @param {Todo_Item[]} items
       * @returns {{ ok: boolean, error?: string }}
       */
      writeTodos: function (items) {
        return _write(KEYS.TODOS, items);
      },

      /**
       * Read the stored Link_Item array.
       * Returns [] when storage is unavailable, key is missing, JSON is corrupt, or value is not an array.
       * @returns {Link_Item[]}
       */
      readLinks: function () {
        return _read(KEYS.LINKS);
      },

      /**
       * Persist the Link_Item array to LocalStorage.
       * @param {Link_Item[]} items
       * @returns {{ ok: boolean, error?: string }}
       */
      writeLinks: function (items) {
        return _write(KEYS.LINKS, items);
      },

      /**
       * Read the persisted theme preference ('light' or 'dark').
       * Returns 'light' when not set or unreadable.
       * @returns {'light'|'dark'}
       */
      readTheme: function () {
        var raw;
        try {
          raw = localStorage.getItem(KEYS.THEME);
        } catch (e) {
          return 'light';
        }
        return raw === 'dark' ? 'dark' : 'light';
      },

      /**
       * Persist the theme preference.
       * @param {'light'|'dark'} theme
       * @returns {{ ok: boolean, error?: string }}
       */
      writeTheme: function (theme) {
        try {
          localStorage.setItem(KEYS.THEME, theme);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },

      /**
       * Read the persisted Pomodoro duration in minutes (integer 1–99).
       * Returns 25 when not set, unreadable, or out of range.
       * @returns {number}
       */
      readPomodoroDuration: function () {
        var raw;
        try {
          raw = localStorage.getItem(KEYS.POMODORO_DURATION);
        } catch (e) {
          return 25;
        }
        if (raw === null) return 25;
        var parsed = parseInt(raw, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 99) return 25;
        return parsed;
      },

      /**
       * Persist the Pomodoro duration in minutes.
       * @param {number} minutes
       * @returns {{ ok: boolean, error?: string }}
       */
      writePomodoroDuration: function (minutes) {
        try {
          localStorage.setItem(KEYS.POMODORO_DURATION, String(minutes));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },
    };
  })();

  // ─── Theme Manager ───────────────────────────────────────────
  const ThemeManager = (function () {
    /** @type {'light'|'dark'} */
    var _currentTheme = 'light';

    /** @type {HTMLButtonElement|null} */
    var _toggleBtn = null;
    /** @type {HTMLElement|null} */
    var _iconEl = null;

    /**
     * Apply the given theme to the <html> element and update button label/icon.
     * @param {'light'|'dark'} theme
     */
    function _applyTheme(theme) {
      _currentTheme = theme;
      document.documentElement.setAttribute('data-theme', theme);

      if (_iconEl) {
        _iconEl.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
      if (_toggleBtn) {
        _toggleBtn.setAttribute(
          'aria-label',
          theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'
        );
      }
    }

    return {
      /**
       * Initialise ThemeManager: reads persisted preference and wires the button.
       */
      init: function () {
        _toggleBtn = document.getElementById('theme-toggle');
        _iconEl    = document.getElementById('theme-toggle-icon');

        // Load persisted theme (defaults to 'light')
        var saved = StorageManager.readTheme();
        _applyTheme(saved);

        if (_toggleBtn) {
          _toggleBtn.addEventListener('click', function () {
            var next = _currentTheme === 'light' ? 'dark' : 'light';
            _applyTheme(next);
            StorageManager.writeTheme(next);
          });
        }
      },

      get _currentTheme() { return _currentTheme; },
    };
  })();

  // ─── Widgets ─────────────────────────────────────────────────
  const GreetingWidget = (function () {
    // ── Private state ──────────────────────────────────────────
    /** @type {HTMLElement|null} */
    var _timeEl = null;
    /** @type {HTMLElement|null} */
    var _dateEl = null;
    /** @type {HTMLElement|null} */
    var _greetingEl = null;

    // Cached values to avoid unnecessary DOM writes
    var _lastMinute = -1;
    var _lastGreeting = '';

    // ── Locale data ────────────────────────────────────────────
    var _LOCALE_DAYS = [
      'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
    ];

    var _LOCALE_MONTHS = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    // ── Internal helpers (stubs — fully implemented in task 4.2) ──

    /**
     * Return the greeting string for the given hour (0–23).
     * Fallback: "Halo" when hour is not a valid integer.
     * @param {number} hour
     * @returns {string}
     */
    function _getGreeting(hour) {
      if (typeof hour !== 'number' || isNaN(hour) || !isFinite(hour)) {
        return 'Halo';
      }
      var h = Math.floor(hour);
      if (h >= 5 && h <= 11) return 'Selamat Pagi';
      if (h >= 12 && h <= 14) return 'Selamat Siang';
      if (h >= 15 && h <= 17) return 'Selamat Sore';
      if ((h >= 18 && h <= 23) || (h >= 0 && h <= 4)) return 'Selamat Malam';
      return 'Halo';
    }

    /**
     * Format a Date to "HH:MM" (24-hour, zero-padded).
     * Returns "--:--" for an invalid Date.
     * @param {Date} date
     * @returns {string}
     */
    function _formatTime(date) {
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return '--:--';
      }
      var hh = String(date.getHours()).padStart(2, '0');
      var mm = String(date.getMinutes()).padStart(2, '0');
      return hh + ':' + mm;
    }

    /**
     * Format a Date to "NamaHari, DD NamaBulan YYYY" in Bahasa Indonesia.
     * Returns "--" for an invalid Date.
     * @param {Date} date
     * @returns {string}
     */
    function _formatDate(date) {
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return '--';
      }
      var dayName   = _LOCALE_DAYS[date.getDay()];
      var day       = String(date.getDate()).padStart(2, '0');
      var monthName = _LOCALE_MONTHS[date.getMonth()];
      var year      = date.getFullYear();
      return dayName + ', ' + day + ' ' + monthName + ' ' + year;
    }

    /**
     * Tick handler — called once on init and then every second via setInterval.
     * Updates the DOM only when the minute or greeting changes, to avoid
     * unnecessary reflows.
     */
    function _tick() {
      var now = new Date();
      var timeStr     = _formatTime(now);
      var dateStr     = _formatDate(now);
      var hour        = (now instanceof Date && !isNaN(now.getTime()))
                          ? now.getHours()
                          : NaN;
      var greeting    = _getGreeting(hour);
      var currentMin  = (now instanceof Date && !isNaN(now.getTime()))
                          ? now.getMinutes()
                          : -1;

      // Always update the time display (shows HH:MM — minute is the granularity users see)
      if (_timeEl) {
        _timeEl.textContent = timeStr;
      }

      // Update date and greeting only when the minute or greeting string changes
      if (currentMin !== _lastMinute) {
        if (_dateEl) {
          _dateEl.textContent = dateStr;
        }
        _lastMinute = currentMin;
      }

      if (greeting !== _lastGreeting) {
        if (_greetingEl) {
          _greetingEl.textContent = greeting;
        }
        _lastGreeting = greeting;
      }
    }

    // ── Public API ─────────────────────────────────────────────
    return {
      /**
       * Initialise the GreetingWidget inside the given container element.
       * Builds the DOM structure, performs an immediate tick, then schedules
       * a per-second interval so values stay current.
       *
       * DOM structure created inside containerEl:
       *   <div class="greeting-content">
       *     <p  class="greeting-text">…</p>
       *     <p  class="greeting-time">…</p>
       *     <p  class="greeting-date">…</p>
       *   </div>
       *
       * @param {HTMLElement} containerEl  - The #greeting-widget section element
       */
      init: function (containerEl) {
        if (!containerEl) return;

        // Build inner DOM nodes
        _greetingEl = UIHelpers.createElement('p', { className: 'greeting-text' });
        _timeEl     = UIHelpers.createElement('p', { className: 'greeting-time' });
        _dateEl     = UIHelpers.createElement('p', { className: 'greeting-date' });

        var wrapper = UIHelpers.createElement(
          'div',
          { className: 'greeting-content' },
          _greetingEl,
          _timeEl,
          _dateEl
        );

        containerEl.appendChild(wrapper);

        // Populate immediately so values appear in <1 second (Requirement 1.3)
        _tick();

        // Keep values current; a 1-second interval is sufficient because the
        // display granularity is HH:MM and sapaan boundaries are 1-hour wide.
        setInterval(_tick, 1000);
      },

      // Expose internals for property-based tests (tasks 4.4, 4.5, 4.6)
      _getGreeting:  _getGreeting,
      _formatTime:   _formatTime,
      _formatDate:   _formatDate,
      _tick:         _tick,
      _LOCALE_DAYS:  _LOCALE_DAYS,
      _LOCALE_MONTHS: _LOCALE_MONTHS,
    };
  })();

  const TimerWidget = (function () {
    // ── Private state ──────────────────────────────────────────
    /** @type {'idle'|'running'|'done'} */
    var _state = 'idle';
    /** Duration in minutes (persisted) */
    var _durationMin = 25;
    /** Milliseconds remaining when paused/idle */
    var _remainingMs = _durationMin * 60 * 1000;
    /** Absolute timestamp (ms) when the timer should reach zero */
    var _endTime = null;
    /** setInterval handle */
    var _intervalId = null;

    // DOM refs
    /** @type {HTMLElement|null} */
    var _displayEl = null;
    /** @type {HTMLButtonElement|null} */
    var _startBtn = null;
    /** @type {HTMLButtonElement|null} */
    var _stopBtn = null;
    /** @type {HTMLButtonElement|null} */
    var _resetBtn = null;
    /** @type {HTMLInputElement|null} */
    var _durationInputEl = null;

    // ── Stubs (implemented in tasks 6.2 and 6.3) ──────────────

    /** Start countdown from current _remainingMs */
    function _start() {
      if (_state === 'running') return;
      if (_remainingMs <= 0) return;

      _endTime = Date.now() + _remainingMs;
      _state = 'running';
      _intervalId = setInterval(_tick, 1000);
      _updateButtons();
    }

    /** Pause countdown and preserve remaining time */
    function _stop() {
      if (_state !== 'running') return;

      clearInterval(_intervalId);
      _intervalId = null;
      // Clamp to 0 so remaining never goes negative
      _remainingMs = Math.max(0, _endTime - Date.now());
      _state = 'idle';
      _updateButtons();
    }

    /** Stop and reset to configured duration */
    function _reset() {
      clearInterval(_intervalId);
      _intervalId = null;
      _remainingMs = _durationMin * 60 * 1000;
      _endTime = null;
      _state = 'idle';

      var displayStr = _formatDisplay(_remainingMs);
      var totalMin = _durationMin;
      if (_displayEl) {
        _displayEl.textContent = displayStr;
        _displayEl.setAttribute('datetime', 'PT' + totalMin + 'M');
      }

      _updateButtons();
    }

    /** Called every ~1s while running */
    function _tick() {
      var remaining = _endTime - Date.now();

      if (remaining <= 0) {
        // Show 00:00 before completing
        if (_displayEl) {
          _displayEl.textContent = '00:00';
          _displayEl.setAttribute('datetime', 'PT0S');
        }
        _onComplete();
        return;
      }

      var display = _formatDisplay(Math.max(0, remaining));
      if (_displayEl) {
        _displayEl.textContent = display;
        // Update datetime attribute to reflect remaining seconds
        var totalSec = Math.ceil(remaining / 1000);
        var m = Math.floor(totalSec / 60);
        var s = totalSec % 60;
        _displayEl.setAttribute('datetime', 'PT' + m + 'M' + s + 'S');
      }
    }

    /**
     * Convert milliseconds to "MM:SS" string (zero-padded).
     * Rounds down so 61999ms displays as "01:01".
     * @param {number} ms
     * @returns {string}
     */
    function _formatDisplay(ms) {
      var totalSeconds = Math.floor(ms / 1000);
      var minutes = Math.floor(totalSeconds / 60);
      var seconds = totalSeconds % 60;
      return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }

    /** Called when countdown reaches zero */
    function _onComplete() {
      clearInterval(_intervalId);
      _intervalId = null;
      _remainingMs = 0;
      _state = 'done';
      _updateButtons();
      UIHelpers.showNotification('Sesi fokus ' + _durationMin + ' menit telah selesai. Saatnya beristirahat!');
    }

    /** Sync enabled/disabled state of buttons to current _state */
    function _updateButtons() {
      if (!_startBtn || !_stopBtn || !_resetBtn) return;

      if (_state === 'running') {
        // running: Start=off, Stop=on, Reset=on, duration input=disabled
        _startBtn.disabled = true;
        _stopBtn.disabled  = false;
        _resetBtn.disabled = false;
      } else if (_state === 'done') {
        // done: Start=off, Stop=off, Reset=on, duration input=enabled
        _startBtn.disabled = true;
        _stopBtn.disabled  = true;
        _resetBtn.disabled = false;
      } else {
        // idle: Start=on (only if time remains), Stop=off, Reset=on, duration input=enabled
        _startBtn.disabled = (_remainingMs <= 0);
        _stopBtn.disabled  = true;
        _resetBtn.disabled = false;
      }

      // Duration input is disabled only while timer is running
      if (_durationInputEl) {
        _durationInputEl.disabled = (_state === 'running');
      }
    }

    // ── Public API ─────────────────────────────────────────────
    return {
      /**
       * Initialise the TimerWidget inside the given container element.
       *
       * DOM structure created inside containerEl:
       *   <div class="timer-content">
       *     <time class="timer-display" datetime="PT25M">25:00</time>
       *     <div class="timer-controls">
       *       <button class="timer-btn timer-btn--start">Start</button>
       *       <button class="timer-btn timer-btn--stop">Stop</button>
       *       <button class="timer-btn timer-btn--reset">Reset</button>
       *     </div>
       *   </div>
       *
       * @param {HTMLElement} containerEl  - The #timer-widget section element
       */
      init: function (containerEl) {
        if (!containerEl) return;

        // Load persisted duration (defaults to 25)
        _durationMin = StorageManager.readPomodoroDuration();

        // Reset internal state on (re-)init
        _state = 'idle';
        _remainingMs = _durationMin * 60 * 1000;
        _endTime = null;
        _intervalId = null;

        // ── Build DOM ────────────────────────────────────────

        // Duration input row
        var durationLabelEl = UIHelpers.createElement('label', {
          htmlFor: 'pomodoro-duration',
          className: 'timer-duration__label',
        }, 'Durasi:');

        _durationInputEl = UIHelpers.createElement('input', {
          type: 'number',
          id: 'pomodoro-duration',
          className: 'timer-duration__input',
          min: '1',
          max: '99',
          value: String(_durationMin),
          'aria-label': 'Durasi Pomodoro dalam menit',
        });

        var durationUnitEl = UIHelpers.createElement('span', {
          className: 'timer-duration__unit',
        }, 'menit');

        var durationRowEl = UIHelpers.createElement(
          'div',
          { className: 'timer-duration' },
          durationLabelEl,
          _durationInputEl,
          durationUnitEl
        );

        // Countdown display — initial text reflects loaded duration
        var initialDisplay = _formatDisplay(_remainingMs);
        _displayEl = UIHelpers.createElement('time', {
          className: 'timer-display',
          datetime: 'PT' + _durationMin + 'M',
          'aria-live': 'off',
          'aria-atomic': 'true',
        }, initialDisplay);

        // Control buttons
        _startBtn = UIHelpers.createElement('button', {
          className: 'timer-btn timer-btn--start',
          type: 'button',
          'aria-label': 'Mulai timer',
        }, 'Start');

        _stopBtn = UIHelpers.createElement('button', {
          className: 'timer-btn timer-btn--stop',
          type: 'button',
          'aria-label': 'Hentikan timer',
          disabled: true,
        }, 'Stop');

        _resetBtn = UIHelpers.createElement('button', {
          className: 'timer-btn timer-btn--reset',
          type: 'button',
          'aria-label': 'Reset timer',
        }, 'Reset');

        var controlsEl = UIHelpers.createElement(
          'div',
          { className: 'timer-controls' },
          _startBtn,
          _stopBtn,
          _resetBtn
        );

        var wrapperEl = UIHelpers.createElement(
          'div',
          { className: 'timer-content' },
          durationRowEl,
          _displayEl,
          controlsEl
        );

        containerEl.appendChild(wrapperEl);

        // ── Attach event listeners ───────────────────────────
        _startBtn.addEventListener('click', function () {
          _start();
        });

        _stopBtn.addEventListener('click', function () {
          _stop();
        });

        _resetBtn.addEventListener('click', function () {
          _reset();
        });

        // Duration input: update duration when idle and persist
        _durationInputEl.addEventListener('change', function () {
          if (_state === 'running') return; // safety guard — input is disabled, but just in case
          var val = parseInt(_durationInputEl.value, 10);
          if (isNaN(val) || val < 1) val = 1;
          if (val > 99) val = 99;
          // Clamp and sync input display
          _durationInputEl.value = String(val);
          _durationMin = val;
          _remainingMs = _durationMin * 60 * 1000;

          // Update display immediately
          var displayStr = _formatDisplay(_remainingMs);
          if (_displayEl) {
            _displayEl.textContent = displayStr;
            _displayEl.setAttribute('datetime', 'PT' + _durationMin + 'M');
          }

          StorageManager.writePomodoroDuration(_durationMin);
          _updateButtons();
        });

        // When the user acknowledges the completion notification, reset the timer
        EventBus.on(Events.NOTIFICATION_ACK, function () {
          _reset();
        });

        // Sync button states with the initial idle state
        _updateButtons();
      },

      // Expose internals for property-based tests (tasks 6.5, 6.6)
      _formatDisplay: _formatDisplay,
      _updateButtons: _updateButtons,
      get _state() { return _state; },
      get _remainingMs() { return _remainingMs; },
    };
  })();

  const TodoWidget = (function () {
    // ── Private state ──────────────────────────────────────────
    /** @type {Array<{id: string, title: string, completed: boolean}>} */
    var _items = [];

    /** @type {'name-asc'|'name-desc'|'status'} */
    var _sortOrder = 'status';

    // DOM refs
    /** @type {HTMLInputElement|null} */
    var _inputEl = null;
    /** @type {HTMLUListElement|null} */
    var _listEl = null;
    /** @type {HTMLButtonElement|null} */
    var _addBtn = null;
    /** @type {HTMLParagraphElement|null} */
    var _emptyEl = null;
    /** @type {HTMLElement|null} Inline validation error element, created once and reused */
    var _errorEl = null;
    /** @type {HTMLSelectElement|null} */
    var _sortSelectEl = null;

    // ── Private methods ────────────────────────────────────────

    /**
     * Persist _items to LocalStorage.
     * Shows a storage error banner if the write fails.
     */
    function _persist() {
      var result = StorageManager.writeTodos(_items);
      if (!result.ok) {
        UIHelpers.showStorageError('Gagal menyimpan tugas. Perubahan hanya tersimpan di sesi ini.');
      }
    }

    /**
     * Add a new todo item from the current input value.
     * Validates input: rejects empty/whitespace-only text with an inline error.
     * On success: creates a Todo_Item, pushes to _items, re-renders, clears input, persists.
     */
    function _addTodo() {
      var raw = _inputEl ? _inputEl.value : '';
      var trimmed = raw.trim();

      if (trimmed === '') {
        // Show inline error — create the element once, then reuse it
        if (!_errorEl) {
          _errorEl = UIHelpers.createElement('p', {
            className: 'todo-input__error',
            'aria-live': 'polite',
            role: 'alert',
          });
          // Insert after the add button, inside the input area wrapper
          if (_addBtn && _addBtn.parentNode) {
            _addBtn.parentNode.appendChild(_errorEl);
          }
        }
        _errorEl.textContent = 'Tugas tidak boleh kosong.';
        _errorEl.hidden = false;

        // Keep focus on the input field
        if (_inputEl) {
          _inputEl.focus();
        }
        return;
      }

      // Valid input — clear any existing error
      if (_errorEl) {
        _errorEl.textContent = '';
        _errorEl.hidden = true;
      }

      // Check for duplicate (case-insensitive)
      var trimmedLower = trimmed.toLowerCase();
      var isDuplicate = _items.some(function (i) {
        return i.title.toLowerCase() === trimmedLower;
      });

      if (isDuplicate) {
        if (!_errorEl) {
          _errorEl = UIHelpers.createElement('p', {
            className: 'todo-input__error',
            'aria-live': 'polite',
            role: 'alert',
          });
          if (_addBtn && _addBtn.parentNode) {
            _addBtn.parentNode.appendChild(_errorEl);
          }
        }
        _errorEl.textContent = 'Tugas dengan nama ini sudah ada.';
        _errorEl.hidden = false;
        if (_inputEl) _inputEl.focus();
        return;
      }

      // Generate a unique id
      var id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : (Date.now().toString(36) + Math.random().toString(36).slice(2));

      var newItem = { id: id, title: trimmed, completed: false };
      _items.push(newItem);

      _renderList();

      if (_inputEl) {
        _inputEl.value = '';
      }

      _persist();
    }

    /**
     * Toggle the completed state of a todo item by id.
     * Flips item.completed, updates the DOM styling, persists.
     * Shows a storage error banner if persist fails.
     * @param {string} id
     */
    function _toggleTodo(id) {
      var item = _items.find(function (i) { return i.id === id; });
      if (!item) return;

      item.completed = !item.completed;

      // Update DOM styling for the specific <li> rather than re-rendering the
      // whole list, so focus is not disturbed.
      var li = _listEl ? _listEl.querySelector('[data-id="' + id + '"]') : null;
      if (li) {
        var titleSpan = li.querySelector('.todo-item__title');
        var checkbox  = li.querySelector('.todo-item__checkbox');

        if (item.completed) {
          li.classList.add('todo-item--completed');
          if (titleSpan) titleSpan.classList.add('todo-item__title--completed');
        } else {
          li.classList.remove('todo-item--completed');
          if (titleSpan) titleSpan.classList.remove('todo-item__title--completed');
        }

        // Keep checkbox in sync (in case it was toggled via keyboard/label click)
        if (checkbox) {
          checkbox.checked = item.completed;
        }
      }

      _persist();
    }

    /**
     * Delete a todo item by id.
     * Removes the item from _items, re-renders the list, and persists.
     * Shows a storage error banner if persist fails.
     * @param {string} id
     */
    function _deleteTodo(id) {
      _items = _items.filter(function (i) { return i.id !== id; });
      _renderList();
      _persist();
    }

    /**
     * Enter inline edit mode for the todo item with the given id.
     * Replaces the title <span> with an <input> pre-filled with current text.
     * Wires Enter → save, Escape → cancel.
     * @param {string} id
     */
    function _enterEditMode(id) {
      var item = _items.find(function (i) { return i.id === id; });
      if (!item) return;

      // Prevent entering edit mode if already in edit mode for this item
      var li = _listEl ? _listEl.querySelector('[data-id="' + id + '"]') : null;
      if (!li) return;
      if (li.querySelector('.todo-item__edit-input')) return;

      var titleSpan = li.querySelector('.todo-item__title');
      if (!titleSpan) return;

      // Store the original title so Escape can restore it
      var originalTitle = item.title;

      // Create the edit input
      var editInput = UIHelpers.createElement('input', {
        type: 'text',
        className: 'todo-item__edit-input',
        value: item.title,
        'aria-label': 'Edit tugas: ' + UIHelpers.sanitizeText(item.title),
      });
      // maxlength intentionally not set in HTML — validation is in JS (_exitEditMode)

      // Create (or reuse) an inline error element for edit validation
      var editError = UIHelpers.createElement('span', {
        className: 'todo-item__edit-error',
        role: 'alert',
        'aria-live': 'polite',
      });
      editError.hidden = true;

      // Replace the title span with the edit input (keep span hidden)
      titleSpan.hidden = true;
      titleSpan.parentNode.insertBefore(editInput, titleSpan.nextSibling);
      titleSpan.parentNode.insertBefore(editError, editInput.nextSibling);

      // Disable edit and delete buttons while in edit mode
      var editBtn   = li.querySelector('.todo-item__btn--edit');
      var deleteBtn = li.querySelector('.todo-item__btn--delete');
      if (editBtn)   editBtn.disabled   = true;
      if (deleteBtn) deleteBtn.disabled = true;

      // Move focus to the input
      editInput.focus();
      // Place cursor at end of text
      editInput.setSelectionRange(editInput.value.length, editInput.value.length);

      // Keydown handler: Enter saves, Escape cancels
      function onKeyDown(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          _exitEditMode(id, true, editInput, editError, titleSpan, editBtn, deleteBtn, originalTitle);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          _exitEditMode(id, false, editInput, editError, titleSpan, editBtn, deleteBtn, originalTitle);
        }
      }

      editInput.addEventListener('keydown', onKeyDown);

      // Also wire up a confirm button approach via blur — save on focus loss
      // (Not required by spec, but we need a way to save without keyboard for pointer users.
      //  The edit button itself is now disabled; we rely on Enter/Escape from spec.)
    }

    /**
     * Exit inline edit mode for the todo item with the given id.
     * @param {string} id
     * @param {boolean} save - true to attempt saving, false to cancel (Escape)
     * @param {HTMLInputElement} editInput
     * @param {HTMLElement} editError
     * @param {HTMLElement} titleSpan
     * @param {HTMLButtonElement} editBtn
     * @param {HTMLButtonElement} deleteBtn
     * @param {string} originalTitle
     */
    function _exitEditMode(id, save, editInput, editError, titleSpan, editBtn, deleteBtn, originalTitle) {
      var item = _items.find(function (i) { return i.id === id; });
      if (!item) return;

      if (save) {
        var newText = editInput.value.trim();

        // Reject empty text
        if (newText === '') {
          editError.textContent = 'Teks tugas tidak boleh kosong.';
          editError.hidden = false;
          editInput.focus();
          return;
        }

        // Reject text exceeding 500 characters
        if (newText.length > 500) {
          editError.textContent = 'Teks tugas tidak boleh melebihi 500 karakter.';
          editError.hidden = false;
          editInput.focus();
          return;
        }

        // Reject duplicate (case-insensitive) — ignore the item being edited itself
        var newTextLower = newText.toLowerCase();
        var isDuplicate = _items.some(function (i) {
          return i.id !== id && i.title.toLowerCase() === newTextLower;
        });

        if (isDuplicate) {
          editError.textContent = 'Tugas dengan nama ini sudah ada.';
          editError.hidden = false;
          editInput.focus();
          return;
        }

        // Valid — update the item
        item.title = newText;
        titleSpan.textContent = newText;
        // Keep completed styling
        if (item.completed) {
          titleSpan.classList.add('todo-item__title--completed');
        } else {
          titleSpan.classList.remove('todo-item__title--completed');
        }

        // Persist
        _persist();
      } else {
        // Cancel — restore original text (item.title already correct, just restore span)
        titleSpan.textContent = originalTitle;
      }

      // Tear down edit UI
      if (editInput.parentNode) editInput.parentNode.removeChild(editInput);
      if (editError.parentNode) editError.parentNode.removeChild(editError);

      // Show title span again
      titleSpan.hidden = false;

      // Re-enable buttons
      if (editBtn)   editBtn.disabled   = false;
      if (deleteBtn) deleteBtn.disabled = false;

      // Return focus to the edit button so keyboard users aren't lost
      if (editBtn) editBtn.focus();
    }

    /**
     * Build a single <li> element for the given Todo_Item.
     * Contains: checkbox + label, title span (strikethrough when completed),
     * edit button, delete button.
     * @param {{id: string, title: string, completed: boolean}} item
     * @returns {HTMLLIElement}
     */
    function _renderItem(item) {
      var checkboxId = 'todo-checkbox-' + item.id;

      // ── Checkbox ──────────────────────────────────────────
      // The <label> below is linked via htmlFor/id, which is the primary accessible name.
      // Do NOT add aria-label here — it would conflict with the linked <label> text.
      var checkbox = UIHelpers.createElement('input', {
        type: 'checkbox',
        id: checkboxId,
        className: 'todo-item__checkbox',
      });
      checkbox.checked = item.completed;

      checkbox.addEventListener('change', function () {
        _toggleTodo(item.id);
      });

      // ── Checkbox label ──────────────────────────────────────
      // Connected via htmlFor → id so screen readers announce the todo title when
      // the checkbox receives focus. aria-hidden is intentionally NOT set here.
      var checkboxLabel = UIHelpers.createElement('label', {
        htmlFor: checkboxId,
        className: 'todo-item__checkbox-label',
      });
      checkboxLabel.textContent = item.title;

      // ── Title span ────────────────────────────────────────
      var titleSpan = UIHelpers.createElement('span', {
        className: 'todo-item__title' + (item.completed ? ' todo-item__title--completed' : ''),
      });
      // Use textContent to avoid XSS
      titleSpan.textContent = item.title;

      // ── Edit button ───────────────────────────────────────
      var editBtn = UIHelpers.createElement('button', {
        type: 'button',
        className: 'todo-item__btn todo-item__btn--edit',
        'aria-label': 'Edit tugas: ' + UIHelpers.sanitizeText(item.title),
      }, 'Edit');

      editBtn.addEventListener('click', function () {
        _enterEditMode(item.id);
      });

      // ── Delete button ─────────────────────────────────────
      var deleteBtn = UIHelpers.createElement('button', {
        type: 'button',
        className: 'todo-item__btn todo-item__btn--delete',
        'aria-label': 'Hapus tugas: ' + UIHelpers.sanitizeText(item.title),
      }, 'Hapus');

      deleteBtn.addEventListener('click', function () {
        _deleteTodo(item.id);
      });

      // ── Assemble <li> ─────────────────────────────────────
      var li = UIHelpers.createElement(
        'li',
        {
          className: 'todo-item' + (item.completed ? ' todo-item--completed' : ''),
          'data-id': item.id,
        },
        checkbox,
        checkboxLabel,
        titleSpan,
        editBtn,
        deleteBtn
      );

      return li;
    }

    /**
     * Return a display-only sorted copy of _items based on _sortOrder.
     * Does NOT mutate _items — the canonical order is always _items.
     * @returns {Array<{id: string, title: string, completed: boolean}>}
     */
    function _getSortedItems() {
      var copy = _items.slice();
      if (_sortOrder === 'name-asc') {
        copy.sort(function (a, b) {
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase(), 'id');
        });
      } else if (_sortOrder === 'name-desc') {
        copy.sort(function (a, b) {
          return b.title.toLowerCase().localeCompare(a.title.toLowerCase(), 'id');
        });
      } else {
        // 'status': incomplete first, then completed; within each group keep original order
        copy.sort(function (a, b) {
          return (a.completed === b.completed) ? 0 : (a.completed ? 1 : -1);
        });
      }
      return copy;
    }

    /**
     * Re-render the full list from _items.
     * Shows empty placeholder when there are no items.
     */
    function _renderList() {
      if (!_listEl || !_emptyEl) return;

      // Clear existing list items
      while (_listEl.firstChild) {
        _listEl.removeChild(_listEl.firstChild);
      }

      if (_items.length === 0) {
        _emptyEl.hidden = false;
        _listEl.hidden = true;
      } else {
        _emptyEl.hidden = true;
        _listEl.hidden = false;
        _getSortedItems().forEach(function (item) {
          _listEl.appendChild(_renderItem(item));
        });
      }
    }

    // ── Public API ─────────────────────────────────────────────
    return {
      /**
       * Initialise the TodoWidget inside the given container element.
       * Builds the DOM structure, loads stored todos, and renders the list.
       *
       * DOM structure created inside containerEl (below existing <h2>):
       *   <div class="todo-input-area">
       *     <label for="todo-input">Tambah tugas</label>
       *     <input type="text" id="todo-input" maxlength="200" ...>
       *     <button type="button" ...>Tambah</button>
       *   </div>
       *   <p class="todo-empty">Belum ada tugas…</p>
       *   <ul id="todo-list" aria-label="Daftar tugas">…</ul>
       *
       * @param {HTMLElement} containerEl  - The #todo-widget section element
       */
      init: function (containerEl) {
        if (!containerEl) return;

        // ── Build input area ─────────────────────────────────

        var labelEl = UIHelpers.createElement('label', {
          htmlFor: 'todo-input',
          className: 'todo-input__label',
        }, 'Tambah tugas');

        _inputEl = UIHelpers.createElement('input', {
          type: 'text',
          id: 'todo-input',
          className: 'todo-input__field',
          maxlength: '200',
          placeholder: 'Ketik tugas baru...',
          'aria-label': 'Input tugas baru',
        });

        _addBtn = UIHelpers.createElement('button', {
          type: 'button',
          className: 'todo-input__btn',
          'aria-label': 'Tambah tugas',
        }, 'Tambah');

        var inputAreaEl = UIHelpers.createElement(
          'div',
          { className: 'todo-input-area' },
          labelEl,
          _inputEl,
          _addBtn
        );

        // ── Build sort dropdown ──────────────────────────────

        var sortLabelEl = UIHelpers.createElement('label', {
          htmlFor: 'todo-sort',
          className: 'todo-sort__label',
        }, 'Urutkan:');

        _sortSelectEl = UIHelpers.createElement('select', {
          id: 'todo-sort',
          className: 'todo-sort__select',
          'aria-label': 'Urutkan daftar tugas',
        });

        var sortOptions = [
          { value: 'status',    label: 'Status (belum selesai dulu)' },
          { value: 'name-asc',  label: 'Nama (A \u2192 Z)' },
          { value: 'name-desc', label: 'Nama (Z \u2192 A)' },
        ];

        sortOptions.forEach(function (opt) {
          var optEl = UIHelpers.createElement('option', { value: opt.value }, opt.label);
          if (opt.value === _sortOrder) {
            optEl.selected = true;
          }
          _sortSelectEl.appendChild(optEl);
        });

        var sortRowEl = UIHelpers.createElement(
          'div',
          { className: 'todo-sort' },
          sortLabelEl,
          _sortSelectEl
        );

        // ── Build list area (Todo) ────────────────────────────

        _emptyEl = UIHelpers.createElement('p', {
          className: 'todo-empty',
        }, 'Belum ada tugas. Tambahkan tugas pertama Anda!');

        _listEl = UIHelpers.createElement('ul', {
          id: 'todo-list',
          className: 'todo-list',
          'aria-label': 'Daftar tugas',
        });

        // Append everything below the existing <h2>
        containerEl.appendChild(inputAreaEl);
        containerEl.appendChild(sortRowEl);
        containerEl.appendChild(_emptyEl);
        containerEl.appendChild(_listEl);

        // ── Load from storage ────────────────────────────────
        try {
          _items = StorageManager.readTodos();
          // Ensure we always have a valid array
          if (!Array.isArray(_items)) {
            _items = [];
          }
        } catch (e) {
          // If anything goes wrong, start with an empty list — no crash
          _items = [];
        }

        // ── Render initial state ─────────────────────────────
        _renderList();

        // ── Attach event listeners ───────────────────────────
        _inputEl.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            _addTodo();
          }
        });

        _addBtn.addEventListener('click', function () {
          _addTodo();
        });

        _sortSelectEl.addEventListener('change', function () {
          _sortOrder = _sortSelectEl.value;
          _renderList();
        });
      },

      // Expose internals for property-based tests (tasks 8.6–8.11)
      get _items() { return _items; },
      set _items(val) { _items = val; },
      get _sortOrder() { return _sortOrder; },
      set _sortOrder(val) { _sortOrder = val; },
      _renderList: _renderList,
      _renderItem: _renderItem,
      _addTodo: _addTodo,
      _toggleTodo: _toggleTodo,
      _deleteTodo: _deleteTodo,
      _persist: _persist,
      _enterEditMode: _enterEditMode,
      _exitEditMode: _exitEditMode,
      _getSortedItems: _getSortedItems,
    };
  })();

  const QuickLinksWidget = (function () {
    // ── Private state ──────────────────────────────────────────
    /** @type {Array<{id: string, label: string, url: string}>} */
    var _items = [];

    // DOM refs
    /** @type {HTMLInputElement|null} */
    var _labelInputEl = null;
    /** @type {HTMLInputElement|null} */
    var _urlInputEl = null;
    /** @type {HTMLButtonElement|null} */
    var _addBtn = null;
    /** @type {HTMLElement|null} */
    var _linksContainerEl = null;
    /** @type {HTMLElement|null} */
    var _emptyEl = null;
    /** @type {HTMLElement|null} Inline error for label field */
    var _labelErrorEl = null;
    /** @type {HTMLElement|null} Inline error for url field */
    var _urlErrorEl = null;
    /** @type {HTMLElement|null} General error (e.g. max links reached) */
    var _generalErrorEl = null;

    // ── Private methods ────────────────────────────────────────

    /**
     * Persist _items to LocalStorage.
     * Shows a storage error banner if the write fails.
     */
    function _persist() {
      var result = StorageManager.writeLinks(_items);
      if (!result.ok) {
        UIHelpers.showStorageError('Gagal menyimpan tautan.');
      }
    }

    /**
     * Validate that a URL starts with http:// or https:// (case-insensitive).
     * @param {string} url
     * @returns {boolean}
     */
    function _validateUrl(url) {
      if (typeof url !== 'string') return false;
      return /^https?:\/\//i.test(url);
    }

    /**
     * Show an inline error on the label field.
     * @param {string} message
     */
    function _showLabelError(message) {
      if (!_labelErrorEl) return;
      _labelErrorEl.textContent = message;
      _labelErrorEl.hidden = false;
    }

    /**
     * Show an inline error on the url field.
     * @param {string} message
     */
    function _showUrlError(message) {
      if (!_urlErrorEl) return;
      _urlErrorEl.textContent = message;
      _urlErrorEl.hidden = false;
    }

    /**
     * Show a general error (e.g. max links reached) near the add button.
     * @param {string} message
     */
    function _showGeneralError(message) {
      if (!_generalErrorEl) return;
      _generalErrorEl.textContent = message;
      _generalErrorEl.hidden = false;
    }

    /**
     * Clear all inline validation errors.
     */
    function _clearErrors() {
      if (_labelErrorEl) { _labelErrorEl.textContent = ''; _labelErrorEl.hidden = true; }
      if (_urlErrorEl)   { _urlErrorEl.textContent = '';   _urlErrorEl.hidden = true; }
      if (_generalErrorEl) { _generalErrorEl.textContent = ''; _generalErrorEl.hidden = true; }
    }

    /**
     * Add a new link from the form inputs.
     * Validates label and URL, then creates a Link_Item, persists, and re-renders.
     * Inline errors are shown near their respective fields on validation failure.
     */
    function _addLink() {
      var rawLabel = _labelInputEl ? _labelInputEl.value : '';
      var rawUrl   = _urlInputEl   ? _urlInputEl.value   : '';

      var label = rawLabel.trim();
      var url   = rawUrl.trim();

      // Clear previous errors before re-validating
      _clearErrors();

      var hasError = false;

      // Validate label
      if (label === '') {
        _showLabelError('Label tidak boleh kosong.');
        if (_labelInputEl) _labelInputEl.focus();
        hasError = true;
      }

      // Validate url (empty check first, then format check)
      if (url === '') {
        _showUrlError('URL tidak boleh kosong.');
        if (!hasError && _urlInputEl) _urlInputEl.focus();
        hasError = true;
      } else if (!_validateUrl(url)) {
        _showUrlError('URL harus diawali dengan http:// atau https://');
        if (!hasError && _urlInputEl) _urlInputEl.focus();
        hasError = true;
      }

      if (hasError) return;

      // Check max 20 links
      if (_items.length >= 20) {
        _showGeneralError('Batas maksimum 20 tautan telah tercapai. Hapus tautan lain untuk menambah baru.');
        return;
      }

      // Generate id
      var id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : (Date.now().toString(36) + Math.random().toString(36).slice(2));

      /** @type {{id: string, label: string, url: string}} */
      var newItem = { id: id, label: label, url: url };
      _items.push(newItem);

      // Re-render the links list
      _renderLinks();

      // Clear form inputs
      if (_labelInputEl) _labelInputEl.value = '';
      if (_urlInputEl)   _urlInputEl.value   = '';

      // Persist and surface any storage error
      _persist();
    }

    /**
     * Build a single card element for the given Link_Item.
     * Contains: a clickable label area (opens URL in new tab) with URL subtitle,
     * and a delete button.
     * @param {{id: string, label: string, url: string}} item
     * @returns {HTMLElement}
     */
    function _renderLinkItem(item) {
      // ── Clickable label ────────────────────────────────────
      var labelSpan = UIHelpers.createElement('span', {
        className: 'quicklinks-card__label',
      });
      labelSpan.textContent = item.label;

      // ── URL subtitle (small, truncated visually via CSS) ───
      var urlSpan = UIHelpers.createElement('span', {
        className: 'quicklinks-card__url',
      });
      urlSpan.textContent = item.url;

      // ── Clickable area wrapping label + url ────────────────
      var linkBtn = UIHelpers.createElement('button', {
        type: 'button',
        className: 'quicklinks-card__link',
        'aria-label': 'Buka ' + UIHelpers.sanitizeText(item.label) + ' di tab baru',
      }, labelSpan, urlSpan);

      linkBtn.addEventListener('click', function () {
        window.open(item.url, '_blank', 'noopener,noreferrer');
      });

      // ── Delete button ──────────────────────────────────────
      var deleteBtn = UIHelpers.createElement('button', {
        type: 'button',
        className: 'quicklinks-card__btn--delete',
        'aria-label': 'Hapus tautan: ' + UIHelpers.sanitizeText(item.label),
      }, 'Hapus');

      deleteBtn.addEventListener('click', function (e) {
        // Prevent the click from bubbling to the card's link button
        e.stopPropagation();
        _deleteLink(item.id);
      });

      // ── Assemble card ──────────────────────────────────────
      var card = UIHelpers.createElement('div', {
        role: 'listitem',
        className: 'quicklinks-card',
        'data-id': item.id,
      }, linkBtn, deleteBtn);

      return card;
    }

    /**
     * Delete a link item by id.
     * Removes the item from _items, re-renders the grid, persists, and shows
     * an error banner if the write fails.
     * If _items is empty after deletion, _renderLinks() will display the empty
     * placeholder automatically.
     * @param {string} id
     */
    function _deleteLink(id) {
      _items = _items.filter(function (i) { return i.id !== id; });
      _renderLinks();
      _persist();
    }

    /**
     * Re-render the full links grid from _items.
     * Shows empty placeholder when there are no items.
     */
    function _renderLinks() {
      if (!_linksContainerEl || !_emptyEl) return;

      // Clear existing cards
      while (_linksContainerEl.firstChild) {
        _linksContainerEl.removeChild(_linksContainerEl.firstChild);
      }

      if (_items.length === 0) {
        _emptyEl.hidden = false;
        _linksContainerEl.hidden = true;
      } else {
        _emptyEl.hidden = true;
        _linksContainerEl.hidden = false;
        _items.forEach(function (item) {
          _linksContainerEl.appendChild(_renderLinkItem(item));
        });
      }
    }

    // ── Public API ─────────────────────────────────────────────
    return {
      /**
       * Initialise the QuickLinksWidget inside the given container element.
       * Builds the DOM structure, loads stored links, and renders the list.
       *
       * DOM structure created inside containerEl (below existing <h2>):
       *   <div class="quicklinks-form">
       *     <div class="quicklinks-form__group">
       *       <label for="quicklinks-label-input">Label</label>
       *       <input type="text" id="quicklinks-label-input" maxlength="50" ...>
       *     </div>
       *     <div class="quicklinks-form__group">
       *       <label for="quicklinks-url-input">URL</label>
       *       <input type="text" id="quicklinks-url-input" maxlength="2048" ...>
       *     </div>
       *     <button type="button" ...>Tambah</button>
       *   </div>
       *   <p class="quicklinks-empty">Belum ada tautan…</p>
       *   <div class="quicklinks-grid" role="list" …></div>
       *
       * @param {HTMLElement} containerEl  - The #quicklinks-widget section element
       */
      init: function (containerEl) {
        if (!containerEl) return;

        // ── Build form ───────────────────────────────────────

        var labelLabel = UIHelpers.createElement('label', {
          htmlFor: 'quicklinks-label-input',
          className: 'quicklinks-form__label',
        }, 'Label');

        _labelInputEl = UIHelpers.createElement('input', {
          type: 'text',
          id: 'quicklinks-label-input',
          className: 'quicklinks-form__input',
          maxlength: '50',
          placeholder: 'Nama tautan...',
          'aria-label': 'Label tautan',
        });

        _labelErrorEl = UIHelpers.createElement('span', {
          className: 'quicklinks-form__error',
          role: 'alert',
          'aria-live': 'polite',
        });
        _labelErrorEl.hidden = true;

        var labelGroup = UIHelpers.createElement(
          'div',
          { className: 'quicklinks-form__group' },
          labelLabel,
          _labelInputEl,
          _labelErrorEl
        );

        var urlLabel = UIHelpers.createElement('label', {
          htmlFor: 'quicklinks-url-input',
          className: 'quicklinks-form__label',
        }, 'URL');

        _urlInputEl = UIHelpers.createElement('input', {
          type: 'text',
          id: 'quicklinks-url-input',
          className: 'quicklinks-form__input',
          maxlength: '2048',
          placeholder: 'https://...',
          'aria-label': 'URL tautan',
        });

        _urlErrorEl = UIHelpers.createElement('span', {
          className: 'quicklinks-form__error',
          role: 'alert',
          'aria-live': 'polite',
        });
        _urlErrorEl.hidden = true;

        var urlGroup = UIHelpers.createElement(
          'div',
          { className: 'quicklinks-form__group' },
          urlLabel,
          _urlInputEl,
          _urlErrorEl
        );

        _addBtn = UIHelpers.createElement('button', {
          type: 'button',
          className: 'quicklinks-form__btn',
          'aria-label': 'Tambah tautan',
        }, 'Tambah');

        _generalErrorEl = UIHelpers.createElement('p', {
          className: 'quicklinks-form__error quicklinks-form__error--general',
          role: 'alert',
          'aria-live': 'polite',
        });
        _generalErrorEl.hidden = true;

        var formEl = UIHelpers.createElement(
          'div',
          { className: 'quicklinks-form' },
          labelGroup,
          urlGroup,
          _addBtn,
          _generalErrorEl
        );

        // ── Build list area ──────────────────────────────────

        _emptyEl = UIHelpers.createElement('p', {
          className: 'quicklinks-empty',
        }, 'Belum ada tautan. Tambahkan tautan favorit Anda!');

        _linksContainerEl = UIHelpers.createElement('div', {
          className: 'quicklinks-grid',
          role: 'list',
          'aria-label': 'Daftar tautan cepat',
        });

        // Append everything below the existing <h2>
        containerEl.appendChild(formEl);
        containerEl.appendChild(_emptyEl);
        containerEl.appendChild(_linksContainerEl);

        // ── Load from storage ────────────────────────────────
        try {
          var loaded = StorageManager.readLinks();
          if (!Array.isArray(loaded)) {
            _items = [];
          } else {
            _items = loaded;
          }
        } catch (e) {
          _items = [];
          UIHelpers.showStorageError('Data tautan tidak dapat dimuat.');
        }

        // ── Render initial state ─────────────────────────────
        _renderLinks();

        // ── Attach event listeners ───────────────────────────
        _addBtn.addEventListener('click', function () {
          _addLink();
        });
      },

      // Expose internals for property-based tests (tasks 10.5–10.8)
      get _items() { return _items; },
      set _items(val) { _items = val; },
      _renderLinks: _renderLinks,
      _renderLinkItem: _renderLinkItem,
      _addLink: _addLink,
      _deleteLink: _deleteLink,
      _persist: _persist,
      _validateUrl: _validateUrl,
    };
  })();

  // ─── Bootstrap ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    ThemeManager.init();
    GreetingWidget.init(document.getElementById('greeting-widget'));
    if (typeof TimerWidget.init === 'function') {
      TimerWidget.init(document.getElementById('timer-widget'));
    }
    if (typeof TodoWidget.init === 'function') {
      TodoWidget.init(document.getElementById('todo-widget'));
    }
    if (typeof QuickLinksWidget.init === 'function') {
      QuickLinksWidget.init(document.getElementById('quicklinks-widget'));
    }
  });

})();
