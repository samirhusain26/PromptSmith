# PromptSmith Agent Guide

PromptSmith is a privacy-first Chrome extension for refining prompts with cloud providers or Chrome's on-device model.

## Working rules

- Read `README.md` before changing providers, personas, permissions, or injected UI.
- Preserve direct-to-provider or on-device processing; do not introduce an intermediary backend or analytics without explicit authorization.
- Keep API keys and prompt history in extension-managed local/sync storage and never log prompt contents or credentials.
- Maintain graceful provider detection and clear privacy disclosure when cloud processing is selected.
- Keep permissions and host access as narrow as the supported-site behavior allows.

## Verify

- Load the unpacked extension and smoke-test the options page plus supported-site injection.
- Test local, configured-cloud, and unavailable-provider states when those paths change.
