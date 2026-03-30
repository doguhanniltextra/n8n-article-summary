// ============================================
// Article Summary — Frontend Logic
// ============================================

(function () {
    'use strict';

    // DOM Elements
    const inputText = document.getElementById('inputText');
    const charCount = document.getElementById('charCount');
    const sendBtn = document.getElementById('sendBtn');
    const sendBtnText = document.getElementById('sendBtnText');
    const sendSpinner = document.getElementById('sendSpinner');
    const clearBtn = document.getElementById('clearBtn');
    const outputCard = document.getElementById('outputCard');
    const outputContent = document.getElementById('outputContent');
    const copyBtn = document.getElementById('copyBtn');
    const statusBadge = document.getElementById('statusBadge');
    const toastContainer = document.getElementById('toastContainer');

    let lastResult = '';

    // ============================================
    // Character Count
    // ============================================
    inputText.addEventListener('input', updateCharCount);

    function updateCharCount() {
        const len = inputText.value.length;
        charCount.textContent = `${len.toLocaleString('en-US')} characters`;
    }

    // ============================================
    // Clear Button
    // ============================================
    clearBtn.addEventListener('click', () => {
        inputText.value = '';
        updateCharCount();
        inputText.focus();
        showToast('Text cleared', 'success');
    });

    // ============================================
    // Send / Summarize
    // ============================================
    sendBtn.addEventListener('click', handleSend);

    // Ctrl+Enter shortcut
    inputText.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    });

    async function handleSend() {
        const text = inputText.value.trim();
        if (!text) {
            showToast('Please enter some text', 'error');
            inputText.focus();
            return;
        }

        // UI: loading state
        setLoading(true);
        showSkeleton();

        try {
            const response = await fetch('/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text }),
            });

            const data = await response.json();

            if (data.success) {
                showResult(data.response);
                showToast('Summary received successfully!', 'success');
                outputCard.classList.add('success');
                outputCard.classList.remove('error-state');
            } else {
                showError(data.message);
                showToast('Error: ' + data.message, 'error');
                outputCard.classList.add('error-state');
                outputCard.classList.remove('success');
            }
        } catch (err) {
            showError('Could not connect to server: ' + err.message);
            showToast('Connection error', 'error');
            outputCard.classList.add('error-state');
            outputCard.classList.remove('success');
        } finally {
            setLoading(false);
        }
    }

    // ============================================
    // Loading State
    // ============================================
    function setLoading(loading) {
        sendBtn.disabled = loading;
        if (loading) {
            sendBtnText.textContent = 'Sending...';
            sendSpinner.style.display = 'block';
            setStatus('loading', 'Processing...');
        } else {
            sendBtnText.textContent = 'Summarize';
            sendSpinner.style.display = 'none';
            setStatus('ready', 'Ready');
        }
    }

    function setStatus(state, text) {
        const statusText = statusBadge.querySelector('.status-text');
        statusText.textContent = text;
        statusBadge.className = 'status-badge';
        if (state === 'loading') statusBadge.classList.add('loading');
        if (state === 'error') statusBadge.classList.add('error');
    }

    // ============================================
    // Output Display
    // ============================================
    function showSkeleton() {
        outputContent.innerHTML = `
            <div class="skeleton-container">
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
            </div>
        `;
        copyBtn.style.display = 'none';
    }

    function showResult(response) {
        let displayHTML = '';

        if (typeof response === 'string') {
            lastResult = response;
            displayHTML = `<div class="result-text">${escapeHTML(response)}</div>`;
        } else if (typeof response === 'object') {
            // Try to extract useful text from the response
            const extracted = extractText(response);
            if (extracted) {
                lastResult = extracted;
                displayHTML = `<div class="result-text">${formatText(extracted)}</div>`;
            } else {
                lastResult = JSON.stringify(response, null, 2);
                displayHTML = `<div class="result-json">${escapeHTML(lastResult)}</div>`;
            }
        }

        outputContent.innerHTML = displayHTML;
        copyBtn.style.display = 'flex';

        // Scroll to result
        outputCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showError(message) {
        outputContent.innerHTML = `
            <div class="empty-state" style="color: var(--error);">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
        copyBtn.style.display = 'none';
    }

    // ============================================
    // Copy Result
    // ============================================
    copyBtn.addEventListener('click', async () => {
        if (!lastResult) return;
        try {
            await navigator.clipboard.writeText(lastResult);
            showToast('Copied to clipboard!', 'success');
        } catch {
            showToast('Copy failed', 'error');
        }
    });

    // ============================================
    // Toast Notifications
    // ============================================
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? '✓' : '✕';
        toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHTML(message)}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ============================================
    // Helpers
    // ============================================
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatText(text) {
        // Convert newlines to paragraphs, basic formatting
        return text
            .split('\n\n')
            .filter(p => p.trim())
            .map(p => `<p>${escapeHTML(p.trim())}</p>`)
            .join('');
    }

    function extractText(obj) {
        // Try common response field names
        const fields = ['summary', 'text', 'content', 'result', 'output', 'message', 'response', 'data', 'ozet'];
        
        if (Array.isArray(obj)) {
            // If it's an array, try first element
            if (obj.length > 0) {
                return extractText(obj[0]);
            }
            return null;
        }

        if (typeof obj === 'object' && obj !== null) {
            for (const field of fields) {
                if (obj[field] && typeof obj[field] === 'string') {
                    return obj[field];
                }
            }
            // Try nested objects
            for (const key of Object.keys(obj)) {
                if (typeof obj[key] === 'object') {
                    const found = extractText(obj[key]);
                    if (found) return found;
                }
                if (typeof obj[key] === 'string' && obj[key].length > 50) {
                    return obj[key];
                }
            }
        }

        return null;
    }

    // ============================================
    // Init
    // ============================================
    updateCharCount();
    inputText.focus();
})();
