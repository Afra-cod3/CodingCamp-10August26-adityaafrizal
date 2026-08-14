(function () {
  'use strict';

  // ─── Event Bus ───────────────────────────────────────────────
  const EventBus = {};

  // ─── UI Helpers ──────────────────────────────────────────────
  const UIHelpers = {};

  // ─── Storage Manager ─────────────────────────────────────────
  const StorageManager = {};

  // ─── Widgets ─────────────────────────────────────────────────
  const GreetingWidget = {};

  const TimerWidget = {};

  const TodoWidget = {};

  const QuickLinksWidget = {};

  // ─── Bootstrap ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    GreetingWidget.init(document.getElementById('greeting-widget'));
    TimerWidget.init(document.getElementById('timer-widget'));
    TodoWidget.init(document.getElementById('todo-widget'));
    QuickLinksWidget.init(document.getElementById('quicklinks-widget'));
  });

})();
