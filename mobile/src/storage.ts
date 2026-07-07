import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Conversation, AppSettings } from './types';

const CONVERSATIONS_KEY = '@magnom/conversations';
const SETTINGS_KEY = '@magnom/settings';
const WELCOME_SEEN_KEY = '@magnom/welcome_seen';

function defaultApiUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return extra?.apiUrl ?? 'http://localhost:3000';
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppSettings;
      return { apiUrl: parsed.apiUrl || defaultApiUrl() };
    }
  } catch {
    // ignore
  }
  return { apiUrl: defaultApiUrl() };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadConversations(): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Conversation[];
      return parsed.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
  } catch {
    // ignore
  }
  return [];
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export async function upsertConversation(conversation: Conversation): Promise<void> {
  const all = await loadConversations();
  const idx = all.findIndex((c) => c.id === conversation.id);
  if (idx >= 0) {
    all[idx] = conversation;
  } else {
    all.unshift(conversation);
  }
  await saveConversations(all);
}

export async function deleteConversation(id: string): Promise<void> {
  const all = await loadConversations();
  await saveConversations(all.filter((c) => c.id !== id));
}

export function createConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function titleFromMessage(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'New chat';
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}

export async function hasSeenWelcome(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(WELCOME_SEEN_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
}
