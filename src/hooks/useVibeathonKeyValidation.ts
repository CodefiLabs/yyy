import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useSettings } from './useSettings';
import IpcClient from '@/ipc/ipc_client';
import { IS_DISTRIBUTION_BUILD } from '@/ipc/utils/distribution_utils';

export function useVibeathonKeyValidation() {
  const navigate = useNavigate();
  const { data: settings, isLoading } = useSettings();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    // Only run in distribution builds
    if (!IS_DISTRIBUTION_BUILD) {
      setIsValidating(false);
      setIsValid(true);
      return;
    }

    if (isLoading) return;

    async function validateKey() {
      const vibeathonApiKey = settings?.distributionMode?.vibeathonApiKey?.value;

      if (!vibeathonApiKey) {
        setIsValid(false);
        setIsValidating(false);
        navigate({ to: '/settings', replace: true });
        return;
      }

      try {
        const valid = await IpcClient.getInstance().validateVibeathonKey(vibeathonApiKey);
        setIsValid(valid);

        if (!valid) {
          navigate({ to: '/settings', replace: true });
        }
      } catch (error) {
        console.error('Error validating Vibeathon API key:', error);
        setIsValid(false);
        navigate({ to: '/settings', replace: true });
      } finally {
        setIsValidating(false);
      }
    }

    validateKey();
  }, [settings, isLoading, navigate]);

  return { isValidating, isValid };
}
