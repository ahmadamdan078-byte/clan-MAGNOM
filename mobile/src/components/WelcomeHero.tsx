import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MagnomLogo } from './MagnomLogo';
import { colors, spacing } from '../theme';

export function WelcomeHero() {
  return (
    <View style={styles.container}>
      <MagnomLogo size={88} />
      <Text style={styles.title}>Ask me anything</Text>
      <Text style={styles.subtitle}>
        High-level AI for coding, learning, writing, ideas, and everyday questions.
        Your conversations are saved on this device.
      </Text>
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <View key={s} style={styles.chip}>
            <Text style={styles.chipText}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const SUGGESTIONS = [
  'Explain quantum computing simply',
  'Help me write a cover letter',
  'Debug my Python code',
  'Plan a workout routine',
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 80,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.bgElevated,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
