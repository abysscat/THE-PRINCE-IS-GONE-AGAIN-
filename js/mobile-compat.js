/* Mobile browser gesture guard. Does not block ordinary one-finger interaction or modal scrolling. */
(() => {
  const preventGesture = (event) => {
    if (event.cancelable) event.preventDefault();
  };

  // Safari exposes proprietary gesture events for pinch zoom.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
    document.addEventListener(type, preventGesture, { passive: false });
  });

  // Stop multi-touch pinch gestures even on mobile browsers that ignore viewport scale limits.
  document.addEventListener('touchstart', (event) => {
    if (event.touches && event.touches.length > 1) preventGesture(event);
  }, { passive: false });
  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) preventGesture(event);
  }, { passive: false });

  // Prevent desktop-style double-click actions on the game surface without suppressing button clicks.
  document.addEventListener('dblclick', (event) => {
    if (event.target && event.target.closest && event.target.closest('.stage')) {
      preventGesture(event);
    }
  }, { passive: false });
})();
