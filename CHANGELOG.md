# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-16

### Added

- Initial release of `@myntlo/sdk`.
- `MyntloClient` with configurable `apiKey`, `baseUrl`, `timeoutMs`, and `maxRetries`.
- Meetings: `list`, `get`, `getStatus`, `update`, `delete`, `export`, `upload` (File/Blob), `uploadFile` (Node file path), `waitUntilDone` polling, `getTranscript`, `getExtractions`, and async `iterate`.
- Uploads: `createPresignedUrl` and `complete` for browser-safe direct-to-storage uploads without exposing the API key.
- Action items: `list`, `get`, `create`, `update`, `updateStatus`, `markDone`, `delete`, and async `iterate`.
- Decisions: `list`, `get`, `search` (query string or options object), and async `iterate`.
- Organizations: `get` and `listMembers`.
- Webhook verification via `verifyMyntloWebhook` and `MyntloClient.verifyWebhook`, using `crypto.timingSafeEqual` for constant-time signature comparison.
- Typed error classes: `MyntloAPIError`, `MyntloAuthError`, `MyntloNotFoundError`, `MyntloRateLimitError`, `MyntloTimeoutError`, `MyntloValidationError`.
- Full TypeScript type declarations for all public APIs.
