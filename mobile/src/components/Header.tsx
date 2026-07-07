import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MagnomLogo } from './MagnomLogo';
import { colors, spacing } from '../theme';

interface Props {
  title: string;
  onHistory: () => void;
  onNewChat: () => void;
  onSettings: () => void;
}

export function Header({ title, onHistory, onNewChat, onSettings }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onHistory} style={styles.iconBtn} hitSlop={8}>
        <Ionicons name="time-outline" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.center}>
        <MagnomLogo size={28} rounded />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle}>MAGNOM AI</Text>
      </View>

      <View style={styles.right}>
        <TouchableOpacity onPress={onNewChat} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSettings} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
});
