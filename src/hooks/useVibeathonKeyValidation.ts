import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useSettings } from './useSettings';
import { IpcClient } from '@/ipc/ipc_client';
import { IS_DISTRIBUTION_BUILD } from '@/ipc/utils/distribution_utils';

// Cache validation results to avoid re-validating immediately after success
const validationCache: {
  apiKey: string | null;
  isValid: boolean;
  timestamp: number;
} = {
  apiKey: null,
  isValid: false,
  timestamp: 0,
};

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function useVibeathonKeyValidation() {
  const navigate = useNavigate();
  const { settings, loading } = useSettings();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    // Only run in distribution builds
    if (!IS_DISTRIBUTION_BUILD) {
      setIsValidating(false);
      setIsValid(true);
      return;
    }

    if (loading) return;

    async function validateKey() {
      const vibeathonApiKey = settings?.distributionMode?.vibeathonApiKey?.value;

      if (!vibeathonApiKey) {
        setIsValid(false);
        setIsValidating(false);
        navigate({ to: '/settings', replace: true });
        return;
      }

      // Check if we have a valid cached result for this API key
      const now = Date.now();
      const isCacheValid =
        validationCache.apiKey === vibeathonApiKey &&
        validationCache.isValid &&
        (now - validationCache.timestamp) < CACHE_DURATION_MS;

      if (isCacheValid) {
        console.log('[Vibeathon] Using cached validation result');
        setIsValid(true);
        setIsValidating(false);
        return;
      }

      try {
        console.log('[Vibeathon] Validating API key (cache miss or expired)');
        const valid = await IpcClient.getInstance().validateVibeathonKey(vibeathonApiKey);
        setIsValid(valid);

        // Update cache on successful validation
        if (valid) {
          validationCache.apiKey = vibeathonApiKey;
          validationCache.isValid = true;
          validationCache.timestamp = Date.now();
        } else {
          // Clear cache on failure
          validationCache.apiKey = null;
          validationCache.isValid = false;
          validationCache.timestamp = 0;
          navigate({ to: '/settings', replace: true });
        }
      } catch (error) {
        console.error('Error validating Vibeathon API key:', error);
        setIsValid(false);
        // Clear cache on error
        validationCache.apiKey = null;
        validationCache.isValid = false;
        validationCache.timestamp = 0;
        navigate({ to: '/settings', replace: true });
      } finally {
        setIsValidating(false);
      }
    }

    validateKey();
  }, [settings, loading, navigate]);

  return { isValidating, isValid };
}

// Export cache warming function for Settings page to use after successful validation
export function warmValidationCache(apiKey: string) {
  validationCache.apiKey = apiKey;
  validationCache.isValid = true;
  validationCache.timestamp = Date.now();
  console.log('[Vibeathon] Cache warmed for API key');
}
