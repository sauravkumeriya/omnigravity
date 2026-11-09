/**
 * Antigravity NVIDIA Chat Extension
 * Pixel-perfect replica of Antigravity IDE Chat UI, powered by NVIDIA NIM & Local AI Models.
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Supported Models on NVIDIA NIM
const NVIDIA_MODELS = [
  { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra', tag: 'Flagship', maxTokens: 8192 },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', name: 'Nemotron 3 Reasoning', tag: 'Thinking', maxTokens: 8192 }
];

let panel = null;
let chatHistory = [];
let fileContexts = new Map();
let currentModel = 'nvidia/nemotron-3-ultra-550b-a55b';
let activeConversationId = null;

function getUserDisplayName() {
  const envUser = process.env.USERNAME || process.env.USER || 'Gaurav';
  if (envUser.toLowerCase() === 'saurav') return 'Gaurav';
  return envUser.charAt(0).toUpperCase() + envUser.slice(1);
}

function getWebviewContent(webview, extensionUri) {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'chat.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'chat.css'));
  const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'antigravity-logo.svg'));

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const workspaceName = workspaceFolder ? workspaceFolder.name : 'Workspace';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}' https: 'unsafe-inline'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} https: data:; connect-src https: http:;">
  <link rel="stylesheet" href="${styleUri}" nonce="${nonce}">
  <title>Antigravity Chat</title>
</head>
<body>
  <div id="app">
    <!-- Main Chat & Centered Welcome Area -->
    <main id="chatScrollArea" class="chat-scroll-area">
      <!-- Centered Antigravity Welcome Screen -->
      <div id="welcomeView" class="welcome-view">
        <div class="welcome-center">
          <img src="${logoUri}" alt="Antigravity" class="welcome-logo" />
        </div>
      </div>

      <!-- Messages Stream Area -->
      <div id="messages" class="messages-container hidden"></div>

      <!-- Typing / Thought Indicator -->
      <div id="typingIndicator" class="typing-indicator hidden">
        <div class="typing-pill">
          <span class="thinking-spinner"></span>
          <span id="typingStatusText">Thinking with Nemotron...</span>
        </div>
      </div>
    </main>

    <!-- Context Chips Bar -->
    <div id="contextBar" class="context-bar hidden">
      <div id="contextChips" class="context-chips"></div>
    </div>

    <!-- Antigravity Floating Input Box (Anchored at Bottom) -->
    <div class="input-card-container">
      <div class="input-card">
        <!-- Top Context Pill Inside Input Box -->
        <div class="card-context-row">
          <div class="workspace-pill" id="workspacePill" title="Active Workspace">
            <svg class="folder-svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            <span id="workspaceNameLabel">${workspaceName}</span>
          </div>
          <div id="activeFilePill" class="file-pill hidden"></div>
        </div>

        <!-- Textarea -->
        <div class="card-textarea-row">
          <textarea 
            id="messageInput" 
            placeholder="Ask anything..." 
            rows="1"
            spellcheck="false"
          ></textarea>
        </div>

        <!-- Bottom Actions Row -->
        <div class="card-bottom-row">
          <div class="bottom-left-tools">
            <!-- Add Context Button (+) -->
            <button id="addContextBtn" class="plus-circle-btn" title="Add File or Editor Selection">+</button>

            <!-- Model Selector Pill (Opens Popover) -->
            <button id="modelPill" class="model-pill" title="Switch AI Model">
              <span id="modelPillName">Nemotron 3 Ultra</span>
              <span id="modelPillTag" class="model-pill-tag">Flagship</span>
              <span class="model-pill-chevron">⌃</span>
            </button>
          </div>

          <!-- Circular Send Button -->
          <div class="bottom-right-tools">
            <button id="sendBtn" class="send-circle-btn" title="Send (Enter)" disabled>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Model Selector Popover (Matches Screenshot) -->
      <div id="modelPopover" class="model-popover hidden">
        <div class="popover-header">Model</div>
        <div class="popover-models-list">
          <div class="popover-model-item selected" data-model="nvidia/nemotron-3-ultra-550b-a55b" data-tag="Flagship">
            <div class="model-item-title">
              <span class="model-name">Nemotron 3 Ultra</span>
              <span class="model-subtag">Flagship</span>
            </div>
            <span class="model-checkmark">✓</span>
          </div>

          <div class="popover-model-item" data-model="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning" data-tag="Thinking">
            <div class="model-item-title">
              <span class="model-name">Nemotron 3 Reasoning</span>
              <span class="model-subtag notice">Notice ⓘ</span>
            </div>
            <span class="model-checkmark"></span>
          </div>

          <div class="popover-divider"></div>

          <div class="popover-section-label">Local Models</div>

          <div class="popover-model-item" data-model="ollama:llama3" data-tag="Local">
            <div class="model-item-title">
              <span class="model-name">Ollama (Llama 3)</span>
              <span class="model-subtag">Local</span>
            </div>
            <span class="model-checkmark"></span>
          </div>

          <div class="popover-model-item" data-model="lmstudio:local" data-tag="Local">
            <div class="model-item-title">
              <span class="model-name">LM Studio</span>
              <span class="model-subtag">Local</span>
            </div>
            <span class="model-checkmark"></span>
          </div>
        </div>

        <div class="popover-divider"></div>

        <!-- Menu Action Links -->
        <div class="popover-actions-menu">
          <div class="popover-action-row" id="importSessionRow">
            <div class="action-row-left">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              <span>Import Antigravity Session</span>
            </div>
            <span class="chevron">&rsaquo;</span>
          </div>
          <div class="popover-action-row" id="configApiKeyRow">
            <div class="action-row-left">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <span>Set NVIDIA API Key</span>
            </div>
            <span class="chevron">&rsaquo;</span>
          </div>
        </div>

        <!-- Bottom Notice Box (Matches Screenshot) -->
        <div class="popover-notice-card">
          <p>Running via NVIDIA NIM API. You can switch open models without consuming Antigravity limits.</p>
          <a href="#" id="changeKeyLink">Configure API Key</a>
        </div>
      </div>

      <!-- Add Context Popup Menu -->
      <div id="contextMenu" class="context-popup-menu hidden">
        <div class="context-menu-item" id="menuAddFile">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          <span>Attach File to Context...</span>
        </div>
        <div class="context-menu-item" id="menuAddSelection">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          <span>Add Active Editor Selection</span>
        </div>
        <div class="context-menu-item" id="menuClearContext">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          <span>Clear All Attached Context</span>
        </div>
      </div>
    </div>

    <!-- Antigravity Session Import Modal -->
    <div id="importModal" class="modal hidden">
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            <span>Import Antigravity Session</span>
          </div>
          <button id="closeModalBtn" class="modal-close">&times;</button>
        </div>
        <p class="modal-desc">Pick an existing conversation from your local Antigravity history to continue working with NVIDIA AI:</p>
        <div id="conversationsList" class="conversations-list"></div>
      </div>
    </div>
  </div>

  <script src="${scriptUri}" nonce="${nonce}"></script>
</body>
</html>`;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getAntigravityBrainDir() {
  return path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
}

function getAntigravitySqlite() {
  const appPath = 'C:\\Users\\SauRav\\AppData\\Local\\Programs\\Antigravity IDE\\resources\\app\\node_modules\\@vscode\\sqlite3\\lib\\sqlite3.js';
  if (fs.existsSync(appPath)) {
    try {
      return require(appPath);
    } catch (e) {
      console.error('Failed to load IDE sqlite3:', e);
    }
  }
  return null;
}

function decodeVarint(buf, offset) {
  let res = 0, shift = 0, i = offset;
  while (i < buf.length) {
    const b = buf[i++];
    res |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return { val: res, next: i };
}

function encodeVarint(val) {
  const bytes = [];
  while (val > 0x7f) {
    bytes.push((val & 0x7f) | 0x80);
    val >>>= 7;
  }
  bytes.push(val & 0x7f);
  return Buffer.from(bytes);
}

function parseAntigravityStep(stepType, buf) {
  if (!buf) return null;
  if (stepType === 14) { // USER_INPUT
    const tag = Buffer.from([0x9a, 0x01]);
    let idx = 0;
    while ((idx = buf.indexOf(tag, idx)) !== -1) {
      const { val: subLen, next: afterSub } = decodeVarint(buf, idx + 2);
      const sub = buf.slice(afterSub, afterSub + subLen);
      if (sub[0] === 0x12) {
        const { val: strLen, next: strStart } = decodeVarint(sub, 1);
        const str = sub.slice(strStart, strStart + strLen).toString('utf8');
        if (str && !str.includes('file:///') && !/^[0-9a-f-]{36}$/.test(str)) {
          return str;
        }
      }
      idx += 2;
    }
  } else if (stepType === 15) { // PLANNER_RESPONSE
    const tag = Buffer.from([0xa2, 0x01]);
    let idx = 0;
    while ((idx = buf.indexOf(tag, idx)) !== -1) {
      const { val: subLen, next: afterSub } = decodeVarint(buf, idx + 2);
      const sub = buf.slice(afterSub, afterSub + subLen);
      if (sub[0] === 0x0a) {
        const { val: strLen, next: strStart } = decodeVarint(sub, 1);
        const str = sub.slice(strStart, strStart + strLen).toString('utf8');
        if (str && !/^[0-9a-f-]{36}$/.test(str)) {
          return str;
        }
      }
      idx += 2;
    }
  }
  return null;
}

function buildUserStep(userText, metadataBuf) {
  const textBuf = Buffer.from(userText, 'utf8');
  // field 2 (0x12): raw request string
  const f2 = Buffer.concat([Buffer.from([0x12]), encodeVarint(textBuf.length), textBuf]);
  // field 3 (0x1a): display message submessage (0x0a + textBuf) - REQUIRED by Antigravity UI to display user bubble
  const f3Sub = Buffer.concat([Buffer.from([0x0a]), encodeVarint(textBuf.length), textBuf]);
  const f3 = Buffer.concat([Buffer.from([0x1a]), encodeVarint(f3Sub.length), f3Sub]);
  const subField = Buffer.concat([f2, f3]);
  const contentBuf = Buffer.concat([Buffer.from([0x9a, 0x01]), encodeVarint(subField.length), subField]);
  if (!metadataBuf || metadataBuf.length === 0) return contentBuf;
  const prefix = Buffer.concat([
    Buffer.from([0x08, 14, 0x20, 0x03, 0x2a]),
    encodeVarint(metadataBuf.length),
    metadataBuf
  ]);
  return Buffer.concat([prefix, contentBuf]);
}

function buildAssistantStep(assistantText, metadataBuf) {
  const textBuf = Buffer.from(assistantText, 'utf8');
  const subField = Buffer.concat([Buffer.from([0x0a]), encodeVarint(textBuf.length), textBuf]);
  const contentBuf = Buffer.concat([Buffer.from([0xa2, 0x01]), encodeVarint(subField.length), subField]);
  if (!metadataBuf || metadataBuf.length === 0) return contentBuf;
  const prefix = Buffer.concat([
    Buffer.from([0x08, 15, 0x20, 0x03, 0x2a]),
    encodeVarint(metadataBuf.length),
    metadataBuf
  ]);
  return Buffer.concat([prefix, contentBuf]);
}

async function appendTranscriptEntry(conversationId, entry) {
  // 1. Always append to brain transcript.jsonl if folder exists or create it
  try {
    const brainDir = getAntigravityBrainDir();
    const logDir = path.join(brainDir, conversationId, '.system_generated', 'logs');
    const transcriptPath = path.join(logDir, 'transcript.jsonl');
    await fs.promises.mkdir(logDir, { recursive: true });
    await fs.promises.appendFile(transcriptPath, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to append transcript.jsonl:', err);
  }

  // 2. Also directly update Antigravity's conversation database (.db) so Antigravity and Extension share the same session!
  const sqlite3 = getAntigravitySqlite();
  if (!sqlite3) return;

  const convDbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversations', `${conversationId}.db`);
  if (!fs.existsSync(convDbPath)) return;

  try {
    await new Promise((resolve) => {
      const db = new sqlite3.Database(convDbPath, (err) => {
        if (err) return resolve();

        db.all('SELECT idx, step_type, metadata FROM steps ORDER BY idx DESC LIMIT 10', (err, rows) => {
          const maxIdx = (rows && rows.length > 0) ? Math.max(...rows.map(r => r.idx)) : -1;
          const nextIdx = maxIdx + 1;
          const isUser = (entry.type === 'USER_INPUT' || entry.source === 'USER_EXPLICIT');
          const stepType = isUser ? 14 : 15;
          const cleanText = isUser ? entry.content.replace(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/, '$1').trim() : entry.content;

          // Borrow metadata structure from previous steps of same type if available
          const sampleRow = rows ? rows.find(r => r.step_type === stepType && r.metadata) || rows[0] : null;
          const metadataBuf = sampleRow && sampleRow.metadata ? sampleRow.metadata : Buffer.alloc(0);

          const payload = isUser ? buildUserStep(cleanText, metadataBuf) : buildAssistantStep(cleanText, metadataBuf);

          db.run(
            'INSERT INTO steps (idx, step_type, status, has_subtrajectory, metadata, step_payload) VALUES (?, ?, ?, ?, ?, ?)',
            [nextIdx, stepType, 3, 0, metadataBuf.length > 0 ? metadataBuf : null, payload],
            function(err) {
              db.close();
              resolve();
            }
          );
        });
      });
    });

    // Update conversation_summaries.db so the Antigravity session list shows updated timestamp and count
    const summaryDbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
    if (fs.existsSync(summaryDbPath)) {
      const sumDb = new sqlite3.Database(summaryDbPath);
      sumDb.run(
        'UPDATE conversation_summaries SET step_count = step_count + 1, last_modified_time = ? WHERE conversation_id = ?',
        [new Date().toISOString(), conversationId],
        () => sumDb.close()
      );
    }
  } catch (err) {
    console.error('Failed to sync to Antigravity DB:', err);
  }
}

async function listAntigravityConversations() {
  const sqlite3 = getAntigravitySqlite();
  const summaryDbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');

  if (sqlite3 && fs.existsSync(summaryDbPath)) {
    try {
      const rows = await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(summaryDbPath, sqlite3.OPEN_READONLY, (err) => {
          if (err) return reject(err);
          db.all(
            'SELECT conversation_id, title, preview, step_count, last_modified_time, workspace_uris FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 50',
            (err, rows) => {
              db.close();
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });
      });

      return rows.map(r => {
        let wsName = '';
        try {
          const parsed = JSON.parse(r.workspace_uris);
          if (Array.isArray(parsed) && parsed[0]) {
            wsName = decodeURIComponent(parsed[0].split('/').pop());
          }
        } catch (e) {}

        return {
          id: r.conversation_id,
          title: r.title || r.preview || 'Untitled Conversation',
          workspace: wsName || 'Workspace',
          turns: Math.floor(r.step_count / 2) || 1,
          createdAt: r.last_modified_time
        };
      });
    } catch (e) {
      console.error('Failed to query conversation_summaries.db:', e);
    }
  }

  // Fallback to reading brain dirs
  const brainDir = getAntigravityBrainDir();
  if (!fs.existsSync(brainDir)) return [];
  const dirs = await fs.promises.readdir(brainDir, { withFileTypes: true });
  const conversations = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const dirPath = path.join(brainDir, dir.name);
    const transcriptPath = path.join(dirPath, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(transcriptPath)) {
      try {
        const stat = await fs.promises.stat(dirPath);
        conversations.push({
          id: dir.name,
          title: 'Antigravity Session',
          workspace: 'Workspace',
          turns: 1,
          createdAt: stat.mtime
        });
      } catch (e) {}
    }
  }
  return conversations;
}

async function loadAntigravityConversation(conversationId) {
  const loadedMessages = [];
  let title = 'Antigravity Session';

  // 1. Try reading directly from Antigravity's conversation SQLite DB
  const sqlite3 = getAntigravitySqlite();
  const convDbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversations', `${conversationId}.db`);

  if (sqlite3 && fs.existsSync(convDbPath)) {
    try {
      const rows = await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(convDbPath, sqlite3.OPEN_READONLY, (err) => {
          if (err) return reject(err);
          db.all('SELECT idx, step_type, step_payload FROM steps ORDER BY idx ASC', (err, rows) => {
            db.close();
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      });

      for (const r of rows) {
        const content = parseAntigravityStep(r.step_type, r.step_payload);
        if (content) {
          loadedMessages.push({
            role: r.step_type === 14 ? 'user' : 'assistant',
            content: content
          });
        }
      }

      if (loadedMessages.length > 0) {
        // Try getting title from conversation_summaries.db
        const summaryDbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
        if (fs.existsSync(summaryDbPath)) {
          const sumTitle = await new Promise((resolve) => {
            const sumDb = new sqlite3.Database(summaryDbPath, sqlite3.OPEN_READONLY, (err) => {
              if (err) return resolve(null);
              sumDb.get('SELECT title FROM conversation_summaries WHERE conversation_id = ?', [conversationId], (err, row) => {
                sumDb.close();
                resolve(row ? row.title : null);
              });
            });
          });
          if (sumTitle) title = sumTitle;
        }
        return { title, messages: loadedMessages };
      }
    } catch (e) {
      console.error('Failed reading conversation DB:', e);
    }
  }

  // 2. Fallback to transcript.jsonl
  const brainDir = getAntigravityBrainDir();
  const transcriptPath = path.join(brainDir, conversationId, '.system_generated', 'logs', 'transcript.jsonl');
  if (fs.existsSync(transcriptPath)) {
    const raw = await fs.promises.readFile(transcriptPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'USER_INPUT' || entry.source === 'USER_EXPLICIT') {
          if (entry.content) {
            let userText = entry.content;
            const match = userText.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
            if (match) userText = match[1];
            userText = userText.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '').trim();
            if (userText) loadedMessages.push({ role: 'user', content: userText });
          }
        } else if (entry.source === 'MODEL' && entry.type === 'PLANNER_RESPONSE') {
          if (entry.content && entry.content.trim()) {
            loadedMessages.push({ role: 'assistant', content: entry.content });
          }
        }
      } catch (e) {}
    }
  }

  return { title, messages: loadedMessages };
}

async function handleCreateFile(filePath, content) {
  try {
    let targetPath = filePath;
    if (!path.isAbsolute(targetPath)) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('Please open a workspace folder to save files');
      }
      targetPath = path.join(workspaceRoot, targetPath);
    }

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.writeFile(targetPath, content, 'utf8');

    const doc = await vscode.workspace.openTextDocument(targetPath);
    await vscode.window.showTextDocument(doc);

    const relPath = vscode.workspace.asRelativePath(targetPath);
    panel.webview.postMessage({
      type: 'fileCreated',
      payload: { filePath: relPath }
    });
    vscode.window.showInformationMessage(`Saved: ${relPath}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create file: ${error.message}`);
    panel.webview.postMessage({
      type: 'fileError',
      payload: { error: error.message }
    });
  }
}

async function handleApplyCodeBlock(filePath, code) {
  try {
    let targetPath = filePath;
    if (!path.isAbsolute(targetPath)) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('Please open a workspace folder');
      }
      targetPath = path.join(workspaceRoot, targetPath);
    }

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.writeFile(targetPath, code, 'utf8');

    const doc = await vscode.workspace.openTextDocument(targetPath);
    await vscode.window.showTextDocument(doc);

    const relPath = vscode.workspace.asRelativePath(targetPath);
    panel.webview.postMessage({
      type: 'fileWritten',
      payload: { filePath: relPath }
    });
    vscode.window.showInformationMessage(`Applied changes to: ${relPath}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to apply changes: ${error.message}`);
    panel.webview.postMessage({
      type: 'fileError',
      payload: { error: error.message }
    });
  }
}

async function callNVIDIA_API(messages, config, isStreaming = false) {
  const { apiKey, baseUrl, model, maxTokens, temperature } = config;

  const requestBody = {
    model: model,
    messages: messages,
    stream: isStreaming,
    max_tokens: maxTokens,
    temperature: temperature
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': isStreaming ? 'text/event-stream' : 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA API Error ${response.status}: ${error}`);
  }

  return response;
}

async function callOllama_API(messages, config) {
  const { ollamaUrl, model } = config;
  const modelName = model.replace('ollama:', '');

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      messages: messages,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama API Error: ${response.status}`);
  }

  return response.json();
}

async function callLMStudio_API(messages, config) {
  const { lmstudioUrl } = config;

  const response = await fetch(`${lmstudioUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local',
      messages: messages,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`LM Studio API Error: ${response.status}`);
  }

  return response.json();
}

function buildMessagesWithContext(userMessage, history, contexts, modelId) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  const modelObj = NVIDIA_MODELS.find(m => m.id === modelId) || { name: 'Nemotron 3 Ultra 550B' };

  const systemPrompt = `You are ${modelObj.name}, a large language model developed by NVIDIA, currently running as the AI coding assistant in Antigravity IDE via NVIDIA NIM API.
Workspace directory: "${workspaceRoot}".

CRITICAL INSTRUCTIONS ON YOUR IDENTITY:
1. You are strictly ${modelObj.name} developed by NVIDIA. You are NOT Gemini, Google, Claude, or OpenAI.
2. If the user asks who you are, what model you are, or what version you are, state clearly: "I am ${modelObj.name}, developed by NVIDIA, running via NVIDIA NIM in Antigravity IDE."
3. (Note on history: Previous messages in this conversation may have been generated by Gemini or other models in an earlier Antigravity session. Do NOT adopt or repeat that identity. You are now ${modelObj.name}).
4. Provide clean, production-ready code. Always include the file path as a comment on the very first line of each code fence (e.g. // path/to/file.ext or # path/to/file.py).`;

  const messages = [{ role: 'system', content: systemPrompt }];

  if (contexts.size > 0) {
    let contextContent = '## Workspace Context:\n\n';
    for (const [filePath, content] of contexts) {
      const ext = path.extname(filePath).slice(1) || 'txt';
      contextContent += `### ${filePath}\n\`\`\`${ext}\n${content}\n\`\`\`\n\n`;
    }
    messages.push({ role: 'system', content: contextContent });
  }

  // Include recent conversation history
  const recentHistory = history.slice(-16);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: 'user', content: userMessage });
  return messages;
}

function activate(context) {
  console.log('[Antigravity Chat] Extension activated');

  // Restore active conversation ID from state
  activeConversationId = context.workspaceState.get('activeConversationId') || null;

  const viewProvider = {
    resolveWebviewView(webviewView) {
      panel = webviewView;
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      };
      webviewView.webview.html = getWebviewContent(webviewView.webview, context.extensionUri);

      // Auto restore previous messages if session was open
      if (activeConversationId) {
        loadAntigravityConversation(activeConversationId).then(loaded => {
          if (loaded && loaded.messages.length > 0) {
            chatHistory = loaded.messages.slice();
            panel.webview.postMessage({ type: 'clearChat' });
            for (const msg of chatHistory) {
              panel.webview.postMessage({ type: 'addMessage', payload: msg });
            }
          }
        }).catch(() => {});
      }

      webviewView.webview.onDidReceiveMessage(async (message) => {
        try {
          switch (message.type) {
            case 'sendMessage':
              await handleSendMessage(context, message.payload);
              break;

            case 'changeModel':
              currentModel = message.payload;
              break;

            case 'newChat':
              activeConversationId = crypto.randomUUID();
              await context.workspaceState.update('activeConversationId', activeConversationId);
              chatHistory = [];
              fileContexts.clear();
              panel.webview.postMessage({ type: 'clearChat' });
              panel.webview.postMessage({ type: 'updateContext', payload: [] });
              break;

            case 'clearHistory':
              chatHistory = [];
              panel.webview.postMessage({ type: 'clearChat' });
              break;

            case 'importConversations': {
              const convs = await listAntigravityConversations();
              panel.webview.postMessage({ type: 'conversationsList', payload: convs });
              break;
            }

            case 'loadConversation': {
              activeConversationId = message.payload.conversationId;
              await context.workspaceState.update('activeConversationId', activeConversationId);
              const loaded = await loadAntigravityConversation(activeConversationId);
              chatHistory = loaded.messages.slice();
              panel.webview.postMessage({ type: 'clearChat' });
              for (const msg of chatHistory) {
                panel.webview.postMessage({ type: 'addMessage', payload: msg });
              }
              panel.webview.postMessage({
                type: 'conversationLoaded',
                payload: { title: loaded.title, count: chatHistory.length }
              });
              break;
            }

            case 'requestFile': {
              const uris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Add to Chat Context'
              });
              if (uris && uris[0]) {
                await handleAddFileContext(uris[0].fsPath);
              }
              break;
            }

            case 'addSelection':
              await handleAddSelection();
              break;

            case 'removeContext':
              fileContexts.delete(message.payload);
              updateContextView();
              break;

            case 'clearContext':
              fileContexts.clear();
              updateContextView();
              break;

            case 'createFile':
              await handleCreateFile(message.payload.filePath, message.payload.content);
              break;

            case 'applyCodeBlock':
              await handleApplyCodeBlock(message.payload.filePath, message.payload.code);
              break;

            case 'promptCreateFile': {
              const target = await vscode.window.showInputBox({
                prompt: 'Enter relative or absolute file path to create (e.g. src/app.js)',
                value: message.payload.filePath || ''
              });
              if (target) {
                await handleCreateFile(target, message.payload.code);
              }
              break;
            }

            case 'promptApplyFile': {
              const target = await vscode.window.showInputBox({
                prompt: 'Enter file path to update (e.g. src/app.js)',
                value: message.payload.filePath || ''
              });
              if (target) {
                await handleApplyCodeBlock(target, message.payload.code);
              }
              break;
            }

            case 'configureApiKey': {
              const currentKey = vscode.workspace.getConfiguration('antigravity-nvidia-chat').get('apiKey') || '';
              const newKey = await vscode.window.showInputBox({
                prompt: 'Enter your NVIDIA NIM API Key (starts with nvapi-)',
                value: currentKey,
                password: true
              });
              if (newKey !== undefined) {
                await vscode.workspace.getConfiguration('antigravity-nvidia-chat').update('apiKey', newKey, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('NVIDIA API Key updated successfully!');
              }
              break;
            }
          }
        } catch (err) {
          vscode.window.showErrorMessage(`[Chat Error] ${err.message}`);
        }
      });
    }
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('antigravity-nvidia-chat.panel', viewProvider)
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravity-nvidia-chat.newChat', async () => {
      activeConversationId = crypto.randomUUID();
      await context.workspaceState.update('activeConversationId', activeConversationId);
      chatHistory = [];
      fileContexts.clear();
      if (panel) {
        panel.webview.postMessage({ type: 'clearChat' });
        panel.webview.postMessage({ type: 'updateContext', payload: [] });
      }
    }),
    vscode.commands.registerCommand('antigravity-nvidia-chat.clearHistory', () => {
      chatHistory = [];
      if (panel) {
        panel.webview.postMessage({ type: 'clearChat' });
      }
    }),
    vscode.commands.registerCommand('antigravity-nvidia-chat.addFileContext', async (uri) => {
      if (uri) {
        await handleAddFileContext(uri.fsPath);
      }
    }),
    vscode.commands.registerCommand('antigravity-nvidia-chat.addSelection', async () => {
      await handleAddSelection();
    }),
    vscode.commands.registerCommand('antigravity-nvidia-chat.importSession', async () => {
      if (panel) {
        const convs = await listAntigravityConversations();
        panel.webview.postMessage({ type: 'conversationsList', payload: convs });
      }
    })
  );

  // Track active editor changes for workspace context pill
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (panel && editor) {
      const relPath = vscode.workspace.asRelativePath(editor.document.fileName);
      panel.webview.postMessage({ type: 'activeFileChanged', payload: relPath });
    }
  });
}

function updateContextView() {
  if (!panel) return;
  const contexts = Array.from(fileContexts.entries()).map(([p, content]) => ({
    path: p,
    preview: content.slice(0, 200) + (content.length > 200 ? '...' : '')
  }));
  panel.webview.postMessage({ type: 'updateContext', payload: contexts });
}

async function handleSendMessage(context, userMessage) {
  if (!panel || !userMessage.trim()) return;

  const config = vscode.workspace.getConfiguration('antigravity-nvidia-chat');
  const apiKey = config.get('apiKey');
  const baseUrl = config.get('baseUrl') || 'https://integrate.api.nvidia.com/v1';
  const maxTokens = config.get('maxTokens') || 8192;
  const temperature = config.get('temperature') || 0.7;
  const ollamaUrl = config.get('ollamaUrl') || 'http://localhost:11434';
  const lmstudioUrl = config.get('lmstudioUrl') || 'http://localhost:1234';

  // Ensure active conversation ID exists
  if (!activeConversationId) {
    activeConversationId = crypto.randomUUID();
    await context.workspaceState.update('activeConversationId', activeConversationId);
  }

  // 1. Save user turn to in-memory history & webview
  chatHistory.push({ role: 'user', content: userMessage });
  panel.webview.postMessage({ type: 'addMessage', payload: { role: 'user', content: userMessage } });
  panel.webview.postMessage({ type: 'showTyping' });

  // 2. Persist user turn to transcript.jsonl on disk
  const userEntry = {
    step_index: chatHistory.length - 1,
    source: 'USER_EXPLICIT',
    type: 'USER_INPUT',
    status: 'DONE',
    created_at: new Date().toISOString(),
    content: `<USER_REQUEST>\n${userMessage}\n</USER_REQUEST>`
  };
  await appendTranscriptEntry(activeConversationId, userEntry);

  try {
    const messages = buildMessagesWithContext(userMessage, chatHistory.slice(0, -1), fileContexts, currentModel);
    let responseContent = '';
    let reasoningContent = '';

    const isNvidia = NVIDIA_MODELS.some(m => m.id === currentModel);
    const isOllama = currentModel.startsWith('ollama:');
    const isLMStudio = currentModel.startsWith('lmstudio:');

    if (isNvidia) {
      const response = await callNVIDIA_API(messages, { apiKey, baseUrl, model: currentModel, maxTokens, temperature }, true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta) {
                if (delta.reasoning_content) {
                  reasoningContent += delta.reasoning_content;
                  panel.webview.postMessage({ type: 'streamReasoningDelta', payload: delta.reasoning_content });
                }
                if (delta.content) {
                  responseContent += delta.content;
                  panel.webview.postMessage({ type: 'streamDelta', payload: delta.content });
                }
              }
            } catch (e) {}
          }
        }
      }
    } else if (isOllama) {
      const data = await callOllama_API(messages, { ollamaUrl, model: currentModel });
      responseContent = data.message?.content || '';
      panel.webview.postMessage({ type: 'streamDelta', payload: responseContent });
    } else if (isLMStudio) {
      const data = await callLMStudio_API(messages, { lmstudioUrl });
      responseContent = data.choices?.[0]?.message?.content || '';
      panel.webview.postMessage({ type: 'streamDelta', payload: responseContent });
    }

    // Format full response with reasoning block if present
    const fullAssistantMessage = (reasoningContent ? `<think>\n${reasoningContent}\n</think>\n\n` : '') + responseContent;

    if (fullAssistantMessage) {
      // 3. Save assistant turn to in-memory history
      chatHistory.push({ role: 'assistant', content: fullAssistantMessage });

      // 4. Persist assistant turn to transcript.jsonl on disk
      const assistantEntry = {
        step_index: chatHistory.length - 1,
        source: 'MODEL',
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: new Date().toISOString(),
        content: fullAssistantMessage
      };
      await appendTranscriptEntry(activeConversationId, assistantEntry);
    }

    panel.webview.postMessage({ type: 'hideTyping' });
  } catch (error) {
    console.error('[NVIDIA Chat] Error:', error);
    panel.webview.postMessage({
      type: 'addMessage',
      payload: {
        role: 'assistant',
        content: `❌ Error: ${error.message}`,
        error: true
      }
    });
    panel.webview.postMessage({ type: 'hideTyping' });
  }
}

async function handleAddFileContext(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const relativePath = vscode.workspace.asRelativePath(filePath);
    fileContexts.set(relativePath, content);
    updateContextView();
    vscode.window.showInformationMessage(`Added ${relativePath} to context`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to read file: ${error.message}`);
  }
}

async function handleAddSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  const document = editor.document;
  const selectedText = document.getText(selection);
  const relativePath = vscode.workspace.asRelativePath(document.fileName);
  const contextKey = `${relativePath}:${selection.start.line + 1}-${selection.end.line + 1}`;

  fileContexts.set(contextKey, selectedText);
  updateContextView();
  vscode.window.showInformationMessage(`Added selection (${contextKey}) to context`);
}

function deactivate() {
  console.log('[Antigravity Chat] Extension deactivated');
}

module.exports = { activate, deactivate };
