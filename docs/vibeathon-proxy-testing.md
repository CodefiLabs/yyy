# Vibeathon Proxy Testing Guide

## Prerequisites

1. Ensure `app.vibeathon.test` Laravel backend is running
2. Have a valid Vibeathon API key

## Environment Setup

```bash
export DYAD_DISTRIBUTION_BUILD=true
export DYAD_DISTRIBUTION_PROXY_URL=http://app.vibeathon.test/api/v1
```

## Manual Testing Procedure

### 1. Start Application
```bash
npm start
```

### 2. Configure API Key
- Navigate to Settings > Vibeathon API Key
- Enter your API key
- Click "Validate & Save"
- Verify validation succeeds

### 3. Test Chat Request
- Create new app or open existing app
- Start a chat conversation
- Send message: "Hello, what's 2+2?"
- Verify response appears

### 4. Network Verification

Open Developer Tools (View > Toggle Developer Tools):

**Console Tab:**
- Should not show any network errors
- Should not show 401 unauthorized errors

**Network Tab:**
- Filter by "chat/completions"
- Verify requests go to `app.vibeathon.test/api/v1/chat/completions`
- Check request headers include `Authorization: Bearer <key>`
- Verify response status is 200
- Check response contains streaming data

### 5. Error Handling Test

**Invalid API Key:**
- Settings > Vibeathon API Key
- Enter invalid key "invalid-key-12345"
- Click "Validate & Save"
- Verify error message appears

**Network Failure:**
- Stop Laravel backend
- Send chat message
- Verify user-friendly error appears
- Restart backend
- Verify chat works again

### 6. Provider Fallback Test

**Test Fallback Keys:**
- Click "Fetch Provider Keys" in settings (if implemented)
- Verify fallback keys populate for OpenAI, Anthropic, etc.
- These should be used when proxy request fails

## Expected Flow

```
User Message
  ↓
ChatInput.tsx
  ↓
IPC: chat:stream
  ↓
chat_stream_handlers.ts
  ↓
getModelClient() [checks IS_DISTRIBUTION_BUILD]
  ↓
createOpenAI() with baseURL from DYAD_DISTRIBUTION_PROXY_URL
  ↓
transformToOpenAIFormat() [vibeathon_api.ts]
  ↓
HTTP POST to app.vibeathon.test/api/v1/chat/completions
  ↓
Stream response back to UI
```

## Troubleshooting

**Requests not going to vibeathon.test:**
- Check `DYAD_DISTRIBUTION_BUILD=true` is set
- Verify `DYAD_DISTRIBUTION_PROXY_URL` is set
- Check console for "Distribution mode enabled" message

**401 Unauthorized:**
- Verify API key is valid
- Check Authorization header in network tab
- Test key validation endpoint directly

**500 Server Error:**
- Check Laravel logs: `tail -f storage/logs/laravel.log`
- Verify database is running
- Check `.env` configuration in Laravel app

**Streaming not working:**
- Verify Laravel response includes correct headers:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `X-Accel-Buffering: no`

## Quick Test Script

Run the automated test script:

```bash
npm run test:proxy
```

This will:
1. Verify environment variables are set
2. Test proxy endpoint is reachable
3. Start the application for manual testing
