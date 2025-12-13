/**
 * PromptSmith - Unified AI Service
 * 
 * Implements hybrid fallback system:
 * Priority 1: Local (Gemini Nano via LanguageModel API)
 * Priority 2: Cloud (Gemini Flash API)
 * 
 * Privacy First: Only uses cloud when local fails and user explicitly provided API key
 */

import { GEMINI_API_ENDPOINT } from './constants.js';

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
    console.log('[AI Service] === Checking Local AI Availability ===');
    console.log('[AI Service] self.ai exists:', !!self.ai);
    console.log('[AI Service] self.ai.languageModel exists:', !!(self.ai && self.ai.languageModel));
    console.log('[AI Service] LanguageModel global exists:', typeof LanguageModel !== 'undefined');

    try {
        // 1. Try modern `self.ai.languageModel` API
        if (self.ai && self.ai.languageModel) {
            console.log('[AI Service] Using MODERN self.ai.languageModel API');
            console.log('[AI Service] Calling capabilities() with BOTH outputLanguage and expectedOutputLanguages');

            const capabilities = await self.ai.languageModel.capabilities({
                outputLanguage: 'en',
                expectedOutputLanguages: ['en']  // Also include array form for older API versions
            });
            console.log('[AI Service] Local AI capabilities result:', JSON.stringify(capabilities));

            if (capabilities.available === 'readily') {
                console.log('[AI Service] Status: READY');
                return { available: true, status: 'ready' };
            } else if (capabilities.available === 'after-download') {
                console.log('[AI Service] Status: DOWNLOADABLE');
                return {
                    available: false,
                    status: 'downloadable',
                    reason: 'Gemini Nano model needs to be downloaded.'
                };
            } else {
                console.log('[AI Service] Status: UNAVAILABLE - capabilities.available =', capabilities.available);
                return {
                    available: false,
                    status: 'unavailable',
                    reason: 'Gemini Nano not available on this device.'
                };
            }
        }

        // 2. Fallback to `LanguageModel` global (Origin Trial API)
        if (typeof LanguageModel !== 'undefined') {
            console.log('[AI Service] Using LEGACY LanguageModel global API');
            console.log('[AI Service] Calling LanguageModel.availability() with expectedOutputLanguages: ["en"] AND outputLanguage: "en"');

            // Try BOTH parameter styles to ensure compatibility
            const availability = await LanguageModel.availability({
                expectedOutputLanguages: ['en'],
                outputLanguage: 'en'  // Also include singular form
            });
            console.log('[AI Service] Local AI availability (Legacy) result:', availability);

            switch (availability) {
                case 'available':
                    console.log('[AI Service] Status: AVAILABLE');
                    return { available: true, status: 'ready' };
                case 'downloadable':
                    console.log('[AI Service] Status: DOWNLOADABLE');
                    return { available: false, status: 'downloadable', reason: 'Model downloadable.' };
                case 'downloading':
                    console.log('[AI Service] Status: DOWNLOADING');
                    return { available: false, status: 'downloading', reason: 'Model downloading.' };
                default:
                    console.log('[AI Service] Status: UNKNOWN -', availability);
                    return { available: false, status: 'unavailable', reason: 'Model unavailable.' };
            }
        }

        console.log('[AI Service] No AI API found!');
        return {
            available: false,
            status: 'not_supported',
            reason: 'Chrome AI API not found. Enable chrome://flags/#optimization-guide-on-device-model'
        };

    } catch (error) {
        console.error('[AI Service] Error checking local AI:', error);
        console.error('[AI Service] Error stack:', error.stack);
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
    console.log('[AI Service] === Getting Local AI Session ===');
    console.log('[AI Service] Current session exists:', !!localAISession);
    console.log('[AI Service] SystemPrompt length:', systemPrompt?.length || 0);

    try {
        // Destroy existing session if system prompt changed
        if (localAISession && cachedSystemPrompt !== systemPrompt) {
            console.log('[AI Service] System prompt changed, destroying old session');
            if (localAISession.destroy) localAISession.destroy();
            localAISession = null;
        }

        // Reuse existing session
        if (localAISession) {
            console.log('[AI Service] Reusing existing session');
            return localAISession;
        }

        // Create new session
        console.log('[AI Service] Creating new local AI session...');
        console.log('[AI Service] self.ai exists:', !!self.ai);
        console.log('[AI Service] self.ai.languageModel exists:', !!(self.ai && self.ai.languageModel));
        console.log('[AI Service] LanguageModel global exists:', typeof LanguageModel !== 'undefined');

        // Try modern API
        if (self.ai && self.ai.languageModel) {
            console.log('[AI Service] Creating session with MODERN self.ai.languageModel API');
            console.log('[AI Service] Session params: { systemPrompt: [truncated], outputLanguage: "en", expectedOutputLanguages: ["en"] }');

            localAISession = await self.ai.languageModel.create({
                systemPrompt: systemPrompt,
                outputLanguage: 'en', // Required by Chrome AI API - singular for modern API
                expectedOutputLanguages: ['en']  // Also include array form for compatibility
            });
            console.log('[AI Service] Session created successfully via modern API');
        }
        // Fallback to legacy API
        else if (typeof LanguageModel !== 'undefined') {
            console.log('[AI Service] Creating session with LEGACY LanguageModel API');
            console.log('[AI Service] Session params: { systemPrompt: [truncated], expectedOutputLanguages: ["en"], outputLanguage: "en" }');

            localAISession = await LanguageModel.create({
                systemPrompt: systemPrompt,
                expectedOutputLanguages: ['en'], // Legacy param
                outputLanguage: 'en'  // Also include modern param for compatibility
            });
            console.log('[AI Service] Session created successfully via legacy API');
        } else {
            console.error('[AI Service] No Local AI API found!');
            throw new Error('Local AI API not found');
        }

        cachedSystemPrompt = systemPrompt;
        return localAISession;

    } catch (error) {
        console.error('[AI Service] Error creating local AI session:', error);
        console.error('[AI Service] Error name:', error.name);
        console.error('[AI Service] Error message:', error.message);
        console.error('[AI Service] Error stack:', error.stack);
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
    console.log('[AI Service] Prompt length:', userPrompt.length, 'chars');
    console.log('[AI Service] System instruction length:', systemInstruction.length, 'chars');

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
        const fullUrl = `${GEMINI_API_ENDPOINT}?key=${apiKey}`;
        const maskedUrl = `${GEMINI_API_ENDPOINT}?key=${apiKey.substring(0, 8)}...`;
        console.log('[AI Service] Making request to:', maskedUrl);
        console.log('[AI Service] Request body:', JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');

        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('[AI Service] Response status:', response.status, response.statusText);
        console.log('[AI Service] Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            // Get raw text first for debugging
            const rawErrorText = await response.text();
            console.error('[AI Service] RAW ERROR RESPONSE:', rawErrorText);

            // Try to parse as JSON
            let errorData = {};
            try {
                errorData = JSON.parse(rawErrorText);
            } catch (e) {
                console.error('[AI Service] Could not parse error as JSON');
            }

            const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            const errorDetails = errorData.error?.details || [];
            const errorCode = errorData.error?.code;
            const errorStatus = errorData.error?.status;

            // Log full error for debugging
            console.error('[AI Service] Cloud AI Error Response:', {
                status: response.status,
                statusText: response.statusText,
                errorCode,
                errorStatus,
                errorMessage,
                errorDetails,
                fullError: errorData,
                rawResponse: rawErrorText.substring(0, 1000),
                promptSent: userPrompt.substring(0, 200) + (userPrompt.length > 200 ? '...' : ''),
                promptLength: userPrompt.length,
                systemInstructionLength: systemInstruction.length
            });

            if (response.status === 400) {
                throw new Error(`Invalid API request: ${errorMessage}`);
            } else if (response.status === 401 || response.status === 403) {
                throw new Error(`Invalid API key (${errorStatus || response.status}): ${errorMessage}`);
            } else if (response.status === 429) {
                // Extract quota/retry details from response headers or body
                const retryAfter = response.headers.get('Retry-After');
                const quotaDetails = errorDetails.find(d => d.reason === 'RATE_LIMIT_EXCEEDED' || d['@type']?.includes('QuotaFailure'));

                // Build detailed error message
                let detailedMsg = `Rate limit (${response.status}): ${errorMessage}`;

                if (retryAfter) {
                    detailedMsg += ` Retry after: ${retryAfter}s.`;
                }

                if (quotaDetails && quotaDetails.violations) {
                    console.error('[AI Service] Quota details:', quotaDetails);
                    const violations = quotaDetails.violations.map(v => `${v.subject || 'unknown'}: ${v.description || 'unknown'}`).join('; ');
                    detailedMsg += ` Quota: ${violations}.`;
                }

                // Log what was sent for debugging
                console.error('[AI Service] Request that caused rate limit:', {
                    promptPreview: userPrompt.substring(0, 500),
                    promptLength: userPrompt.length,
                    systemInstructionPreview: systemInstruction.substring(0, 200),
                    timestamp: new Date().toISOString()
                });

                detailedMsg += ` Try "Auto" mode for local AI fallback.`;

                throw new Error(detailedMsg);
            } else {
                throw new Error(`Cloud AI error (${response.status}): ${errorMessage}`);
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
    console.log('[AI Service] Input prompt length:', userPrompt?.length || 0);
    console.log('[AI Service] System instruction length:', systemInstruction?.length || 0);

    // Get configuration
    let preferredMode = 'auto';
    let apiKey = null;

    try {
        const storage = await chrome.storage.sync.get(['geminiApiKey', 'aiMode']);
        apiKey = storage.geminiApiKey;
        preferredMode = storage.aiMode || 'auto';

        // Debug: Log API key status (safely)
        console.log('[AI Service] API Key retrieved:', apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)} (${apiKey.length} chars)` : 'NOT SET');
        console.log('[AI Service] Preferred mode:', preferredMode);
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
        console.log('[AI Service] tryCloud called, API key check:', apiKey ? 'PRESENT' : 'MISSING');
        if (apiKey && apiKey.trim().length > 0) {
            console.log('[AI Service] Attempting Cloud API with key:', apiKey.substring(0, 8) + '...');
            console.log('[AI Service] Endpoint:', GEMINI_API_ENDPOINT);
            const rawText = await generateWithCloudAI(userPrompt, systemInstruction, apiKey);
            return {
                success: true,
                text: cleanAIResponse(rawText),
                mode: 'cloud'
            };
        }
        console.error('[AI Service] API Key is missing or empty!');
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
