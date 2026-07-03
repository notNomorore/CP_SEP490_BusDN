import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import operationChatApi from '@/api/operationChat.api';
import { RoleBottomNav } from '@/components/navigation/RoleBottomNav';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import type { OperationChatGroup, OperationChatMessage } from '@/types/operationChat';
import { goBackOrReplace } from '@/utils/navigation';
import { formatTime } from '@/utils/scheduleOperations';
import { getErrorMessage } from '@/utils/validation';

const getMessageContent = (message?: OperationChatMessage | null) => {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    return content.content || content.message || content.text || JSON.stringify(content);
  }
  return '';
};

export default function OperationGroupChatScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [groups, setGroups] = useState<OperationChatGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [messages, setMessages] = useState<OperationChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || groups[0] || null,
    [groups, selectedGroupId],
  );

  const loadGroups = useCallback(async () => {
    setIsLoadingGroups(true);
    try {
      const payload = await operationChatApi.getGroups();
      const nextGroups = payload.groups || [];
      setGroups(nextGroups);
      setSelectedGroupId((current) => current || nextGroups[0]?.id || '');
    } catch (error) {
      Alert.alert('Unable to load group chat', getErrorMessage(error, 'Unable to load operation chat groups.'));
    } finally {
      setIsLoadingGroups(false);
    }
  }, []);

  const loadMessages = useCallback(async (groupId: string) => {
    if (!groupId) return;
    setIsLoadingMessages(true);
    try {
      const payload = await operationChatApi.getMessages(groupId, { limit: 80 });
      setMessages(payload.messages || []);
      await operationChatApi.markRead(groupId);
    } catch (error) {
      Alert.alert('Unable to load messages', getErrorMessage(error, 'Unable to load operation chat messages.'));
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (selectedGroup?.id) {
      void loadMessages(selectedGroup.id);
    }
  }, [loadMessages, selectedGroup?.id]);

  const sendMessage = async () => {
    const content = draft.trim();
    if (!selectedGroup?.id || !content) return;

    setIsSending(true);
    try {
      const payload = await operationChatApi.sendMessage(selectedGroup.id, content);
      setMessages((current) => [...current, payload.message]);
      setGroups((current) => current.map((group) => (
        group.id === selectedGroup.id
          ? { ...group, lastMessage: payload.message, lastMessageContent: getMessageContent(payload.message), unreadCount: 0 }
          : group
      )));
      setDraft('');
    } catch (error) {
      Alert.alert('Unable to send message', getErrorMessage(error, 'Unable to send this message.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => goBackOrReplace('/driver-assistant')}>
              <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.kicker}>OPERATION CHAT</Text>
              <Text style={styles.title}>Group Chat</Text>
            </View>
            {isLoadingGroups ? <ActivityIndicator color={colors.primary} /> : null}
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={styles.groupRow}
            showsHorizontalScrollIndicator={false}
          >
            {groups.map((group) => {
              const active = group.id === selectedGroup?.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={group.id}
                  onPress={() => setSelectedGroupId(group.id)}
                  style={[styles.groupChip, active && styles.groupChipActive]}
                >
                  <Text numberOfLines={1} style={[styles.groupName, active && styles.groupNameActive]}>
                    {group.name}
                  </Text>
                  {group.lastMessage || group.lastMessageContent ? (
                    <Text numberOfLines={1} style={[styles.groupPreview, active && styles.groupPreviewActive]}>
                      {group.lastMessageContent || getMessageContent(group.lastMessage)}
                    </Text>
                  ) : null}
                  {group.unreadCount ? (
                    <View style={styles.unreadPill}>
                      <Text style={styles.unreadText}>{group.unreadCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.chatPanel}>
            {isLoadingMessages ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Loading messages...</Text>
              </View>
            ) : groups.length === 0 ? (
              <Text style={styles.emptyText}>No operation chat group is available for this account.</Text>
            ) : (
              <ScrollView
                contentContainerStyle={[styles.messageList, { paddingBottom: 128 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
              >
                {messages.length === 0 ? (
                  <Text style={styles.emptyText}>No messages yet. Start the operation discussion.</Text>
                ) : messages.map((message) => {
                  const mine = message.sender?.id === user?.id;
                  const content = getMessageContent(message);
                  return (
                    <View key={message.id} style={[styles.messageBubble, mine ? styles.myMessage : styles.otherMessage]}>
                      {!mine ? (
                        <Text style={styles.senderName}>{message.sender?.fullName || message.senderRole || 'Operator'}</Text>
                      ) : null}
                      <Text style={[styles.messageText, mine && styles.myMessageText]}>{content}</Text>
                      <Text style={[styles.messageTime, mine && styles.myMessageTime]}>{formatTime(message.sentAt)}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={[styles.inputBar, { bottom: 72 + Math.max(insets.bottom, 10) }]}>
            <TextInput
              accessibilityLabel="Message"
              multiline
              onChangeText={setDraft}
              placeholder="Message the operation group..."
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!draft.trim() || isSending}
              onPress={() => void sendMessage()}
              style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
            >
              {isSending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <MaterialCommunityIcons color={colors.white} name="send" size={20} />
              )}
            </Pressable>
          </View>

          <RoleBottomNav active="chat" role={user?.role} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  keyboardView: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 18, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headerText: { flex: 1 },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.primary, fontSize: 25, fontWeight: '900' },
  groupRow: { gap: 8, paddingBottom: 12 },
  groupChip: { maxWidth: 260, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.outline, borderRadius: 20, backgroundColor: colors.card, paddingHorizontal: 12 },
  groupChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  groupName: { flexShrink: 1, color: colors.primary, fontSize: 12, fontWeight: '900' },
  groupNameActive: { color: colors.white },
  groupPreview: { maxWidth: 95, flexShrink: 1, color: colors.muted, fontSize: 10, fontWeight: '700' },
  groupPreviewActive: { color: '#bfead5' },
  unreadPill: { minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.error },
  unreadText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  chatPanel: { flex: 1, overflow: 'hidden', borderRadius: 22, backgroundColor: colors.card },
  loading: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontWeight: '700' },
  emptyText: { margin: 16, borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 16, color: colors.muted, fontSize: 13, fontWeight: '700' },
  messageList: { gap: 10, padding: 14 },
  messageBubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10 },
  myMessage: { alignSelf: 'flex-end', borderBottomRightRadius: 6, backgroundColor: colors.primary },
  otherMessage: { alignSelf: 'flex-start', borderBottomLeftRadius: 6, backgroundColor: colors.surfaceLow },
  senderName: { marginBottom: 3, color: colors.primary, fontSize: 11, fontWeight: '900' },
  messageText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  myMessageText: { color: colors.white },
  messageTime: { alignSelf: 'flex-end', marginTop: 5, color: colors.muted, fontSize: 10, fontWeight: '700' },
  myMessageTime: { color: '#bfead5' },
  inputBar: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderWidth: 1, borderColor: '#d5e4dd', borderRadius: 24, backgroundColor: colors.white, padding: 8 },
  input: { maxHeight: 96, flex: 1, color: colors.text, fontSize: 14, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 10 },
  sendButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.primary },
  sendButtonDisabled: { opacity: 0.45 },
});
