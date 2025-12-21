/**
 * PromptSmith - Unified AI Service
 * 
 * Implements hybrid fallback system:
 * Priority 1: Cloud (Gemini Flash API) - if API key is provided
 * Priority 2: Local (Gemini Nano via LanguageModel API)
 */

import { GEMINI_API_ENDPOINT } from './constants.js';
import { META_PROMPT } from './prompts.js';

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
            console.log('[AI Service] Calling LanguageModel.availability()');

            // Note: The legacy availability() may not accept params, but we try to pass them
            // to suppress Chrome's "No output language was specified" warning
            let availability;
            try {
                availability = await LanguageModel.availability({
                    expectedOutputLanguages: ['en']
                });
            } catch (e) {
                // If params not supported, fall back to no-param call
                availability = await LanguageModel.availability();
            }
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

    // 3-LAYER PROMPT STRUCTURE:
    // Layer 1: System Instruction (persona-specific)
    // Layer 2: User Input (the text to polish)
    // Layer 3: Meta Prompt (forces AI to return only the rewritten prompt)
    const combinedPrompt = `${systemInstruction}

--- USER INPUT TO REWRITE ---
${userPrompt}
--- END USER INPUT ---
${META_PROMPT}`;

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

    // 3-LAYER PROMPT STRUCTURE for Cloud AI:
    // Layer 1: System Instruction (persona-specific + meta prompt)
    // Layer 2: User Input (the text to polish)
    // The meta prompt is appended to system instruction for Cloud API
    const fullSystemInstruction = `${systemInstruction}\n${META_PROMPT}`;

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: `--- USER INPUT TO REWRITE ---\n${userPrompt}\n--- END USER INPUT ---` }
                ]
            }
        ],
        systemInstruction: {
            parts: [
                { text: fullSystemInstruction }
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
    let preferredMode = 'hybrid';
    try {
        const storage = await chrome.storage.sync.get(['aiMode']);
        preferredMode = storage.aiMode || 'hybrid';
    } catch (e) {
        console.warn('Error reading aiMode config:', e);
    }

    const localAvailability = await checkLocalAIAvailability();

    // --- Mode: Local Only ---
    if (preferredMode === 'local') {
        if (localAvailability.available) {
            return {
                mode: 'local',
                status: '⚡ Local Only (Gemini Nano)',
                details: 'Using on-device Chrome AI.'
            };
        }
        return {
            mode: 'none',
            status: '❌ Local AI Unavailable',
            details: localAvailability.reason || 'Browser does not support Gemini Nano. Check chrome://flags.'
        };
    }

    // --- Mode: Cloud Only ---
    if (preferredMode === 'cloud') {
        if (apiKey && apiKey.trim().length > 0) {
            return {
                mode: 'cloud',
                status: '☁️ Cloud Only (Gemini Flash)',
                details: 'Using Google Cloud API.'
            };
        }
        return {
            mode: 'none',
            status: '❌ API Key Required',
            details: 'Cloud Only mode requires a Google Gemini API key.'
        };
    }

    // --- Mode: Hybrid (Default Fallback Chain) ---
    // Priority 1: Cloud API (Gemini Flash)
    if (apiKey && apiKey.trim().length > 0) {
        return {
            mode: 'cloud',
            status: '☁️ Hybrid: Cloud Active',
            details: 'Using Gemini Flash API. Falls back to Nano if unavailable.'
        };
    }

    // Priority 2: Local Gemini Nano
    if (localAvailability.available) {
        return {
            mode: 'local',
            status: '⚡ Hybrid: Local Fallback',
            details: 'Using on-device AI (no API key). Your prompts stay local.'
        };
    }

    // Fallback if nothing available
    return {
        mode: 'none',
        status: '⚠️ No AI Available',
        details: localAvailability.reason || 'Configure options in Settings.'
    };
}

/**
 * Main unified function to generate polished text
 * Priority depends on user preference:
 * Auto: Cloud AI → Local AI (Gemini Nano)
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
    let preferredMode = 'hybrid';
    let apiKey = null;

    try {
        const storage = await chrome.storage.sync.get(['geminiApiKey', 'aiMode']);
        apiKey = storage.geminiApiKey;
        preferredMode = storage.aiMode || 'hybrid';

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

    // --- Execution Logic ---

    // 1. Local Only Mode
    if (preferredMode === 'local') {
        try { return await tryGeminiNano(); }
        catch (e) { return { success: false, error: 'Local Only mode failed: ' + e.message, mode: 'local' }; }
    }

    // 2. Cloud Only Mode
    if (preferredMode === 'cloud') {
        try { return await tryCloud(); }
        catch (e) { return { success: false, error: 'Cloud Only mode failed: ' + e.message, mode: 'cloud' }; }
    }

    // 3. Hybrid Mode Fallback Chain
    // Chain: Cloud -> Nano

    // Attempt 1: Cloud (Gemini API)
    try {
        return await tryCloud();
    } catch (e) {
        console.warn('[AI Service] Auto-switch: Cloud failed, trying next...');
    }

    // Attempt 2: Gemini Nano (local)
    try {
        return await tryGeminiNano();
    } catch (e) {
        console.warn('[AI Service] Auto-switch: Nano failed');
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
