(function () {
  if (typeof window.io !== 'function') return;

  const chatContainer = document.querySelector('[data-purpose="chat-container"]');
  const inboxMain = document.querySelector('[data-purpose="chat-history-main"]');
  if (!chatContainer && !inboxMain) return;

  const socket = window.io();

  if (chatContainer) {
    const currentUserId = Number(chatContainer.dataset.currentUserId);
    const peerId = Number(chatContainer.dataset.peerId);
    const messageHistory = document.getElementById('messageHistory');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatError = document.getElementById('chatError');
    const sendButton = document.getElementById('chatSendBtn');
    const peerStatusDot = document.getElementById('peerStatusDot');
    const peerStatusText = document.getElementById('peerStatusText');

    function scrollToBottom() {
      if (messageHistory) {
        messageHistory.scrollTop = messageHistory.scrollHeight;
      }
    }

    function showError(msg) {
      if (!chatError) return;
      if (msg) {
        chatError.textContent = msg;
        chatError.classList.remove('hidden');
      } else {
        chatError.textContent = '';
        chatError.classList.add('hidden');
      }
    }

    function appendMessageBubble(content, isOwn) {
      if (!messageHistory) return;
      const emptyState = document.getElementById('emptyChatState');
      if (emptyState) emptyState.remove();

      const wrapper = document.createElement('div');
      wrapper.className = isOwn ? 'flex justify-end' : 'flex justify-start';

      const bubble = document.createElement('div');
      bubble.className = isOwn
        ? 'bg-[#0d5db8] text-white px-5 py-3 rounded-2xl shadow-sm text-sm font-normal max-w-md leading-relaxed text-left'
        : 'bg-white text-slate-800 px-5 py-3 rounded-2xl shadow-sm text-sm font-normal max-w-md';
      bubble.textContent = content;

      wrapper.appendChild(bubble);
      messageHistory.appendChild(wrapper);
      scrollToBottom();
    }

    scrollToBottom();

    if (chatForm && chatInput) {
      chatForm.addEventListener('submit', (event) => {
        // Fall back to regular POST /messages if socket is unavailable.
        if (!socket.connected) return;

        event.preventDefault();
        const content = chatInput.value.trim();
        if (!content) {
          showError('Message cannot be empty.');
          return;
        }

        showError('');
        if (sendButton) sendButton.disabled = true;

        socket.emit('chat:send', { receiverId: peerId, content }, (ack) => {
          if (sendButton) sendButton.disabled = false;
          if (!ack || !ack.ok) {
            showError((ack && ack.error) || 'Failed to send message.');
            return;
          }
          chatInput.value = '';
          chatInput.focus();
        });
      });
    }

    socket.on('chat:message', (msg) => {
      if (!msg) return;
      const involvesCurrentThread =
        (msg.senderId === currentUserId && msg.receiverId === peerId) ||
        (msg.senderId === peerId && msg.receiverId === currentUserId);
      if (!involvesCurrentThread) return;

      appendMessageBubble(msg.content, msg.senderId === currentUserId);
    });

    socket.on('presence:update', ({ userId, online }) => {
      if (Number(userId) !== peerId) return;
      if (peerStatusDot) {
        peerStatusDot.classList.toggle('hidden', !online);
      }
      if (peerStatusText) {
        peerStatusText.textContent = online ? 'Online' : 'Offline';
      }
    });
  }

  if (inboxMain) {
    const listSection = document.getElementById('conversationsList');

    socket.on('presence:update', ({ userId, online }) => {
      if (!listSection) return;
      const row = listSection.querySelector(`[data-user-id="${Number(userId)}"]`);
      if (!row) return;
      const dot = row.querySelector('[data-online-dot]');
      if (dot) {
        dot.classList.toggle('hidden', !online);
      }
    });

    socket.on('chat:inbox_update', ({ peerId, lastMessage }) => {
      if (!listSection) return;
      const row = listSection.querySelector(`[data-user-id="${Number(peerId)}"]`);
      if (!row) return;

      const preview = row.querySelector('[data-last-message]');
      const timeEl = row.querySelector('[data-time-ago]');
      if (preview && typeof lastMessage === 'string') {
        preview.textContent = lastMessage;
      }
      if (timeEl) {
        timeEl.textContent = 'just now';
      }
      listSection.prepend(row);
    });
  }
})();
