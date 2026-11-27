(function () {
  const dot = document.getElementById('notificationDot');
  if (!dot || typeof window.io !== 'function') return;

  const currentUserId = Number(dot.dataset.userId);
  const activeNav = dot.dataset.activeNav || '';
  if (!currentUserId || activeNav === 'notifications') return;

  const socket = window.__skillswapSocket || (window.__skillswapSocket = window.io());
  socket.on('chat:message', (msg) => {
    if (msg && Number(msg.receiverId) === currentUserId && Number(msg.senderId) !== currentUserId) {
      dot.classList.remove('hidden');
    }
  });
})();
