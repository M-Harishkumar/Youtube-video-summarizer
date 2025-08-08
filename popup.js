document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const transcriptInput = document.getElementById('transcriptInput');
    const summaryOutput = document.getElementById('summaryOutput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const messageBox = document.getElementById('messageBox');

    // Load API key from storage
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
    });

    // Save API key to storage
    saveApiKeyBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
                showMessage('API Key saved!', 'success');
            });
        } else {
            showMessage('Please enter an API key.', 'error');
        }
    });

    // Listen for messages from content.js (transcript) or background.js (summary)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'displayTranscript' && request.transcript) {
            transcriptInput.value = request.transcript;
            showMessage('Transcript loaded! Click Summarize.', 'info');
        } else if (request.action === 'showSummary' && request.summary) {
            summaryOutput.textContent = request.summary;
            loadingIndicator.classList.add('hidden');
            showMessage('Summary generated!', 'success');
        } else if (request.action === 'showError') {
            summaryOutput.textContent = 'Error: ' + request.message;
            loadingIndicator.classList.add('hidden');
            showMessage(request.message, 'error');
        } else if (request.action === 'showLoading') {
            loadingIndicator.classList.remove('hidden');
            summaryOutput.textContent = 'Summarizing...';
        }
    });

    // Summarize button click handler
    summarizeBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showMessage('Please save your Gemini API Key first.', 'error');
            return;
        }

        const transcript = transcriptInput.value.trim();
        if (!transcript) {
            showMessage('No transcript found or pasted. Please ensure you are on a YouTube video page with an available transcript, or paste it manually.', 'error');
            return;
        }

        loadingIndicator.classList.remove('hidden');
        summaryOutput.textContent = 'Summarizing...';
        showMessage('Requesting summary...', 'info');

        // Send message to background script to summarize
        chrome.runtime.sendMessage({
            action: 'summarizeVideo',
            transcript: transcript,
            apiKey: apiKey
        });
    });

    // Function to show messages
    function showMessage(msg, type) {
        messageBox.textContent = msg;
        messageBox.className = `message-box ${type}`; // Add type for styling if needed (e.g., error, success)
        messageBox.classList.remove('hidden');
        setTimeout(() => {
            messageBox.classList.add('hidden');
        }, 3000); // Hide after 3 seconds
    }

    // When the popup opens, try to get the transcript from the current YouTube tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes("youtube.com/watch")) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['content.js']
            }, () => {
                // Once content.js is injected, send a message to it to get the transcript
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getTranscript' }, (response) => {
                    if (chrome.runtime.lastError) {
                        // console.error("Error sending message to content script: ", chrome.runtime.lastError.message);
                        showMessage('Could not automatically get transcript. Please open the YouTube transcript panel or paste manually.', 'warning');
                    }
                    if (response && response.transcript) {
                        transcriptInput.value = response.transcript;
                        showMessage('Transcript loaded from video. Click Summarize.', 'success');
                    } else if (response && response.error) {
                         showMessage('Failed to get transcript: ' + response.error + '. Please paste manually.', 'error');
                    } else {
                         showMessage('No transcript detected automatically. Please open the YouTube transcript panel or paste manually.', 'warning');
                    }
                });
            });
        } else {
            showMessage('Navigate to a YouTube video page to use the summarizer.', 'warning');
        }
    });
});
