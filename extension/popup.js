// ============================================
// Article Summarizer — Chrome Extension
// ============================================

const N8N_ENDPOINT = 'http://localhost:5678/webhook/article-summary';

const textInput = document.getElementById('textInput');
const sendBtn = document.getElementById('sendBtn');
const grabBtn = document.getElementById('grabBtn');
const charCount = document.getElementById('charCount');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const result = document.getElementById('result');
const resultActions = document.getElementById('resultActions');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');

let lastSummary = '';

// Character count
textInput.addEventListener('input', () => {
  charCount.textContent = textInput.value.length.toLocaleString('en-US') + ' characters';
});

// Grab selected text from active tab
grabBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: selectedText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    });

    if (selectedText && selectedText.trim()) {
      textInput.value = selectedText.trim();
      charCount.textContent = textInput.value.length.toLocaleString('en-US') + ' characters';
      setStatus('ready', 'Text captured');
    } else {
      setStatus('error', 'No text selected');
      setTimeout(() => setStatus('ready', 'Ready'), 2000);
    }
  } catch (err) {
    setStatus('error', 'Access error');
    setTimeout(() => setStatus('ready', 'Ready'), 2000);
  }
});

// Send to n8n
sendBtn.addEventListener('click', async () => {
  const text = textInput.value.trim();
  if (!text) {
    setStatus('error', 'Enter text');
    setTimeout(() => setStatus('ready', 'Ready'), 2000);
    return;
  }

  sendBtn.disabled = true;
  setStatus('loading', 'Processing...');
  result.className = 'result visible';
  result.textContent = 'Generating summary...';

  try {
    const response = await fetch(N8N_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    // Extract summary from response
    let summary = '';
    if (data.choices && data.choices[0]) {
      summary = data.choices[0].message.content;
    } else if (data.summary) {
      summary = data.summary;
    } else if (typeof data === 'string') {
      summary = data;
    } else {
      summary = JSON.stringify(data, null, 2);
    }

    lastSummary = summary;
    result.className = 'result visible success';
    result.textContent = summary;
    resultActions.className = 'result-actions visible';
    setStatus('ready', 'Completed');

  } catch (err) {
    result.className = 'result visible error';
    result.textContent = 'Error: ' + err.message;
    setStatus('error', 'Connection error');
  } finally {
    sendBtn.disabled = false;
  }
});

// Copy result
copyBtn.addEventListener('click', async () => {
  if (!lastSummary) return;
  await navigator.clipboard.writeText(lastSummary);
  copyBtn.textContent = '✓ Copied';
  setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
});

// Clear all
clearBtn.addEventListener('click', () => {
  textInput.value = '';
  result.className = 'result';
  result.textContent = '';
  resultActions.className = 'result-actions';
  charCount.textContent = '0 characters';
  lastSummary = '';
  setStatus('ready', 'Ready');
});

function setStatus(state, text) {
  statusDot.className = 'status-dot' + (state !== 'ready' ? ' ' + state : '');
  statusText.textContent = text;
}

// Check for pending text from context menu
chrome.storage.local.get('pendingText', (data) => {
  if (data.pendingText) {
    textInput.value = data.pendingText;
    charCount.textContent = data.pendingText.length.toLocaleString('en-US') + ' characters';
    chrome.storage.local.remove('pendingText');
    chrome.action.setBadgeText({ text: '' });
  }
});
