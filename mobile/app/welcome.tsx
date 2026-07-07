import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MagnomLogo } from '../src/components/MagnomLogo';
import { setWelcomeSeen } from '../src/storage';
import { colors, spacing } from '../src/theme';

const bg = require('../assets/magnom-logo.png');

export default function WelcomeScreen() {
  const router = useRouter();

  const handleContinue = async () => {
    await setWelcomeSeen();
    router.replace('/');
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={bg} style={styles.bgImage} resizeMode="cover">
        <LinearGradient
          colors={['rgba(15,15,26,0.55)', 'rgba(15,15,26,0.92)', 'rgba(15,15,26,0.98)']}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <MagnomLogo size={140} />

          <Text style={styles.brand}>MAGNOM AI</Text>

          <View style={styles.messageCard}>
            <Text style={styles.message}>
              gungrachlation your now in MAGNOM AI
            </Text>
          </View>

          <Text style={styles.subtext}>
            Your high-level AI assistant is ready. Ask anything — coding, learning,
            writing, and more.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#c41e3a', '#8b0000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  brand: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  messageCard: {
    backgroundColor: 'rgba(26,26,46,0.85)',
    borderRadius: 20,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    width: '100%',
  },
  message: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
  },
  subtext: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
