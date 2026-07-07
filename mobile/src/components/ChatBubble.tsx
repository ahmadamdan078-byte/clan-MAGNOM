import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ChatMessage } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  message: ChatMessage;
  isLoading?: boolean;
}

export function ChatBubble({ message, isLoading }: Props) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAi]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primaryLight} />
            <Text style={styles.loadingText}>Thinking…</Text>
          </View>
        ) : isUser ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          <Markdown style={markdownStyles}>{message.content}</Markdown>
        )}
      </View>
    </View>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  heading1: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  heading2: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  heading3: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 4 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  list_item: { marginBottom: 4 },
  code_inline: {
    backgroundColor: colors.bg,
    color: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  fence: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  code_block: { color: colors.accent, fontFamily: 'monospace', fontSize: 14 },
  link: { color: colors.primaryLight },
  strong: { fontWeight: '700', color: colors.text },
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAi: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 4,
  },
  avatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: colors.userBubble,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.aiBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
