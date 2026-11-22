import { Alert } from 'react-native';

/**
 * Test-build crash catcher.
 *
 * In a release build a fatal JavaScript error closes the app with only
 * "Litway Picks has stopped". When EXPO_PUBLIC_DIAGNOSTICS=1 (set only on the
 * `preview` EAS profile, never production) this keeps the app open and shows
 * the error and the top of its stack, so a tester can screenshot it.
 *
 * If the app still closes with no alert, the crash is in native code instead.
 */
export const DIAGNOSTICS_ENABLED = process.env.EXPO_PUBLIC_DIAGNOSTICS === '1';

export function showDiagnosticError(source: string, error: unknown) {
  if (!DIAGNOSTICS_ENABLED) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const stack = (err.stack ?? '').split('\n').slice(0, 8).join('\n');
  Alert.alert(
    `Error caught (${source})`,
    `${err.name}: ${err.message}\n\n${stack}\n\nPlease screenshot this and send it to the developer.`,
  );
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

export function installDiagnostics() {
  if (!DIAGNOSTICS_ENABLED) return;
  const errorUtils = (globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler(): GlobalHandler; setGlobalHandler(h: GlobalHandler): void };
  }).ErrorUtils;
  if (!errorUtils) return;

  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) {
      // Swallow the fatal error so the app stays open long enough to show it.
      showDiagnosticError('fatal', error);
      return;
    }
    previous(error, isFatal);
  });
}

installDiagnostics();
