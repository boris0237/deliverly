import type { TFunction } from 'i18next';

type ApiErrorPayload = {
  code?: string;
  error?: string;
};

export function getLocalizedApiError(
  t: TFunction,
  payload: ApiErrorPayload | null | undefined,
  status?: number,
  fallbackKey = 'errors.generic'
): string {
  if (payload?.code) {
    const key = `errors.auth.${payload.code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }

  if (status === 401) return t('errors.unauthorized');
  if (status === 403) return t('errors.forbidden');
  if (status && status >= 500) return t('errors.server');

  return payload?.error || t(fallbackKey);
}
