/**
 * PromptSmith - Unified AI Service
 * 
 * Implements hybrid fallback system:
 * Priority 1: Local (Gemini Nano via LanguageModel API)
 * Priority 2: Cloud (Gemini Flash API)
 * 
 * Privacy First: Only uses cloud when local fails and user explicitly provided API key
 */

// Constants
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Cache for AI session
let localAISession = null;
let cachedSystemPrompt = null;

// ============================================================
// LOCAL AI (Gemini Nano) FUNCTIONS
// ============================================================

/**
 * Check if local AI (Gemini Nano) is available
 * @returns {Promise<{available: boolean, status: string, reason?: string}>}
 */
async function checkLocalAIAvailability() {
    try {
        // 1. Try modern `self.ai.languageModel` API
        if (self.ai && self.ai.languageModel) {
            const capabilities = await self.ai.languageModel.capabilities();
            console.log('[AI Service] Local AI capabilities:', capabilities);

            if (capabilities.available === 'readily') {
                return { available: true, status: 'ready' };
            } else if (capabilities.available === 'after-download') {
                return {
                    available: false,
                    status: 'downloadable',
                    reason: 'Gemini Nano model needs to be downloaded.'
                };
            } else {
                return {
                    available: false,
                    status: 'unavailable',
                    reason: 'Gemini Nano not available on this device.'
                };
            }
        }

        // 2. Fallback to `LanguageModel` global (Origin Trial API)
        if (typeof LanguageModel !== 'undefined') {
            // Note: passing expectedOutputLanguages is required by recent API changes
            const availability = await LanguageModel.availability({ expectedOutputLanguages: ['en'] });
            console.log('[AI Service] Local AI availability (Legacy):', availability);

            switch (availability) {
                case 'available':
                    return { available: true, status: 'ready' };
                case 'downloadable':
                    return { available: false, status: 'downloadable', reason: 'Model downloadable.' };
                case 'downloading':
                    return { available: false, status: 'downloading', reason: 'Model downloading.' };
                default:
                    return { available: false, status: 'unavailable', reason: 'Model unavailable.' };
            }
        }

        return {
            available: false,
            status: 'not_supported',
            reason: 'Chrome AI API not found. Enable chrome://flags/#optimization-guide-on-device-model'
        };

    } catch (error) {
        console.error('[AI Service] Error checking local AI:', error);
        return {
            available: false,
            status: 'error',
            reason: `Error: ${error.message}`
        };
    }
}

/**
 * Create or reuse a local AI session
 * @param {string} systemPrompt - The system instruction for the AI
 * @returns {Promise<object>} - The AI session
 */
async function getLocalAISession(systemPrompt) {
    try {
        // Destroy existing session if system prompt changed
        if (localAISession && cachedSystemPrompt !== systemPrompt) {
            if (localAISession.destroy) localAISession.destroy();
            localAISession = null;
        }

        // Reuse existing session
        if (localAISession) {
            return localAISession;
        }

        // Create new session
        console.log('[AI Service] Creating new local AI session');

        // Try modern API
        if (self.ai && self.ai.languageModel) {
            localAISession = await self.ai.languageModel.create({
                systemPrompt: systemPrompt
            });
        }
        // Fallback to legacy API
        else if (typeof LanguageModel !== 'undefined') {
            localAISession = await LanguageModel.create({
                systemPrompt: systemPrompt,
                expectedOutputLanguages: ['en'] // Explicitly required
            });
        } else {
            throw new Error('Local AI API not found');
        }

        cachedSystemPrompt = systemPrompt;
        return localAISession;

    } catch (error) {
        console.error('[AI Service] Error creating local AI session:', error);
        throw error;
    }
}

/**
 * Generate text using local AI (Gemini Nano)
 * @param {string} userPrompt - The user's input text to polish
 * @param {string} systemInstruction - The system instruction for polishing
 * @returns {Promise<string>} - The polished text
 */
async function generateWithLocalAI(userPrompt, systemInstruction) {
    const startTotal = performance.now();

    // Construct a combined prompt to force the model to follow instructions.
    // We do this because sometimes the 'systemPrompt' parameter in the API is ignored 
    // or treated weakly by the on-device model.
    const combinedPrompt = `${systemInstruction}\n\nInput to rewrite:\n"${userPrompt}"\n\nRewritten version:`;

    console.log('[AI Service] Combined Prompt:', combinedPrompt);

    const sessionStart = performance.now();
    // We pass the system instruction to the session creation too, just in case,
    // but the combined prompt is our primary enforcement mechanism.
    const session = await getLocalAISession(systemInstruction);
    const sessionTime = performance.now() - sessionStart;

    console.log(`[AI Service] Session creation/retrieval took ${sessionTime.toFixed(2)}ms`);
    console.log('[AI Service] Sending prompt to local AI...');

    const promptStart = performance.now();
    const result = await session.prompt(combinedPrompt); // Send the combined prompt
    const promptTime = performance.now() - promptStart;

    console.log(`[AI Service] Local AI response received in ${promptTime.toFixed(2)}ms`);

    return {
        text: result,
        timings: {
            session: sessionTime,
            inference: promptTime,
            total: performance.now() - startTotal
        }
    };
}

// ============================================================
// CLOUD AI (Gemini Flash) FUNCTIONS
// ============================================================

/**
 * Generate text using cloud AI (Gemini Flash API)
 * @param {string} userPrompt - The user's input text to polish
 * @param {string} systemInstruction - The system instruction for polishing
 * @param {string} apiKey - The user's Google Gemini API key
 * @returns {Promise<string>} - The polished text
 */
async function generateWithCloudAI(userPrompt, systemInstruction, apiKey) {
    console.log('[AI Service] Sending prompt to cloud AI (Gemini Flash)...');

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: userPrompt }
                ]
            }
        ],
        systemInstruction: {
            parts: [
                { text: systemInstruction }
            ]
        },
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
        }
    };

    try {
        const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;

            if (response.status === 400) {
                throw new Error(`Invalid API request: ${errorMessage}`);
            } else if (response.status === 401 || response.status === 403) {
                throw new Error('Invalid API key. Please check your Google Gemini API key in Settings.');
            } else if (response.status === 429) {
                throw new Error('API rate limit exceeded. Please try again later.');
            } else {
                throw new Error(`Cloud AI error: ${errorMessage}`);
            }
        }

        const data = await response.json();

        // Extract text from response
        const candidates = data.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('No response generated from cloud AI');
        }

        const text = candidates[0].content?.parts?.[0]?.text;
        if (!text) {
            throw new Error('Empty response from cloud AI');
        }

        console.log('[AI Service] Cloud AI response received');
        return text;

    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error. Please check your internet connection.');
        }
        throw error;
    }
}

// ============================================================
// UNIFIED API
// ============================================================

/**
 * Get the current AI mode based on availability and user preference
 * @param {string} apiKey - Optional API key to check
 * @returns {Promise<{mode: string, status: string, details: string}>}
 */
async function getAIMode(apiKey = null) {
    // Get user preference
    let preferredMode = 'auto';
    try {
        const storage = await chrome.storage.sync.get(['aiMode']);
        preferredMode = storage.aiMode || 'auto';
    } catch (e) {
        console.warn('Error reading aiMode config:', e);
    }

    const localAvailability = await checkLocalAIAvailability();
    let webLLMAvailability = { available: false, status: 'unavailable', reason: 'Service not loaded' };

    if (self.WebLLMService) {
        webLLMAvailability = await self.WebLLMService.checkAvailability();
    }

    // --- Mode: WebLLM Specific ---
    if (preferredMode === 'webllm') {
        if (webLLMAvailability.available) {
            // Check if model is actually ready (loaded)
            if (webLLMAvailability.status === 'ready') {
                return {
                    mode: 'webllm',
                    status: '🌐 WebLLM (Ready)',
                    details: 'Using local Llama 3.2 model.'
                };
            } else {
                return {
                    mode: 'webllm',
                    status: '🌐 WebLLM (Needs Setup)',
                    details: 'WebGPU supported. Model needs to be downloaded in Settings.'
                };
            }
        }
        return {
            mode: 'none',
            status: '⚠️ WebLLM Not Supported',
            details: webLLMAvailability.reason || 'Browser does not support WebGPU.'
        };
    }

    // --- Mode: Gemini Nano Specific ---
    if (preferredMode === 'gemini-nano') {
        if (localAvailability.available) {
            return {
                mode: 'local',
                status: '⚡ Gemini Nano (Forced)',
                details: 'Using on-device Chrome AI.'
            };
        }
        return {
            mode: 'none',
            status: '⚠️ Gemini Nano Unavailable',
            details: localAvailability.reason || 'Check chrome://flags.'
        };
    }

    // --- Mode: Cloud Specific ---
    if (preferredMode === 'gemini-flash') {
        if (apiKey && apiKey.trim().length > 0) {
            return {
                mode: 'cloud',
                status: '☁️ Gemini Flash (Forced)',
                details: 'Using Google Cloud API.'
            };
        }
        return {
            mode: 'none',
            status: '⚠️ API Key Missing',
            details: 'Please add your Google Gemini API key in Settings.'
        };
    }

    // --- Mode: Auto (Default Fallback Chain) ---
    // Priority 1: Local Gemini Nano
    if (localAvailability.available) {
        return {
            mode: 'local',
            status: '⚡ Auto: (Gemini Nano)',
            details: 'Using on-device AI. Your prompts never leave your browser.'
        };
    }

    // Priority 2: Cloud API
    if (apiKey && apiKey.trim().length > 0) {
        return {
            mode: 'cloud',
            status: '☁️ Auto: (Gemini Flash)',
            details: 'Using Google Gemini API. Prompts are sent to Google servers.'
        };
    }

    // Priority 3: WebLLM (Only if ready/loaded to avoid unexpected large downloads)
    if (webLLMAvailability.status === 'ready') {
        return {
            mode: 'webllm',
            status: '🌐 Auto: (WebLLM)',
            details: 'Using local Llama 3.2 model.'
        };
    }

    // Fallback if nothing available
    // Hint at what's possible
    let hint = 'Configure options in Settings.';
    if (webLLMAvailability.available) hint = 'WebLLM supported but model not loaded. Download it in Settings.';

    return {
        mode: 'none',
        status: '⚠️ No AI Available',
        details: localAvailability.reason || hint
    };
}

/**
 * Main unified function to generate polished text
 * Priority depends on user preference:
 * Auto: Local AI → Cloud AI → WebLLM
 * Forced: Specific Mode → Error
 * 
 * @param {string} userPrompt - The user's input text to polish
 * @param {string} systemInstruction - The system instruction for polishing
 * @returns {Promise<{success: boolean, text?: string, error?: string, mode: string}>}
 */
async function generatePolishedText(userPrompt, systemInstruction) {
    console.log('[AI Service] generatePolishedText called');

    // Get configuration
    let preferredMode = 'auto';
    let apiKey = null;

    try {
        const storage = await chrome.storage.sync.get(['geminiApiKey', 'aiMode']);
        apiKey = storage.geminiApiKey;
        preferredMode = storage.aiMode || 'auto';
    } catch (error) {
        console.error('[AI Service] Error accessing storage:', error);
    }

    // --- Helper for execution ---

    /**
     * Helper to clean up response by stripping <result> tags
     */
    const cleanAIResponse = (text) => {
        if (!text) return '';
        // Match content inside <result>...</result>, case insensitive, across lines
        const match = text.match(/<result>([\s\S]*?)<\/result>/i);
        if (match && match[1]) {
            return match[1].trim();
        }
        // Fallback: return original text if no tags found
        return text.trim();
    };

    const tryGeminiNano = async () => {
        const avail = await checkLocalAIAvailability();
        if (avail.available) {
            console.log('[AI Service] Attempting local Gemini Nano...');
            const result = await generateWithLocalAI(userPrompt, systemInstruction);
            return {
                success: true,
                text: cleanAIResponse(result.text),
                timings: result.timings,
                mode: 'local'
            };
        }
        throw new Error('Gemini Nano unavailable: ' + avail.reason);
    };

    const tryCloud = async () => {
        if (apiKey && apiKey.trim().length > 0) {
            console.log('[AI Service] Attempting Cloud API...');
            const rawText = await generateWithCloudAI(userPrompt, systemInstruction, apiKey);
            return {
                success: true,
                text: cleanAIResponse(rawText),
                mode: 'cloud'
            };
        }
        throw new Error('API Key missing');
    };

    const tryWebLLM = async () => {
        if (self.WebLLMService) {
            const avail = await self.WebLLMService.checkAvailability();
            if (avail.available) {
                // If auto mode, only use if READY
                if (preferredMode === 'auto' && avail.status !== 'ready') {
                    throw new Error('WebLLM model not loaded');
                }

                console.log('[AI Service] Attempting WebLLM...');
                const rawText = await self.WebLLMService.generate(userPrompt, systemInstruction);
                return {
                    success: true,
                    text: cleanAIResponse(rawText),
                    mode: 'webllm'
                };
            }
            throw new Error('WebLLM unavailable: ' + avail.reason);
        }
        throw new Error('WebLLM Service missing');
    };

    // --- Execution Logic ---

    // 1. Forced Modes
    if (preferredMode === 'gemini-nano') {
        try { return await tryGeminiNano(); }
        catch (e) { return { success: false, error: e.message, mode: 'local' }; }
    }
    if (preferredMode === 'gemini-flash') {
        try { return await tryCloud(); }
        catch (e) { return { success: false, error: e.message, mode: 'cloud' }; }
    }
    if (preferredMode === 'webllm') {
        try { return await tryWebLLM(); }
        catch (e) { return { success: false, error: e.message + ' (Check Settings to download model)', mode: 'webllm' }; }
    }

    // 2. Auto Mode Fallback Chain
    // Chain: Nano -> Cloud -> WebLLM

    // Attempt 1: Nano
    try {
        return await tryGeminiNano();
    } catch (e) {
        console.warn('[AI Service] Auto-switch: Nano failed, trying next...');
    }

    // Attempt 2: Cloud
    try {
        return await tryCloud();
    } catch (e) {
        console.warn('[AI Service] Auto-switch: Cloud failed, trying next...');
    }

    // Attempt 3: WebLLM
    try {
        return await tryWebLLM();
    } catch (e) {
        console.warn('[AI Service] Auto-switch: WebLLM failed');
    }

    // All failed
    return {
        success: false,
        error: 'No AI available. Please configure an AI option in Settings.',
        mode: 'none'
    };
}



// Export for use in other modules
export const AIService = {
    generatePolishedText,
    checkLocalAIAvailability,
    getAIMode
};
