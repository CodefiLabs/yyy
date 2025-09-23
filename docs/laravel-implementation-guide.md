# Laravel Implementation Guide for Vibeathon API

This guide provides detailed implementation instructions for creating the Laravel backend that supports Dyad's distribution proxy routing system.

## Overview

The Laravel backend serves as a proxy service that:
1. Authenticates Dyad distribution builds via API keys
2. Routes AI requests to various providers (OpenAI, Anthropic, Google, xAI)
3. Provides fallback API keys for offline scenarios
4. Syncs failed requests when the service comes back online

## Required Packages

```bash
# Core Laravel packages
composer require laravel/sanctum
composer require guzzlehttp/guzzle
composer require predis/predis

# For streaming responses
composer require react/socket

# For encryption
composer require defuse/php-encryption
```

## Database Schema

### Users Table (if not exists)
```sql
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified_at TIMESTAMP NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
```

### API Keys Table
```sql
CREATE TABLE user_api_keys (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'google', 'xai'
    api_key TEXT NOT NULL, -- encrypted
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_provider (user_id, provider)
);
```

### Failed Requests Table
```sql
CREATE TABLE failed_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    request_id VARCHAR(255) UNIQUE NOT NULL,
    original_timestamp TIMESTAMP NOT NULL,
    request_data JSON NOT NULL,
    error_message TEXT NOT NULL,
    synced_at TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Personal Access Tokens (for Sanctum)
```bash
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
php artisan migrate
```

## Models

### UserApiKey Model
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Defuse\Crypto\Crypto;
use Defuse\Crypto\Key;

class UserApiKey extends Model
{
    protected $fillable = [
        'user_id',
        'provider',
        'api_key',
        'expires_at',
        'is_active'
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'is_active' => 'boolean'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // Encrypt API key before saving
    public function setApiKeyAttribute($value)
    {
        $key = Key::loadFromAsciiSafeString(config('app.encryption_key'));
        $this->attributes['api_key'] = Crypto::encrypt($value, $key);
    }

    // Decrypt API key when accessing
    public function getApiKeyAttribute($value)
    {
        $key = Key::loadFromAsciiSafeString(config('app.encryption_key'));
        return Crypto::decrypt($value, $key);
    }
}
```

### FailedRequest Model
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FailedRequest extends Model
{
    protected $fillable = [
        'user_id',
        'request_id',
        'original_timestamp',
        'request_data',
        'error_message',
        'synced_at'
    ];

    protected $casts = [
        'original_timestamp' => 'datetime',
        'request_data' => 'array',
        'synced_at' => 'datetime'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

## Controllers

### UserApiKeysController
```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserApiKey;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserApiKeysController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $apiKeys = UserApiKey::where('user_id', $user->id)
            ->where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('expires_at')
                      ->orWhere('expires_at', '>', now());
            })
            ->get();

        $response = [
            'expiration' => Carbon::now()->addDays(30)->toISOString()
        ];

        foreach ($apiKeys as $apiKey) {
            $response[$apiKey->provider] = $apiKey->api_key;
        }

        return response()->json($response);
    }
}
```

### ProxyController
```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiProxyService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ProxyController extends Controller
{
    private AiProxyService $proxyService;

    public function __construct(AiProxyService $proxyService)
    {
        $this->proxyService = $proxyService;
    }

    public function chatCompletions(Request $request)
    {
        $validated = $request->validate([
            'model' => 'required|string',
            'messages' => 'required|array',
            'messages.*.role' => 'required|string|in:system,user,assistant',
            'messages.*.content' => 'required|string',
            'stream' => 'boolean',
            'max_tokens' => 'integer|min:1|max:4000',
            'temperature' => 'numeric|min:0|max:2',
            'metadata' => 'array'
        ]);

        $user = $request->user();

        return $this->proxyService->proxyRequest($user, $validated);
    }

    public function health()
    {
        return response()->json([
            'status' => 'healthy',
            'timestamp' => now()->toISOString(),
            'version' => '1.0.0',
            'services' => [
                'database' => 'healthy',
                'openai' => 'healthy',
                'anthropic' => 'healthy',
                'google' => 'healthy'
            ]
        ]);
    }
}
```

### FailedRequestController
```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FailedRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FailedRequestController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'request_id' => 'required|string|unique:failed_requests',
            'original_timestamp' => 'required|date',
            'request_data' => 'required|array',
            'error' => 'required|string'
        ]);

        $failedRequest = FailedRequest::create([
            'user_id' => $request->user()->id,
            'request_id' => $validated['request_id'],
            'original_timestamp' => $validated['original_timestamp'],
            'request_data' => $validated['request_data'],
            'error_message' => $validated['error'],
            'synced_at' => now()
        ]);

        return response()->json([
            'message' => 'Request synced successfully',
            'request_id' => $failedRequest->request_id,
            'synced_at' => $failedRequest->synced_at->toISOString()
        ]);
    }
}
```

## Services

### AiProxyService
```php
<?php

namespace App\Services;

use App\Models\UserApiKey;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Http\StreamedResponse;
use Illuminate\Support\Facades\Log;

class AiProxyService
{
    private Client $client;

    public function __construct()
    {
        $this->client = new Client([
            'timeout' => 30,
            'connect_timeout' => 10
        ]);
    }

    public function proxyRequest($user, array $requestData)
    {
        $provider = $this->determineProvider($requestData['model']);
        $apiKey = $this->getUserApiKey($user, $provider);

        if (!$apiKey) {
            return response()->json([
                'error' => [
                    'message' => "No API key configured for provider: {$provider}",
                    'type' => 'authentication_error'
                ]
            ], 401);
        }

        $endpoint = $this->getProviderEndpoint($provider);
        $headers = $this->getProviderHeaders($provider, $apiKey);

        try {
            if ($requestData['stream'] ?? false) {
                return $this->handleStreamingRequest($endpoint, $headers, $requestData);
            } else {
                return $this->handleRegularRequest($endpoint, $headers, $requestData);
            }
        } catch (RequestException $e) {
            Log::error('Proxy request failed', [
                'user_id' => $user->id,
                'provider' => $provider,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => [
                    'message' => 'The server had an error while processing your request',
                    'type' => 'server_error'
                ]
            ], 500);
        }
    }

    private function determineProvider(string $model): string
    {
        if (str_starts_with($model, 'gpt-') || str_starts_with($model, 'o1-')) {
            return 'openai';
        } elseif (str_starts_with($model, 'claude-')) {
            return 'anthropic';
        } elseif (str_starts_with($model, 'gemini-')) {
            return 'google';
        } elseif (str_starts_with($model, 'grok-')) {
            return 'xai';
        }

        return 'openai'; // Default fallback
    }

    private function getUserApiKey($user, string $provider): ?string
    {
        $userApiKey = UserApiKey::where('user_id', $user->id)
            ->where('provider', $provider)
            ->where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('expires_at')
                      ->orWhere('expires_at', '>', now());
            })
            ->first();

        return $userApiKey?->api_key;
    }

    private function getProviderEndpoint(string $provider): string
    {
        return match ($provider) {
            'openai' => 'https://api.openai.com/v1/chat/completions',
            'anthropic' => 'https://api.anthropic.com/v1/messages',
            'google' => 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            'xai' => 'https://api.x.ai/v1/chat/completions',
            default => 'https://api.openai.com/v1/chat/completions'
        };
    }

    private function getProviderHeaders(string $provider, string $apiKey): array
    {
        return match ($provider) {
            'openai' => [
                'Authorization' => "Bearer {$apiKey}",
                'Content-Type' => 'application/json'
            ],
            'anthropic' => [
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
                'Content-Type' => 'application/json'
            ],
            'google' => [
                'Authorization' => "Bearer {$apiKey}",
                'Content-Type' => 'application/json'
            ],
            'xai' => [
                'Authorization' => "Bearer {$apiKey}",
                'Content-Type' => 'application/json'
            ],
            default => [
                'Authorization' => "Bearer {$apiKey}",
                'Content-Type' => 'application/json'
            ]
        };
    }

    private function handleStreamingRequest(string $endpoint, array $headers, array $requestData): StreamedResponse
    {
        return new StreamedResponse(function () use ($endpoint, $headers, $requestData) {
            $response = $this->client->post($endpoint, [
                'headers' => $headers,
                'json' => $requestData,
                'stream' => true
            ]);

            $body = $response->getBody();

            while (!$body->eof()) {
                $chunk = $body->read(1024);
                echo $chunk;
                ob_flush();
                flush();
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive'
        ]);
    }

    private function handleRegularRequest(string $endpoint, array $headers, array $requestData)
    {
        $response = $this->client->post($endpoint, [
            'headers' => $headers,
            'json' => $requestData
        ]);

        return response()->json(
            json_decode($response->getBody()->getContents(), true),
            $response->getStatusCode()
        );
    }
}
```

## Routes

### api.php
```php
<?php

use App\Http\Controllers\Api\FailedRequestController;
use App\Http\Controllers\Api\ProxyController;
use App\Http\Controllers\Api\UserApiKeysController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public health check
    Route::get('/health', [ProxyController::class, 'health']);

    // Protected routes (require authentication)
    Route::middleware('auth:sanctum')->group(function () {
        // User API keys
        Route::get('/user/ai-keys', [UserApiKeysController::class, 'index']);

        // AI Proxy
        Route::post('/chat/completions', [ProxyController::class, 'chatCompletions']);

        // Failed request sync
        Route::post('/sync/failed-request', [FailedRequestController::class, 'store']);
    });
});
```

## Configuration

### .env Variables
```env
# Encryption key for API keys (generate with: php artisan key:generate)
ENCRYPTION_KEY=your-base64-encryption-key

# Provider API Keys (for fallback)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_KEY=AIzaSy...
XAI_API_KEY=xai-...

# Rate limiting
API_RATE_LIMIT=1000
API_RATE_LIMIT_MINUTES=1
```

### Rate Limiting (RouteServiceProvider)
```php
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(config('app.api_rate_limit', 1000))
        ->by($request->user()?->id ?: $request->ip());
});
```

## Authentication Setup

### Create API Tokens
```php
// In your user creation/login flow
$token = $user->createToken('dyad-distribution')->plainTextToken;

// Return this token to the client for use in Authorization: Bearer {token}
```

## Testing

### Unit Tests
```php
<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserApiKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiKeysTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_fetch_api_keys()
    {
        $user = User::factory()->create();

        UserApiKey::create([
            'user_id' => $user->id,
            'provider' => 'openai',
            'api_key' => 'sk-test123',
            'is_active' => true
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/user/ai-keys');

        $response->assertOk()
            ->assertJsonStructure([
                'openai',
                'expiration'
            ]);
    }
}
```

## Deployment Checklist

- [ ] Set up Laravel Sanctum for API authentication
- [ ] Configure database with proper indexes
- [ ] Set up encryption for API keys
- [ ] Implement rate limiting
- [ ] Configure CORS for frontend access
- [ ] Set up SSL/HTTPS
- [ ] Configure Redis for caching (optional)
- [ ] Set up monitoring and logging
- [ ] Test all endpoints with the .http file
- [ ] Deploy with proper environment variables