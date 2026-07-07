import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble } from '../src/components/ChatBubble';
import { ChatInput } from '../src/components/ChatInput';
import { Header } from '../src/components/Header';
import { WelcomeHero } from '../src/components/WelcomeHero';
import { sendChatMessage } from '../src/api';
import {
  loadSettings,
  upsertConversation,
  loadConversations,
  hasSeenWelcome,
  createConversationId,
  createMessageId,
  titleFromMessage,
} from '../src/storage';
import { ChatMessage, Conversation } from '../src/types';
import { colors } from '../src/theme';

export default function ChatScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const listRef = useRef<FlatList>(null);

  const [conversation, setConversation] = useState<Conversation>(() => ({
    id: createConversationId(),
    title: 'New chat',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://localhost:3000');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hasSeenWelcome().then((seen) => {
      if (!seen) {
        router.replace('/welcome');
      } else {
        setReady(true);
      }
    });
  }, [router]);

  useEffect(() => {
    loadSettings().then((s) => setApiUrl(s.apiUrl));
  }, []);

  useEffect(() => {
    if (!conversationId || typeof conversationId !== 'string') return;
    loadConversations().then((all) => {
      const found = all.find((c) => c.id === conversationId);
      if (found) {
        setConversation(found);
        setInput('');
      }
    });
  }, [conversationId]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    Keyboard.dismiss();
    setInput('');

    const userMsg: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...conversation.messages, userMsg];
    const isFirst = conversation.messages.length === 0;

    const nextConv: Conversation = {
      ...conversation,
      title: isFirst ? titleFromMessage(text) : conversation.title,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };

    setConversation(nextConv);
    setLoading(true);
    scrollToEnd();

    try {
      const history = updatedMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await sendChatMessage(apiUrl, text, history);

      const aiMsg: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      };

      const finalConv: Conversation = {
        ...nextConv,
        messages: [...updatedMessages, aiMsg],
        updatedAt: new Date().toISOString(),
      };

      setConversation(finalConv);
      await upsertConversation(finalConv);
      scrollToEnd();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert(
        'Could not reach AI',
        `${message}\n\nMake sure the server is running and the API URL in Settings is correct.`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    router.setParams({ conversationId: undefined });
    setConversation({
      id: createConversationId(),
      title: 'New chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setInput('');
  };

  const showWelcome = conversation.messages.length === 0 && !loading;

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        title={conversation.title}
        onHistory={() => router.push('/history')}
        onNewChat={handleNewChat}
        onSettings={() => router.push('/settings')}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.body}>
          {showWelcome ? (
            <WelcomeHero />
          ) : (
            <FlatList
              ref={listRef}
              data={conversation.messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ChatBubble message={item} />}
              contentContainerStyle={styles.list}
              onContentSizeChange={scrollToEnd}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={
                loading ? (
                  <ChatBubble
                    message={{
                      id: 'loading',
                      role: 'assistant',
                      content: '',
                      createdAt: new Date().toISOString(),
                    }}
                    isLoading
                  />
                ) : null
              }
            />
          )}
        </View>
      </TouchableWithoutFeedback>

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={loading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
  },
  list: {
    paddingTop: 16,
    paddingBottom: 8,
  },
});
