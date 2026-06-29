import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Bell, MessageCircle, RefreshCcw, Send, ShieldCheck, Users } from 'lucide-react';
import useAuthStore from '../../auth/stores/authStore.js';
import operationChatService from '../services/operationChatService.js';

const getApiOrigin = () => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  return configured ? configured.replace(/\/$/, '') : 'http://localhost:3000';
};

const getToken = () => localStorage.getItem('authToken')
  || localStorage.getItem('token')
  || localStorage.getItem('accessToken')
  || '';

const formatTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
};

const roleLabel = (role) => {
  if (role === 'ADMIN') return 'Điều hành';
  if (role === 'DRIVER') return 'Tài xế';
  if (role === 'BUS_ASSISTANT') return 'Phụ xe';
  return role || 'Thành viên';
};

const mergeMessage = (messages, message) => {
  if (!message?.id) return messages;
  if (messages.some((item) => item.id === message.id)) return messages;
  return [...messages, message];
};

const OperationChatPage = ({ embedded = false }) => {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const currentUserId = String(user?.id || user?._id || '');

  const loadGroups = async () => {
    setIsLoadingGroups(true);
    setError('');
    try {
      const result = await operationChatService.getGroups();
      const nextGroups = result?.groups || [];
      setGroups(nextGroups);
      setSelectedGroupId((current) => current || nextGroups[0]?.id || '');
    } catch (err) {
      setError(err?.message || 'Không thể tải nhóm trò chuyện.');
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const loadMessages = async (groupId) => {
    if (!groupId) return;
    setIsLoadingMessages(true);
    setError('');
    try {
      const result = await operationChatService.getMessages(groupId);
      setMessages(result?.messages || []);
      await operationChatService.markRead(groupId);
    } catch (err) {
      setError(err?.message || 'Không thể tải tin nhắn.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (!selectedGroupId) return undefined;
    loadMessages(selectedGroupId);
    return undefined;
  }, [selectedGroupId]);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    const socket = io(getApiOrigin(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('server:operation-chat:message', (message) => {
      if (message.groupId !== selectedGroupId) {
        setGroups((current) => current.map((group) => (
          group.id === message.groupId
            ? { ...group, unreadCount: (group.unreadCount || 0) + 1, lastMessageAt: message.sentAt }
            : group
        )));
        return;
      }

      setMessages((current) => mergeMessage(current, message));
      operationChatService.markRead(message.groupId).catch(() => {});
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [selectedGroupId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedGroupId) return undefined;

    socket.emit('operation-chat:join', { groupId: selectedGroupId });
    setGroups((current) => current.map((group) => (
      group.id === selectedGroupId ? { ...group, unreadCount: 0 } : group
    )));

    return () => {
      socket.emit('operation-chat:leave', { groupId: selectedGroupId });
    };
  }, [selectedGroupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedGroupId]);

  const handleSend = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedGroupId || isSending) return;

    setIsSending(true);
    setError('');
    try {
      const result = await operationChatService.sendMessage(selectedGroupId, content);
      if (result?.message) {
        setMessages((current) => mergeMessage(current, result.message));
      }
      setDraft('');
    } catch (err) {
      setError(err?.message || 'Không thể gửi tin nhắn.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={embedded ? 'min-h-0' : 'min-h-screen bg-slate-950 text-slate-100'}>
      <section className={embedded ? 'mx-auto w-full max-w-7xl' : 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'}>
        <div className="rounded-2xl border border-emerald-300/20 bg-slate-950 text-slate-100 shadow-2xl shadow-emerald-950/20">
          <header className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-300">UC116</p>
              <h1 className="mt-2 text-2xl font-black text-white">Nhóm trò chuyện vận hành</h1>
              <p className="mt-1 text-sm text-slate-300">
                Tài xế, phụ xe và admin trao đổi nhanh về lịch trình, sự cố, đổi tuyến và hỗ trợ khẩn cấp.
              </p>
            </div>
            <button
              type="button"
              onClick={loadGroups}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300"
            >
              <RefreshCcw size={17} />
              Làm mới
            </button>
          </header>

          {error ? (
            <div className="mx-5 mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
              {error}
            </div>
          ) : null}

          <div className="grid min-h-[620px] gap-0 lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-200">
                <Users size={17} />
                Nhóm của tôi
              </div>
              <div className="space-y-2">
                {isLoadingGroups ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Đang tải nhóm...</div>
                ) : null}
                {!isLoadingGroups && groups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-300">
                    Bạn chưa thuộc nhóm trò chuyện vận hành nào.
                  </div>
                ) : null}
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setSelectedGroupId(group.id)}
                    className={[
                      'w-full rounded-xl border px-4 py-3 text-left transition',
                      selectedGroupId === group.id
                        ? 'border-emerald-300 bg-emerald-400 text-slate-950'
                        : 'border-white/10 bg-white/[0.04] text-slate-100 hover:border-emerald-300/60',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{group.name}</p>
                        <p className={selectedGroupId === group.id ? 'mt-1 text-xs text-slate-800' : 'mt-1 text-xs text-slate-400'}>
                          {group.memberCount} thành viên
                        </p>
                      </div>
                      {group.unreadCount ? (
                        <span className="rounded-full bg-red-500 px-2 py-1 text-xs font-black text-white">
                          {group.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="flex min-h-[620px] flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="text-lg font-black text-white">{selectedGroup?.name || 'Chọn nhóm trò chuyện'}</h2>
                  <p className="text-sm text-slate-400">{selectedGroup?.description || 'Mở nhóm để xem và gửi tin nhắn.'}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                  <ShieldCheck size={15} />
                  {roleLabel(user?.role)}
                </span>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
                {isLoadingMessages ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Đang tải tin nhắn...</div>
                ) : null}
                {!isLoadingMessages && selectedGroupId && messages.length === 0 ? (
                  <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-white/10 bg-white/[0.03] text-center">
                    <div>
                      <MessageCircle className="mx-auto text-emerald-300" size={32} />
                      <p className="mt-3 text-sm font-semibold text-slate-300">Chưa có tin nhắn nào trong nhóm này.</p>
                    </div>
                  </div>
                ) : null}
                {messages.map((message) => {
                  const isMine = String(message.sender?.id) === currentUserId;
                  return (
                    <article key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={[
                        'max-w-[min(720px,85%)] rounded-2xl px-4 py-3',
                        isMine ? 'bg-emerald-400 text-slate-950' : 'bg-white/[0.06] text-slate-100',
                      ].join(' ')}
                      >
                        <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em]">
                          <span>{message.sender?.fullName || 'Thành viên'}</span>
                          <span className={isMine ? 'text-slate-700' : 'text-emerald-200'}>{roleLabel(message.senderRole)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">{message.content}</p>
                        <p className={isMine ? 'mt-2 text-right text-xs text-slate-700' : 'mt-2 text-right text-xs text-slate-400'}>
                          {formatTime(message.sentAt)}
                        </p>
                      </div>
                    </article>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="border-t border-white/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={!selectedGroupId}
                    rows={2}
                    className="min-h-[52px] flex-1 resize-none rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Nhập tin nhắn vận hành..."
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || !selectedGroupId || isSending}
                    className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={17} />
                    {isSending ? 'Đang gửi...' : 'Gửi'}
                  </button>
                </div>
                <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <Bell size={14} />
                  Tin nhắn rỗng sẽ không được gửi. Chỉ thành viên trong nhóm mới xem và gửi được.
                </p>
              </form>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OperationChatPage;
