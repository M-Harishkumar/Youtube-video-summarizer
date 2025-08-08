// Exponential backoff for API retries
async function fetchWithExponentialBackoff(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            } else if (response.status === 429) { // Too Many Requests
                console.warn(`API rate limit hit. Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential increase
            } else {
                const errorText = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorText}`);
            }
        } catch (error) {
            if (i === retries - 1) {
                throw error; // Re-throw if last retry
            }
            console.warn(`Fetch error: ${error.message}. Retrying in ${delay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential increase
        }
    }
}


// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'summarizeVideo') {
        const transcript = request.transcript;
        const apiKey = request.apiKey;

        if (!transcript) {
            chrome.runtime.sendMessage({ action: 'showError', message: 'No transcript provided for summarization.' });
            return;
        }
        if (!apiKey) {
            chrome.runtime.sendMessage({ action: 'showError', message: 'Gemini API Key is missing. Please set it in the extension popup.' });
            return;
        }

        const prompt = `Please summarize the following YouTube video transcript in a very beginner-friendly and easy-to-understand way. Assume the reader has no prior knowledge of the topic. Break down complex ideas simply, use analogies if helpful, and keep the language clear and concise. Focus on the main points and key takeaways.\n\nTranscript:\n${transcript}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                // You can adjust temperature for creativity vs. focus
                // 0.7 is a good balance for summarization
                temperature: 0.7,
                topK: 40,
                topP: 0.95
            },
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        chrome.runtime.sendMessage({ action: 'showLoading' }); // Notify popup that summarization started

        fetchWithExponentialBackoff(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const summary = result.candidates[0].content.parts[0].text;
                chrome.runtime.sendMessage({ action: 'showSummary', summary: summary });
            } else {
                let errorMessage = 'Could not generate summary. Unexpected API response.';
                if (result.error && result.error.message) {
                    errorMessage = `API Error: ${result.error.message}`;
                }
                chrome.runtime.sendMessage({ action: 'showError', message: errorMessage });
            }
        })
        .catch(error => {
            console.error('Error calling Gemini API:', error);
            chrome.runtime.sendMessage({ action: 'showError', message: `Failed to summarize: ${error.message}` });
        });

        return true; // Indicate that the response will be sent asynchronously
    }
});
