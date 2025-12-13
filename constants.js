/**
 * PromptSmith - Shared Constants
 * 
 * Centralized constants used across multiple files to ensure consistency.
 */

// Default system prompt - single source of truth
export const DEFAULT_SYSTEM_PROMPT = 'Rewrite this prompt to be clear, concise, and professional. Fix any grammar errors.';

// Supported WebLLM Models
export const WEBLLM_MODELS = [
    {
        id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        name: 'Llama 3.2 1B (Fastest)',
        size: '~870MB',
        family: 'llama'
    },
    {
        id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        name: 'Llama 3.2 3B (Balanced)',
        size: '~2.3GB',
        family: 'llama'
    },
    {
        id: 'gemma-2-2b-it-q4f16_1-MLC',
        name: 'Gemma 2 2B (Google)',
        size: '~1.4GB',
        family: 'gemma'
    }
];

export const DEFAULT_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

// Gemini API endpoint
export const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
