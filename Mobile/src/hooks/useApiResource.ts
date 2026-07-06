import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '@/utils/validation';

export function useApiResource<T>(
  loader: () => Promise<T>,
  initialDataOrFallback?: T | string,
  fallback = 'Không thể tải dữ liệu.',
) {
  const initialData = typeof initialDataOrFallback === 'string' ? null : initialDataOrFallback ?? null;
  const fallbackMessage = typeof initialDataOrFallback === 'string' ? initialDataOrFallback : fallback;
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const load = useCallback(async (refresh = false) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setError(null);
    try {
      setData(await loaderRef.current());
    } catch (loadError) {
      setError(getErrorMessage(loadError, fallbackMessage));
    } finally {
      refresh ? setIsRefreshing(false) : setIsLoading(false);
    }
  }, [fallbackMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    reload: () => load(false),
    refresh: () => load(true),
    setData,
    setError,
  };
}

export default useApiResource;
