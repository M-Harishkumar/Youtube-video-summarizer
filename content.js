// Function to attempt to extract the transcript from YouTube's DOM
async function getYouTubeTranscript() {
    try {
        // First, check for the "Show transcript" button and click it if found
        // YouTube often uses a 3-dot menu or a direct button for transcript
        let transcriptButton = document.querySelector('tp-yt-paper-button.ytd-menu-renderer[aria-label="Show transcript"]');
        if (!transcriptButton) {
            // Newer YouTube layouts might have the "..." menu -> "Show transcript"
            const menuButton = document.querySelector('button[aria-label="More actions"]');
            if (menuButton) {
                menuButton.click(); // Open the menu
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait for menu to open

                // Find the "Show transcript" item within the opened menu
                transcriptButton = document.querySelector('ytd-menu-service-item-renderer #text.ytd-menu-service-item-renderer[text-content="Show transcript"], ytd-menu-service-item-renderer #text.ytd-menu-service-item-renderer[text-content="Show transcript"]');
                // Fallback for different text content if needed, e.g., "Transcript"
                if (!transcriptButton) {
                    transcriptButton = Array.from(document.querySelectorAll('ytd-menu-service-item-renderer #text')).find(el => el.textContent.includes('transcript'));
                }
                if (transcriptButton) {
                    transcriptButton.click(); // Click to show the transcript panel
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for panel to appear
                } else {
                    console.log("Could not find 'Show transcript' button in menu.");
                    // Click menu button again to close it if it was opened
                    if (menuButton) menuButton.click();
                }
            }
        } else {
            transcriptButton.click(); // Click the direct "Show transcript" button
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for panel to appear
        }

        // Now, try to find the transcript panel and extract text
        let transcriptContainer = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"] #transcript-content');
        if (!transcriptContainer) {
            transcriptContainer = document.querySelector('#segments-container'); // Common for newer versions
        }

        if (transcriptContainer) {
            // Extract all text segments, ignoring timestamps
            const segments = transcriptContainer.querySelectorAll('.segment-text'); // Standard class for text segments
            let fullTranscript = '';
            segments.forEach(segment => {
                fullTranscript += segment.textContent.trim() + ' ';
            });
            return fullTranscript.trim();
        } else {
            console.warn("YouTube transcript panel not found. It might not be available or DOM structure changed.");
            return null; // No transcript panel found
        }
    } catch (error) {
        console.error("Error getting YouTube transcript:", error);
        return null;
    }
}

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTranscript') {
        getYouTubeTranscript().then(transcript => {
            if (transcript) {
                sendResponse({ transcript: transcript });
            } else {
                sendResponse({ error: "No transcript found on the page or unable to extract." });
            }
        }).catch(error => {
            sendResponse({ error: "Error during transcript extraction: " + error.message });
        });
        return true; // Indicate that the response will be sent asynchronously
    }
});