import { supabase } from '@/lib/supabase';

/**
 * Email/password sign-up that can tell "new account" from "email already
 * registered".
 *
 * Why not just supabase.auth.signUp(): with "Confirm email" on, Supabase
 * answers an existing email with a placeholder user whose `identities` list is
 * empty (and sends no email). auth-js 2.106 stopped passing that user through
 * (`data.user` is null whenever there's no session), so the app could no
 * longer see it and sent people to a code screen for a code that never comes.
 * Calling the same endpoint directly keeps that signal.
 */

export type SignUpResult =
  | { kind: 'created' } // new account, 6-digit code emailed
  | { kind: 'exists' } // email already registered; nothing sent
  | { kind: 'signed_in' } // confirmation is off: account created and signed in
  | { kind: 'error'; error: { code?: string; message: string } };

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export async function signUpWithEmail(
  email: string,
  password: string,
  metadata: Record<string, unknown>,
): Promise<SignUpResult> {
  let res: Response;
  try {
    res = await fetch(`${URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, data: metadata }),
    });
  } catch (e) {
    return { kind: 'error', error: { message: e instanceof Error ? e.message : 'Network request failed' } };
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    return {
      kind: 'error',
      error: {
        code: typeof body.error_code === 'string' ? body.error_code : undefined,
        message: body.msg ?? body.message ?? body.error_description ?? `Sign-up failed (${res.status})`,
      },
    };
  }

  if (body.access_token && body.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });
    return error ? { kind: 'error', error } : { kind: 'signed_in' };
  }

  const user = body.user ?? body;
  if (Array.isArray(user?.identities) && user.identities.length === 0) return { kind: 'exists' };
  return { kind: 'created' };
}
