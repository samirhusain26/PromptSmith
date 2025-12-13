/**
 * PromptSmith - WebLLM Service
 * 
 * Handles local in-browser AI using WebLLM and WebGPU.
 * Priority 3 in the fallback chain.
 */

// Selected model: Llama 3.2 1B Instruct (Quantized)
// Good balance of size (~879MB) and performance
const WEBLLM_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

// State tracks
let webllmEngine = null;
let downloadProgress = { status: 'idle', text: '', progress: 0 };

/**
 * Check if WebLLM is supported and ready
 */
async function checkWebLLMAvailability() {
    // 1. Check WebGPU support
    if (!navigator.gpu) {
        return {
            available: false,
            status: 'not_supported',
            reason: 'WebGPU is not supported in this browser environment.'
        };
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            return {
                available: false,
                status: 'not_supported',
                reason: 'No WebGPU adapter found.'
            };
        }
    } catch (e) {
        return {
            available: false,
            status: 'error',
            reason: 'Error checking WebGPU: ' + e.message
        };
    }

    // 2. Check if model is cached (approximated by checking if we have an engine or successful load before)
    if (webllmEngine) {
        return { available: true, status: 'ready', model: WEBLLM_MODEL_ID };
    }

    return {
        available: true,
        status: 'ready_to_init',
        reason: 'WebGPU available. Model needs to be loaded.'
    };
}

/**
 * Initialize/Download the WebLLM model
 * @param {Function} progressCallback - Optional callback for download progress
 */
async function loadWebLLMModel(progressCallback = null) {
    if (webllmEngine) {
        return true;
    }

    // Ensure self.webllm is available (injected by background.js import)
    if (!self.webllm) {
        throw new Error('WebLLM library not loaded');
    }

    console.log('[WebLLM] Starting engine initialization...');

    try {
        const initProgressCallback = (report) => {
            console.log('[WebLLM] Init:', report.text);

            // Update internal state
            downloadProgress = {
                status: 'downloading',
                text: report.text,
                progress: report.progress
            };

            // Notify via callback if provided
            if (progressCallback) {
                progressCallback(report);
            }

            // Broadcast to other parts of extension if needed
            chrome.runtime.sendMessage({
                type: 'WEBLLM_PROGRESS',
                data: downloadProgress
            }).catch(() => { }); // Ignore errors if no listeners
        };

        // Initialize engine
        const engine = new self.webllm.MLCEngine();

        // Reload model (triggers download if needed)
        await engine.reload(WEBLLM_MODEL_ID, {
            initProgressCallback: initProgressCallback
        });

        webllmEngine = engine;
        downloadProgress = { status: 'ready', text: 'Model loaded', progress: 1.0 };

        console.log('[WebLLM] Engine ready');
        return true;

    } catch (error) {
        console.error('[WebLLM] Load error:', error);
        downloadProgress = { status: 'error', text: error.message, progress: 0 };
        throw error;
    }
}

/**
 * Generate text using WebLLM
 */
async function generateWithWebLLM(userPrompt, systemInstruction) {
    // Ensure engine is loaded
    if (!webllmEngine) {
        await loadWebLLMModel();
    }

    console.log('[WebLLM] Generating...');

    try {
        const messages = [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt }
        ];

        const reply = await webllmEngine.chat.completions.create({
            messages,
            temperature: 0.7,
            max_tokens: 2048,
        });

        const text = reply.choices[0].message.content;
        console.log('[WebLLM] Generation complete');
        return text;

    } catch (error) {
        console.error('[WebLLM] Generation failed:', error);
        // If device lost or OOM, reset engine
        if (error.message.includes('DeviceLost') || error.message.includes('OOM')) {
            webllmEngine = null;
        }
        throw error;
    }
}

/**
 * Get current download/init progress
 */
function getWebLLMProgress() {
    return downloadProgress;
}

// Export object for ES Module
export const WebLLMService = {
    checkAvailability: checkWebLLMAvailability,
    loadModel: loadWebLLMModel,
    generate: generateWithWebLLM,
    getProgress: getWebLLMProgress,
    modelId: WEBLLM_MODEL_ID
};
