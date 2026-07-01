import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Bell,
  CirclePlus,
  Info,
  MessageCircle,
  Paperclip,
  Pin,
  Search,
  Send,
  ShieldCheck,
  Smile,
} from 'lucide-react';
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
  }).format(new Date(value));
};

const formatMessageDate = (value) => {
  if (!value) return 'Hôm nay';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Hôm nay';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const roleLabel = (role) => {
  if (role === 'ADMIN') return 'Điều hành';
  if (role === 'DRIVER') return 'Tài xế';
  if (role === 'BUS_ASSISTANT') return 'Phụ xe';
  return role || 'Thành viên';
};

const getInitials = (value = '') => {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'BN';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
};

const mergeMessage = (messages, message) => {
  if (!message?.id) return messages;
  if (messages.some((item) => item.id === message.id)) return messages;
  return [...messages, message];
};

const getSenderName = (message) => message.sender?.fullName
  || message.sender?.name
  || message.sender?.username
  || 'Thành viên';

const getPreviewText = (group) => group.lastMessage?.content
  || group.lastMessageContent
  || group.description
  || 'Trao đổi vận hành';

const OperationChatPage = ({ embedded = false }) => {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
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

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return groups;
    return groups.filter((group) => (
      group.name?.toLowerCase().includes(keyword)
      || group.description?.toLowerCase().includes(keyword)
    ));
  }, [groups, search]);

  const currentUserId = String(user?.id || user?._id || '');
  const firstMessageDate = messages[0]?.sentAt || new Date().toISOString();

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
    loadMessages(selectedGroupId);
  }, [selectedGroupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedGroupId]);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    const socket = io(getApiOrigin(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('operation-chat:message', (message) => {
      if (!message?.groupId) return;
      setGroups((current) => current.map((group) => (
        group.id === message.groupId
          ? { ...group, lastMessage: message, lastMessageContent: message.content }
          : group
      )));
      setMessages((current) => (
        message.groupId === selectedGroupId ? mergeMessage(current, message) : current
      ));
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
    return () => {
      socket.emit('operation-chat:leave', { groupId: selectedGroupId });
    };
  }, [selectedGroupId]);

  const handleSend = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedGroupId || isSending) return;

    setIsSending(true);
    setError('');
    try {
      const result = await operationChatService.sendMessage(selectedGroupId, { content });
      setMessages((current) => mergeMessage(current, result?.message));
      setGroups((current) => current.map((group) => (
        group.id === selectedGroupId
          ? { ...group, lastMessage: result?.message, lastMessageContent: content }
          : group
      )));
      setDraft('');
    } catch (err) {
      setError(err?.message || 'Không thể gửi tin nhắn.');
    } finally {
      setIsSending(false);
    }
  };

  const shellClass = embedded
    ? 'h-[calc(100vh-168px)] min-h-[720px] overflow-hidden rounded border border-white/10 bg-[#eaf6f1] shadow-[0_24px_70px_rgba(0,0,0,0.22)] lg:grid lg:grid-cols-[330px_minmax(0,1fr)]'
    : 'h-[calc(100vh-48px)] min-h-[760px] overflow-hidden rounded-[28px] border border-emerald-950/20 bg-[#eaf6f1] shadow-[0_26px_80px_rgba(0,32,18,0.22)] lg:grid lg:grid-cols-[330px_minmax(0,1fr)]';

  return (
    <div className={embedded ? 'min-h-0 text-white' : 'min-h-screen bg-[#f2fcf8] text-white'}>
      <section className={embedded ? 'w-full' : 'mx-auto w-full max-w-[1500px] px-6 py-6'}>
        <div className={shellClass}>
          <aside className="flex min-h-0 flex-col border-r border-emerald-950/10 bg-[#eaf6f1] text-[#041d12]">
            <div className="px-7 py-7">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">UC116</p>
              <h1 className="mt-2 text-2xl font-black">Nhóm của tôi</h1>
              <div className="mt-5 flex h-12 items-center gap-3 rounded-2xl bg-white px-4 shadow-sm">
                <Search size={18} className="text-emerald-900/45" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-emerald-950 outline-none placeholder:text-emerald-950/35"
                  placeholder="Tìm kiếm nhóm..."
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-7">
              {isLoadingGroups ? (
                <div className="rounded-2xl bg-white/70 px-5 py-4 text-sm font-semibold text-emerald-950/60">Đang tải nhóm...</div>
              ) : null}
              {!isLoadingGroups && filteredGroups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-900/15 bg-white/50 px-5 py-8 text-center text-sm font-semibold text-emerald-950/55">
                  Chưa có nhóm trò chuyện.
                </div>
              ) : null}
              {filteredGroups.map((group) => {
                const isActive = group.id === selectedGroupId;
                return (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={[
                      'group w-full rounded-[20px] px-5 py-4 text-left transition',
                      isActive
                        ? 'bg-[#c9f4df] shadow-[inset_4px_0_0_#20b979]'
                        : 'hover:bg-white/65',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-emerald-950">{group.name}</p>
                        <p className="mt-1 text-xs font-bold text-emerald-900/65">
                          {group.memberCount || 0} thành viên
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-emerald-950/45">
                        {formatTime(group.lastMessage?.sentAt)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-emerald-950/55">
                      {getPreviewText(group)}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col bg-[#002613]">
            <header className="flex min-h-[88px] items-center justify-between border-b border-white/[0.08] bg-[#002613]/95 px-7 py-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#28bd7d] text-lg font-black text-[#002613]">
                  {getInitials(selectedGroup?.name)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black text-white">
                    {selectedGroup?.name || 'Chọn nhóm trò chuyện'}
                  </h2>
                  <p className="truncate text-sm font-semibold text-emerald-200/75">
                    {selectedGroup
                      ? `${selectedGroup.memberCount || 0} thành viên · Đang hoạt động`
                      : 'Mở nhóm để xem và gửi tin nhắn.'}
                  </p>
                </div>
              </div>

              <div className="hidden items-center gap-5 text-emerald-100/70 sm:flex">
                <Search size={20} />
                <Pin size={20} />
                <Info size={20} />
                <span className="h-8 w-px bg-white/10" />
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-2 text-xs font-black text-emerald-100">
                  <ShieldCheck size={15} />
                  {roleLabel(user?.role)}
                </span>
              </div>
            </header>

            {error ? (
              <div className="mx-7 mt-5 rounded-2xl border border-red-300/25 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-100">
                {error}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_70%_10%,rgba(43,164,113,0.10),transparent_30%),linear-gradient(180deg,#002613_0%,#001b0e_100%)] px-7 py-7">
              <div className="mx-auto mb-8 w-fit rounded-full bg-white/[0.07] px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-50/85">
                {formatMessageDate(firstMessageDate)}
              </div>

              {isLoadingMessages ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-sm font-semibold text-emerald-50/70">
                  Đang tải tin nhắn...
                </div>
              ) : null}
              {!isLoadingMessages && selectedGroupId && messages.length === 0 ? (
                <div className="grid min-h-[420px] place-items-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] text-center">
                  <div>
                    <MessageCircle className="mx-auto text-emerald-300" size={34} />
                    <p className="mt-3 text-sm font-semibold text-emerald-50/70">
                      Chưa có tin nhắn nào trong nhóm này.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-8 pb-3">
                {messages.map((message) => {
                  const isMine = String(message.sender?.id) === currentUserId;
                  const senderName = getSenderName(message);
                  return (
                    <article key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex max-w-[min(620px,76%)] flex-col ${isMine ? 'items-end text-right' : 'items-start text-left'}`}>
                        <div className={`mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em] ${isMine ? 'justify-end text-emerald-100' : 'justify-start text-[#2fd38f]'}`}>
                          <span>{isMine ? roleLabel(message.senderRole) : senderName}</span>
                          <span className="rounded-md bg-white/[0.08] px-2 py-1 text-[10px] text-emerald-100/80">
                            {isMine ? senderName : roleLabel(message.senderRole)}
                          </span>
                        </div>
                        <div
                          className={[
                            'rounded-2xl px-5 py-3.5 text-sm font-semibold leading-relaxed shadow-[0_14px_30px_rgba(0,0,0,0.18)]',
                            isMine
                              ? 'rounded-br-md bg-[#28bd7d] text-[#002613]'
                              : 'rounded-bl-md bg-white text-[#061c13]',
                          ].join(' ')}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-emerald-50/45">
                          {formatTime(message.sentAt)}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="border-t border-white/[0.08] bg-[#002613] px-7 py-5">
              <div className="flex items-center gap-4">
                <button type="button" className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 text-emerald-100/70 transition hover:bg-white/[0.08] sm:inline-flex" title="Đính kèm">
                  <CirclePlus size={21} />
                </button>
                <button type="button" className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 text-emerald-100/70 transition hover:bg-white/[0.08] sm:inline-flex" title="Biểu cảm">
                  <Smile size={20} />
                </button>
                <div className="flex min-h-14 flex-1 items-center rounded-2xl border border-white/10 bg-white/[0.06] px-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={!selectedGroupId}
                    rows={1}
                    className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-2 text-sm font-semibold text-white outline-none placeholder:text-emerald-100/40 disabled:cursor-not-allowed"
                    placeholder="Nhập tin nhắn vận hành..."
                  />
                  <Paperclip className="ml-3 text-emerald-100/45" size={18} />
                </div>
                <button
                  type="submit"
                  disabled={!draft.trim() || !selectedGroupId || isSending}
                  className="inline-flex h-14 min-w-28 items-center justify-center gap-2 rounded-2xl bg-[#28bd7d] px-6 text-sm font-black text-[#002613] transition hover:bg-[#5de0a9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={17} />
                  {isSending ? 'Đang gửi...' : 'Gửi'}
                </button>
              </div>
              <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-100/40">
                <Bell size={14} />
                Tin nhắn được bảo mật. Chỉ thành viên trong nhóm mới xem và gửi được.
              </p>
            </form>
          </section>
        </div>
      </section>
    </div>
  );
};

export default OperationChatPage;
