import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { sendChatMessage } from '../services/aiChatbotService.js';

const INITIAL_MESSAGE = {
  role: 'model',
  text: 'Xin chào, mình là trợ lý BusDN. Bạn cần tìm tuyến xe, điểm dừng, vé hay thời gian đến dự kiến?',
};

const visibleMessagesToPayload = (messages) => messages
  .filter((message) => !message.pending)
  .map(({ role, text }) => ({ role, text }));

const toFriendlyErrorMessage = (error) => {
  if (error?.status === 503 || error?.statusCode === 503 || /not configured/i.test(error?.message || '')) {
    return 'Chatbot chưa được cấu hình AI key ở backend. Vui lòng thêm GEMINI_API_KEY rồi khởi động lại server.';
  }

  if (error?.status === 502 || error?.statusCode === 502 || /temporarily busy|high demand/i.test(error?.message || '')) {
    return 'Dịch vụ AI đang bận. Bạn thử lại sau ít phút, hoặc hỏi các nội dung cơ bản như mua vé, tìm tuyến, phản hồi, thất lạc đồ.';
  }

  return 'Mình chưa kết nối được chatbot. Bạn vui lòng thử lại sau.';
};

const BusDNAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const canSend = useMemo(() => message.trim().length > 0 && !isSending, [isSending, message]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || isSending) return;

    const userMessage = { role: 'user', text };
    const pendingMessage = { role: 'model', text: 'Đang xử lý...', pending: true };
    const nextMessages = [...messages, userMessage, pendingMessage];

    setMessage('');
    setMessages(nextMessages);
    setIsSending(true);

    try {
      const reply = await sendChatMessage(visibleMessagesToPayload([...messages, userMessage]));
      setMessages((current) => [
        ...current.filter((item) => !item.pending),
        { role: 'model', text: reply },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current.filter((item) => !item.pending),
        {
          role: 'model',
          text: toFriendlyErrorMessage(error),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[1000] sm:bottom-6 sm:right-6">
      {isOpen && (
        <section className="mb-4 flex h-[min(620px,calc(100vh-7rem))] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-lg border border-outline-variant bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-on-primary">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <Bot size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">BusDN Assistant</h2>
                <p className="text-xs text-white/75">Online</p>
              </div>
            </div>
            <button
              type="button"
              title="Đóng chatbot"
              aria-label="Đóng chatbot"
              onClick={() => setIsOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
            >
              <X size={19} aria-hidden="true" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-surface-container-low px-4 py-4">
            {messages.map((item, index) => {
              const isBot = item.role === 'model';
              return (
                <div
                  key={`${item.role}-${index}-${item.text.slice(0, 12)}`}
                  className={`flex gap-2 ${isBot ? 'justify-start' : 'justify-end'}`}
                >
                  {isBot && (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                      <Bot size={16} aria-hidden="true" />
                    </span>
                  )}
                  <p
                    className={`max-w-[82%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-5 ${
                      isBot
                        ? 'border border-outline-variant bg-white text-on-surface'
                        : 'bg-primary text-on-primary'
                    }`}
                  >
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-outline-variant bg-white p-3">
            <input
              ref={inputRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={1000}
              placeholder="Nhập câu hỏi..."
              className="min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-fixed"
            />
            <button
              type="submit"
              title="Gửi"
              aria-label="Gửi"
              disabled={!canSend}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-container disabled:cursor-not-allowed disabled:bg-outline"
            >
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        title={isOpen ? 'Đóng chatbot' : 'Mở chatbot'}
        aria-label={isOpen ? 'Đóng chatbot' : 'Mở chatbot'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-xl transition hover:bg-primary-container"
      >
        {isOpen ? <X size={24} aria-hidden="true" /> : <MessageCircle size={25} aria-hidden="true" />}
      </button>
    </div>
  );
};

export default BusDNAssistant;
