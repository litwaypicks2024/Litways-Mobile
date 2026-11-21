import { Linking } from 'react-native';
import { alertDialog } from '@/components/ui/Dialog';

// Single source of truth for the public contact details shown in the app.
export const CONTACT_PHONE_DISPLAY = '+231 888 464 940';
export const CONTACT_PHONE_E164 = '+231888464940';
export const CONTACT_EMAIL = 'support@litwaypicks.com';

export const CONTACT_PHONE_URL = `tel:${CONTACT_PHONE_E164}`;
export const CONTACT_WHATSAPP_URL = `https://wa.me/${CONTACT_PHONE_E164.replace('+', '')}`;
export const CONTACT_EMAIL_URL = `mailto:${CONTACT_EMAIL}`;

/** Opens a tel:/mailto:/WhatsApp link, telling the user if the device can't handle it. */
export async function openContactUrl(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    alertDialog('Unable to open', `Please reach us at ${CONTACT_PHONE_DISPLAY} or ${CONTACT_EMAIL}.`);
  }
}
