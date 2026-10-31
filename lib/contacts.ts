import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';
import type { ContactMeta } from './chats';

/** Открывает системный список контактов и возвращает выбранный контакт. */
export async function pickContact(): Promise<ContactMeta | null> {
  if (Platform.OS === 'web') {
    throw new Error('Отправка контактов работает только в приложении на телефоне');
  }
  const contact = await Contacts.presentContactPickerAsync();
  if (!contact) return null;

  const phones = (contact.phoneNumbers ?? [])
    .map((p) => p.number)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
  const name =
    contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Контакт';
  return { name, phones };
}
