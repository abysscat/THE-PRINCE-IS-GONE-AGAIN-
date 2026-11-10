/* Editor-only chapter quick start. Normal index.html does not load this file. */
(() => {
  'use strict';
  const titleStart = document.getElementById('titleStart');
  const quickStart = document.getElementById('chapterQuickStart');
  if (!titleStart || !quickStart) return;

  // Normal title-screen Start always begins from Chapter 1.
  // A quick-start click sets a one-shot level override before triggering the same Start flow.
  let requestedStartLevel = null;
  titleStart.addEventListener('click', () => {
    window.GAME_START_LEVEL = requestedStartLevel || 1;
    requestedStartLevel = null;
  }, true);

  quickStart.querySelectorAll('[data-editor-start-level]').forEach(button => {
    button.addEventListener('click', () => {
      const level = Number(button.dataset.editorStartLevel);
      if (![1, 5, 9].includes(level)) return;
      requestedStartLevel = level;
      window.GAME_START_LEVEL = level;
      titleStart.click();
    });
  });
})();
