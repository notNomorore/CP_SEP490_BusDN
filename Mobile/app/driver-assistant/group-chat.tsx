import { MaterialCommunityIcons } from '@expo/vector-icons';
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

const getInitials = (value?: string) => {
  const words = String(value || 'OP')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'OP';
};

const getGroupPreview = (group: OperationChatGroup) => (
  group.lastMessageContent
  || getMessageContent(group.lastMessage)
  || group.description
  || 'Tap to open operation chat'
);

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
  const [loadError, setLoadError] = useState('');

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );
  const currentUserId = String(user?.id || '');

  const loadGroups = useCallback(async () => {
    setIsLoadingGroups(true);
    setLoadError('');
    try {
      const payload = await operationChatApi.getGroups();
      const nextGroups = payload.groups || [];
      setGroups(nextGroups);
      setSelectedGroupId((current) => (
        current && nextGroups.some((group) => group.id === current) ? current : ''
      ));
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Unable to load operation chat groups.'));
    } finally {
      setIsLoadingGroups(false);
    }
  }, []);

  const loadMessages = useCallback(async (groupId: string, options: { silent?: boolean } = {}) => {
    if (!groupId) return;
    if (!options.silent) {
      setIsLoadingMessages(true);
    }
    setLoadError('');
    try {
      const payload = await operationChatApi.getMessages(groupId, { limit: 80 });
      setMessages(payload.messages || []);
      await operationChatApi.markRead(groupId);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to load operation chat messages.');
      setLoadError(message);
      if (!options.silent) {
        Alert.alert('Unable to load messages', message);
      }
    } finally {
      if (!options.silent) {
        setIsLoadingMessages(false);
      }
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

  const openGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setMessages([]);
  };

  const closeThread = () => {
    setSelectedGroupId('');
    setMessages([]);
    setDraft('');
    setLoadError('');
  };

  useEffect(() => {
    if (!selectedGroup?.id) return undefined;
    const timer = setInterval(() => {
      void loadMessages(selectedGroup.id, { silent: true });
    }, 12000);
    return () => clearInterval(timer);
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
            <Pressable
              accessibilityLabel="Back"
              hitSlop={10}
              onPress={() => (selectedGroup ? closeThread() : goBackOrReplace('/driver-assistant'))}
            >
              <MaterialCommunityIcons color={colors.primary} name="arrow-left" size={25} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.kicker}>OPERATION CHAT</Text>
              <Text numberOfLines={1} style={styles.title}>{selectedGroup?.name || 'Chats'}</Text>
              {selectedGroup ? (
                <Text numberOfLines={1} style={styles.subtitle}>
                  {selectedGroup.memberCount || 0} members
                </Text>
              ) : null}
            </View>
            {isLoadingGroups ? <ActivityIndicator color={colors.primary} /> : null}
          </View>

          {!selectedGroup ? (
            <View style={styles.inboxPanel}>
              {isLoadingGroups ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.loadingText}>Loading chats...</Text>
                </View>
              ) : loadError ? (
                <View>
                  <Text style={styles.emptyText}>{loadError}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void loadGroups()}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : groups.length === 0 ? (
                <Text style={styles.emptyText}>No operation chat group is available for this account.</Text>
              ) : (
                <ScrollView
                  contentContainerStyle={[styles.inboxList, { paddingBottom: 104 + insets.bottom }]}
                  showsVerticalScrollIndicator={false}
                >
                  {groups.map((group) => (
                    <Pressable
                      accessibilityRole="button"
                      key={group.id}
                      onPress={() => openGroup(group.id)}
                      style={styles.chatRow}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials(group.name)}</Text>
                      </View>
                      <View style={styles.chatSummary}>
                        <View style={styles.chatSummaryTop}>
                          <Text numberOfLines={1} style={styles.chatName}>{group.name}</Text>
                          <Text style={styles.chatTime}>{formatTime(group.lastMessageAt || group.lastMessage?.sentAt)}</Text>
                        </View>
                        <View style={styles.chatSummaryBottom}>
                          <Text
                            numberOfLines={1}
                            style={[styles.chatPreview, group.unreadCount ? styles.chatPreviewUnread : null]}
                          >
                            {group.unreadCount ? `${group.unreadCount} new messages` : getGroupPreview(group)}
                          </Text>
                          {group.unreadCount ? <View style={styles.unreadDot} /> : null}
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : (
            <View style={styles.chatPanel}>
              {isLoadingMessages ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Loading messages...</Text>
              </View>
              ) : loadError ? (
              <View>
                <Text style={styles.emptyText}>{loadError}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (selectedGroup?.id) {
                      void loadMessages(selectedGroup.id);
                    }
                  }}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
              ) : (
              <ScrollView
                contentContainerStyle={[styles.messageList, { paddingBottom: 128 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
              >
                {messages.length === 0 ? (
                  <Text style={styles.emptyText}>No messages yet. Start the operation discussion.</Text>
                ) : messages.map((message) => {
                  const mine = String(message.sender?.id || '') === currentUserId;
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
          )}

          {selectedGroup ? (
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
          ) : null}

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
  subtitle: { marginTop: 2, color: colors.muted, fontSize: 12, fontWeight: '700' },
  inboxPanel: { flex: 1 },
  inboxList: { paddingBottom: 14 },
  chatRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingHorizontal: 4, paddingVertical: 8 },
  avatar: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: colors.primary },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  chatSummary: { minWidth: 0, flex: 1, borderBottomWidth: 1, borderBottomColor: '#dbe8e2', paddingRight: 2, paddingVertical: 8 },
  chatSummaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatName: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '900' },
  chatTime: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chatSummaryBottom: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatPreview: { minWidth: 0, flex: 1, color: colors.muted, fontSize: 14, fontWeight: '700' },
  chatPreviewUnread: { color: colors.primary, fontWeight: '900' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0a84ff' },
  chatPanel: { flex: 1, overflow: 'hidden', borderRadius: 22, backgroundColor: colors.card },
  loading: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontWeight: '700' },
  emptyText: { margin: 16, borderRadius: 18, backgroundColor: colors.surfaceLow, padding: 16, color: colors.muted, fontSize: 13, fontWeight: '700' },
  retryButton: { alignSelf: 'flex-start', marginHorizontal: 16, borderRadius: 18, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: colors.white, fontSize: 13, fontWeight: '900' },
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
