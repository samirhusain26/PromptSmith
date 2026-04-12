/**
 * PromptSmith - Shared Constants
 * 
 * Centralized constants used across multiple files to ensure consistency.
 */

// Default system prompt - single source of truth
export const DEFAULT_SYSTEM_PROMPT = 'Rewrite this prompt to be clear, concise, and professional. Fix any grammar errors.';

// Gemini API endpoint (base URL - model will be injected dynamically)
export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

// Groq API constants
export const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

// Default Settings
export const DEFAULT_CLOUD_PROVIDER = 'gemini';
export const DEFAULT_PERSONA = 'editor';

// Cloud Provider Models
export const CLOUD_MODELS = {
    gemini: [
        // The "Bleeding Edge" choice
        { value: 'gemini-3-flash-preview', label: '[Newest, Fastest, Smartest] Gemini 3 Flash' },
        // The "Sweet Spot" choice
        { value: 'gemini-2.5-flash', label: '[Balanced Speed & Logic] Gemini 2.5 Flash' },
        // The "Old Reliable" choice
        { value: 'gemini-2.0-flash', label: '[Cheap, Reliable Utility] Gemini 2.0 Flash' }
    ],
    groq: [
        // Best for simple rewrites
        { value: 'llama-3.1-8b-instant', label: '[Instant, Cheap, Basic] Llama 3.1 8B Instant' },
        // Best all-rounder for Prompt Polishing
        { value: 'llama-3.3-70b-versatile', label: '[Smart, Fast, Balanced] Llama 3.3 70B Versatile' },
        // Best for deep analysis/logic
        { value: 'openai/gpt-oss-120b', label: '[Expert Logic, Slower] GPT-OSS 120B' },
        // Good middle ground
        { value: 'openai/gpt-oss-20b', label: '[Efficient Mid-Range] GPT-OSS 20B' }
    ]
};
