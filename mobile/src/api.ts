import { ApiHistoryItem } from './types';

export async function sendChatMessage(
  apiUrl: string,
  message: string,
  history: ApiHistoryItem[]
): Promise<string> {
  const base = apiUrl.replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${base}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true',
      },
      body: JSON.stringify({ message, history }),
      signal: controller.signal,
    });

    const data = (await response.json()) as { reply?: string; error?: string };

    if (!response.ok) {
      throw new Error(data.error || `Server error (${response.status})`);
    }

    if (!data.reply) {
      throw new Error('Empty response from AI');
    }

    return data.reply;
  } finally {
    clearTimeout(timeout);
  }
}
