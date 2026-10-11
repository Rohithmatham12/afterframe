import createClient from 'openapi-fetch';
import type { paths, components } from './api.generated';
export type Models = components['schemas'];
export const api = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080',
});
let token = '';
export function setToken(value: string) {
  token = value;
}
api.use({
  onRequest({ request }) {
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
});
export function result<T>(response: { data?: T; error?: unknown }): T {
  if (response.error)
    throw new Error(
      (response.error as { error?: string }).error || 'Request failed'
    );
  return response.data as T;
}
