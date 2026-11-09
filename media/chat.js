// Antigravity IDE Chat Webview Controller

(function() {
  const vscode = acquireVsCodeApi();

  // DOM Elements
  const welcomeView = document.getElementById('welcomeView');
  const messagesContainer = document.getElementById('messages');
  const chatScrollArea = document.getElementById('chatScrollArea');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const clearBtn = document.getElementById('clearBtn');
  const importConvBtn = document.getElementById('importConvBtn');
  const addContextBtn = document.getElementById('addContextBtn');
  const modelPill = document.getElementById('modelPill');
  const modelPillName = document.getElementById('modelPillName');
  const modelPillTag = document.getElementById('modelPillTag');
  const modelPopover = document.getElementById('modelPopover');
  const contextMenu = document.getElementById('contextMenu');
  const contextBar = document.getElementById('contextBar');
  const contextChips = document.getElementById('contextChips');
  const activeFilePill = document.getElementById('activeFilePill');
  const typingIndicator = document.getElementById('typingIndicator');
  const importModal = document.getElementById('importModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const conversationsList = document.getElementById('conversationsList');
  const importSessionRow = document.getElementById('importSessionRow');
  const configApiKeyRow = document.getElementById('configApiKeyRow');
  const changeKeyLink = document.getElementById('changeKeyLink');
  const menuAddFile = document.getElementById('menuAddFile');
  const menuAddSelection = document.getElementById('menuAddSelection');
  const menuClearContext = document.getElementById('menuClearContext');

  let currentMessageElement = null;
  let currentMessageText = '';
  let isStreaming = false;

  function init() {
    setupEventListeners();
    setupInputHandling();
  }

  function setupEventListeners() {
    // Send Message
    if (sendBtn && messageInput) {
      sendBtn.addEventListener('click', sendMessage);
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    // New Chat
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'newChat' });
      });
    }

    // Clear History
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'clearHistory' });
      });
    }

    // Model Pill Toggle Popover & Live Model Fetch
    const modelSearchInput = document.getElementById('modelSearchInput');
    const dynamicModelsContainer = document.getElementById('dynamicModelsContainer');

    function selectModelItem(modelId, name, tag) {
      if (modelPopover) {
        modelPopover.querySelectorAll('.popover-model-item').forEach(i => {
          i.classList.remove('selected');
          const check = i.querySelector('.model-checkmark');
          if (check) check.textContent = '';
        });
      }
      if (modelPillName) modelPillName.textContent = name;
      if (modelPillTag) modelPillTag.textContent = tag || 'Model';
      if (modelPopover) modelPopover.classList.add('hidden');
      vscode.postMessage({ type: 'changeModel', payload: modelId });
    }

    if (modelPill && modelPopover) {
      modelPill.addEventListener('click', (e) => {
        e.stopPropagation();
        if (contextMenu) contextMenu.classList.add('hidden');
        const isOpening = modelPopover.classList.contains('hidden');
        modelPopover.classList.toggle('hidden');
        if (isOpening) {
          vscode.postMessage({ type: 'fetchLiveModels' });
          if (modelSearchInput) {
            setTimeout(() => modelSearchInput.focus(), 50);
          }
        }
      });
    }

    // Model Selection via Event Delegation
    if (modelPopover) {
      modelPopover.addEventListener('click', (e) => {
        const item = e.target.closest('.popover-model-item');
        if (!item) return;
        const modelId = item.dataset.model;
        const tag = item.dataset.tag || '';
        const name = item.querySelector('.model-name')?.textContent || modelId;

        item.classList.add('selected');
        const check = item.querySelector('.model-checkmark');
        if (check) check.textContent = '✓';

        selectModelItem(modelId, name, tag);
      });
    }

    // Search or Custom Model Input
    if (modelSearchInput) {
      modelSearchInput.addEventListener('input', () => {
        const query = modelSearchInput.value.toLowerCase().trim();
        if (modelPopover) {
          modelPopover.querySelectorAll('.popover-model-item').forEach(item => {
            const name = item.querySelector('.model-name')?.textContent?.toLowerCase() || '';
            const id = item.dataset.model?.toLowerCase() || '';
            const match = !query || name.includes(query) || id.includes(query);
            item.style.display = match ? 'flex' : 'none';
          });
        }
      });

      modelSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const customId = modelSearchInput.value.trim();
          if (customId) {
            // Check if there is an exact or visible match
            const firstVisible = Array.from(modelPopover.querySelectorAll('.popover-model-item')).find(i => i.style.display !== 'none');
            if (firstVisible && modelSearchInput.value.length > 2) {
              const modelId = firstVisible.dataset.model;
              const tag = firstVisible.dataset.tag || '';
              const name = firstVisible.querySelector('.model-name')?.textContent || modelId;
              selectModelItem(modelId, name, tag);
            } else {
              const displayName = customId.split('/').pop() || customId;
              selectModelItem(customId, displayName, 'Custom');
            }
          }
        }
      });
    }

    // Add Context Button (+) Toggle
    if (addContextBtn && contextMenu) {
      addContextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modelPopover) modelPopover.classList.add('hidden');
        contextMenu.classList.toggle('hidden');
      });
    }

    // Context Menu Actions
    if (menuAddFile) {
      menuAddFile.addEventListener('click', () => {
        contextMenu.classList.add('hidden');
        vscode.postMessage({ type: 'requestFile' });
      });
    }

    if (menuAddSelection) {
      menuAddSelection.addEventListener('click', () => {
        contextMenu.classList.add('hidden');
        vscode.postMessage({ type: 'addSelection' });
      });
    }

    if (menuClearContext) {
      menuClearContext.addEventListener('click', () => {
        contextMenu.classList.add('hidden');
        vscode.postMessage({ type: 'clearContext' });
      });
    }

    // Import Session
    if (importConvBtn) {
      importConvBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'importConversations' });
      });
    }

    if (importSessionRow) {
      importSessionRow.addEventListener('click', () => {
        if (modelPopover) modelPopover.classList.add('hidden');
        vscode.postMessage({ type: 'importConversations' });
      });
    }

    if (closeModalBtn && importModal) {
      closeModalBtn.addEventListener('click', () => {
        importModal.classList.add('hidden');
      });
    }

    if (importModal) {
      importModal.addEventListener('click', (e) => {
        if (e.target === importModal) {
          importModal.classList.add('hidden');
        }
      });
    }

    // API Key Config Links
    if (configApiKeyRow) {
      configApiKeyRow.addEventListener('click', () => {
        if (modelPopover) modelPopover.classList.add('hidden');
        vscode.postMessage({ type: 'configureApiKey' });
      });
    }

    if (changeKeyLink) {
      changeKeyLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (modelPopover) modelPopover.classList.add('hidden');
        vscode.postMessage({ type: 'configureApiKey' });
      });
    }

    // Close popovers on click outside
    document.addEventListener('click', (e) => {
      if (modelPopover && !modelPopover.contains(e.target) && !modelPill?.contains(e.target)) {
        modelPopover.classList.add('hidden');
      }
      if (contextMenu && !contextMenu.contains(e.target) && !addContextBtn?.contains(e.target)) {
        contextMenu.classList.add('hidden');
      }
    });
  }

  function setupInputHandling() {
    if (!messageInput || !sendBtn) return;

    messageInput.addEventListener('input', () => {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + 'px';

      const hasContent = messageInput.value.trim().length > 0;
      if (hasContent && !isStreaming) {
        sendBtn.disabled = false;
        sendBtn.classList.add('active');
      } else {
        sendBtn.disabled = true;
        sendBtn.classList.remove('active');
      }
    });
  }

  function sendMessage() {
    if (!messageInput || isStreaming) return;
    const text = messageInput.value.trim();
    if (!text) return;

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    sendBtn.classList.remove('active');

    vscode.postMessage({ type: 'sendMessage', payload: text });
  }

  // Handle messages from VS Code
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'addMessage':
        addMessage(message.payload);
        break;
      case 'streamDelta':
        appendStreamDelta(message.payload);
        break;
      case 'clearChat':
        clearChat();
        break;
      case 'updateContext':
        updateContextBar(message.payload);
        break;
      case 'activeFileChanged':
        updateActiveFilePill(message.payload);
        break;
      case 'showTyping':
        showTyping();
        break;
      case 'hideTyping':
        finishStreaming();
        break;
      case 'conversationsList':
        showImportModal(message.payload);
        break;
      case 'conversationLoaded':
        showNotification(`Session loaded: ${message.payload.title}`);
        break;
      case 'fileCreated':
      case 'fileWritten':
        showNotification(`Saved: ${message.payload.filePath}`);
        break;
      case 'fileError':
        showNotification(`Error: ${message.payload.error}`, true);
        break;
      case 'liveModels':
        if (dynamicModelsContainer && Array.isArray(message.payload)) {
          const existingModels = new Set(
            Array.from(document.querySelectorAll('.popover-model-item')).map(i => i.dataset.model)
          );
          const newModels = message.payload.filter(id => !existingModels.has(id));
          if (newModels.length > 0) {
            let html = '<div class="popover-divider"></div><div class="popover-section-label">All NVIDIA NIM Models (' + newModels.length + ')</div>';
            newModels.forEach(mId => {
              const shortName = mId.split('/').pop() || mId;
              const tag = mId.includes('deepseek') ? 'Reasoning' : (mId.includes('nemotron') ? 'Flagship' : 'NIM');
              html += `<div class="popover-model-item" data-model="${escapeHtml(mId)}" data-tag="${tag}">
                <div class="model-item-title">
                  <span class="model-name">${escapeHtml(shortName)}</span>
                  <span class="model-subtag">${tag}</span>
                </div>
                <span class="model-checkmark"></span>
              </div>`;
            });
            dynamicModelsContainer.innerHTML = html;
          }
        }
        break;
    }
  });

  function updateActiveFilePill(filePath) {
    if (!activeFilePill) return;
    if (!filePath) {
      activeFilePill.classList.add('hidden');
      return;
    }
    activeFilePill.classList.remove('hidden');
    activeFilePill.innerHTML = `<span>📄</span> <span>${escapeHtml(filePath)}</span>`;
  }

  function addMessage({ role, content, error }) {
    hideTyping();
    isStreaming = false;

    // Switch from Welcome to Messages
    if (welcomeView) welcomeView.classList.add('hidden');
    if (messagesContainer) messagesContainer.classList.remove('hidden');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role} ${error ? 'error' : ''}`;

    const formatted = role === 'user'
      ? escapeHtml(content).replace(/\n/g, '<br>')
      : formatMarkdown(content);

    messageDiv.innerHTML = `<div class="message-content">${formatted}</div>`;

    if (messagesContainer) {
      messagesContainer.appendChild(messageDiv);
      bindCodeBlockButtons(messageDiv);
      scrollToBottom();
    }
  }

  function appendStreamDelta(delta) {
    if (!currentMessageElement) {
      if (welcomeView) welcomeView.classList.add('hidden');
      if (messagesContainer) messagesContainer.classList.remove('hidden');

      currentMessageElement = document.createElement('div');
      currentMessageElement.className = 'message assistant';
      currentMessageElement.innerHTML = `<div class="message-content"></div>`;

      if (messagesContainer) {
        messagesContainer.appendChild(currentMessageElement);
      }
      isStreaming = true;
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.classList.remove('active');
      }
      currentMessageText = '';
    }

    currentMessageText += delta;
    const contentEl = currentMessageElement.querySelector('.message-content');
    if (contentEl) {
      contentEl.textContent = currentMessageText;
    }
    scrollToBottom();
  }

  function finishStreaming() {
    hideTyping();
    if (currentMessageElement) {
      const contentEl = currentMessageElement.querySelector('.message-content');
      if (contentEl && currentMessageText) {
        contentEl.innerHTML = formatMarkdown(currentMessageText);
        bindCodeBlockButtons(currentMessageElement);
      }
    }
    isStreaming = false;
    currentMessageElement = null;
    currentMessageText = '';
    scrollToBottom();
  }

  function formatMarkdown(content) {
    if (!content) return '';
    let text = content;

    // 1. Antigravity Thought Accordion (<think>...</think>)
    text = text.replace(/<think>([\s\S]*?)<\/think>/g, (m, thought) => {
      return `
        <details class="thought-container">
          <summary class="thought-summary">
            <span class="thought-icon">🧠</span> Thought process
            <span class="thought-chevron">▾</span>
          </summary>
          <div class="thought-body">${escapeHtml(thought.trim())}</div>
        </details>
      `;
    });

    // 2. Fenced Code Blocks with Antigravity actions
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, language, code) => {
      const lang = language.trim() || 'text';
      let filePath = '';
      const lines = code.trim().split('\n');
      const firstLine = lines[0] || '';
      if (firstLine.startsWith('// ') || firstLine.startsWith('# ') || firstLine.startsWith('<!-- ') || firstLine.startsWith('/* ')) {
        const potential = firstLine.replace(/^\/\/ |^# |^<!-- | -->$|^\/\* |\*\/$/g, '').trim();
        if (potential.includes('.') && !potential.includes(' ') && potential.length < 100) {
          filePath = potential;
        }
      }

      const cleanCode = code.trim();
      return `
        <div class="code-block">
          <div class="code-header">
            <span class="code-language">${escapeHtml(lang)}${filePath ? ` · ${escapeHtml(filePath)}` : ''}</span>
            <div class="code-actions">
              <button class="code-action-btn" data-action="createFile" data-filepath="${escapeHtml(filePath)}" data-code="${escapeHtml(cleanCode)}" data-language="${escapeHtml(lang)}" title="Save code to file">
                📄 Create File
              </button>
              <button class="code-action-btn" data-action="applyToFile" data-filepath="${escapeHtml(filePath)}" data-code="${escapeHtml(cleanCode)}" data-language="${escapeHtml(lang)}" title="Apply to file">
                📝 Apply
              </button>
              <button class="code-action-btn copy-btn" data-code="${escapeHtml(cleanCode)}" title="Copy code">
                📋 Copy
              </button>
            </div>
          </div>
          <pre><code class="language-${escapeHtml(lang)}">${escapeHtml(cleanCode)}</code></pre>
        </div>
      `;
    });

    // 3. Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 4. Headers
    text = text.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    text = text.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^# (.*$)/gim, '<h2>$1</h2>');

    // 5. Bold & Italic
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 6. Blockquotes
    text = text.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // 7. Lists
    text = text.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
    text = text.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');

    // 8. Line breaks
    text = text.replace(/\n/g, '<br>');
    text = text.replace(/<\/div><br>/g, '</div>');
    text = text.replace(/<\/ul><br>/g, '</ul>');
    text = text.replace(/<\/details><br>/g, '</details>');

    return text;
  }

  function bindCodeBlockButtons(rootElement) {
    if (!rootElement) return;

    rootElement.querySelectorAll('.code-action-btn:not(.copy-btn)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const filePath = btn.dataset.filepath;
        const code = btn.dataset.code;
        const language = btn.dataset.language;

        if (action === 'createFile') {
          if (filePath) {
            vscode.postMessage({ type: 'createFile', payload: { filePath, content: code } });
          } else {
            vscode.postMessage({ type: 'promptCreateFile', payload: { filePath: '', code } });
          }
        } else if (action === 'applyToFile') {
          if (filePath) {
            vscode.postMessage({ type: 'applyCodeBlock', payload: { filePath, code, language } });
          } else {
            vscode.postMessage({ type: 'promptApplyFile', payload: { filePath: '', code, language } });
          }
        }
      });
    });

    rootElement.querySelectorAll('.code-action-btn.copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const code = btn.dataset.code;
        try {
          await navigator.clipboard.writeText(code);
          const original = btn.textContent;
          btn.textContent = '✅ Copied!';
          setTimeout(() => { btn.textContent = original; }, 2000);
        } catch (err) {
          console.error('Clipboard copy error:', err);
        }
      });
    });
  }

  function clearChat() {
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
      messagesContainer.classList.add('hidden');
    }
    if (welcomeView) {
      welcomeView.classList.remove('hidden');
    }
    currentMessageElement = null;
    currentMessageText = '';
  }

  function updateContextBar(contexts) {
    if (!contextBar || !contextChips) return;
    if (!contexts || contexts.length === 0) {
      contextBar.classList.add('hidden');
      contextChips.innerHTML = '';
      return;
    }

    contextBar.classList.remove('hidden');
    contextChips.innerHTML = contexts.map(ctx => `
      <div class="context-chip" title="${escapeHtml(ctx.path)}">
        <span>${escapeHtml(ctx.path)}</span>
        <button data-path="${escapeHtml(ctx.path)}" title="Remove">×</button>
      </div>
    `).join('');

    contextChips.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const path = btn.dataset.path;
        vscode.postMessage({ type: 'removeContext', payload: path });
      });
    });
  }

  function showImportModal(conversations) {
    if (!importModal || !conversationsList) return;

    if (!conversations || conversations.length === 0) {
      conversationsList.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">No Antigravity sessions found</p>';
    } else {
      conversationsList.innerHTML = conversations.map(conv => `
        <div class="conversation-item" data-id="${escapeHtml(conv.id)}">
          <div class="conv-title">${escapeHtml(conv.title)}</div>
          <div class="conv-meta">
            <span>📁 ${escapeHtml(conv.workspace || 'Workspace')}</span>
            <span>💬 ${conv.turns || 1} turns</span>
            <span>🕐 ${new Date(conv.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      `).join('');

      conversationsList.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          importModal.classList.add('hidden');
          vscode.postMessage({ type: 'loadConversation', payload: { conversationId: id } });
        });
      });
    }

    importModal.classList.remove('hidden');
  }

  function showTyping() {
    if (typingIndicator) typingIndicator.classList.remove('hidden');
    scrollToBottom();
  }

  function hideTyping() {
    if (typingIndicator) typingIndicator.classList.add('hidden');
  }

  function showNotification(message, isError = false) {
    const notif = document.createElement('div');
    notif.className = `notification ${isError ? 'error' : ''}`;
    notif.textContent = message;
    notif.style.cssText = `
      position: fixed;
      bottom: 95px;
      right: 16px;
      padding: 8px 14px;
      background: ${isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(34, 197, 94, 0.95)'};
      color: white;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 500;
      z-index: 2000;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    `;
    document.body.appendChild(notif);
    setTimeout(() => { notif.remove(); }, 3000);
  }

  function scrollToBottom() {
    if (chatScrollArea) {
      chatScrollArea.scrollTop = chatScrollArea.scrollHeight;
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
