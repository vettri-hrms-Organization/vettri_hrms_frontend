import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  LoaderCircle,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { assistantApi } from '../../api/endpoints/assistant';
import { useAuth } from '../../hooks/useAuth';
import { getAssistantWelcome, getDisplayName, vettriMicrocopy } from '../../utils/vettriMicrocopy';
import { getAskVettriSuggestions } from './askVettriSuggestions';

export default function AskVettriPanel({ open, onClose, initialQuery = '' }) {
  const navigate = useNavigate();
  const { user, hasPermission, hasRole } = useAuth();
  const inputRef = useRef(null);
  const messagesRef = useRef(null);
  const sendingRef = useRef(false);
  const followLatestRef = useRef(true);
  const [query, setQuery] = useState(initialQuery);
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isAwayFromLatest, setIsAwayFromLatest] = useState(false);
  const [chatError, setChatError] = useState('');
  const [retryText, setRetryText] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationError, setConversationError] = useState('');

  const suggestions = useMemo(
    () => getAskVettriSuggestions({ query, user, hasPermission, hasRole }),
    [query, user, hasPermission, hasRole]
  );
  const userDisplayName = getDisplayName(user, 'You');

  useEffect(() => {
    if (!open) return undefined;
    setQuery(initialQuery);
    inputRef.current?.focus();
    let active = true;
    assistantApi.conversations()
      .then((items) => {
        if (active) setConversations(items);
      })
      .catch((error) => {
        console.error('[Ask Vettri] conversation list failed', {
          status: error?.response?.status,
          code: error?.code,
        });
        if (active) setConversationError(vettriMicrocopy.assistant.historyUnavailable);
      });

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      active = false;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, initialQuery, onClose]);

  useEffect(() => {
    if (!open || !followLatestRef.current) return undefined;
    const frame = requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (!container) return;
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      setIsAwayFromLatest(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, messages, isSending, conversationId]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [query]);

  function handleNavigate(route) {
    onClose();
    navigate(route);
  }

  async function sendMessage(rawMessage, isRetry = false) {
    const message = rawMessage.trim();
    if (!message || sendingRef.current) return;

    sendingRef.current = true;
    followLatestRef.current = true;
    setIsAwayFromLatest(false);
    if (!isRetry) {
      setMessages((current) => [...current, { role: 'user', content: message }]);
      setQuery('');
    }
    setChatError('');
    setIsSending(true);
    try {
      const response = await assistantApi.chat({
        message,
        conversationId,
      });
      setConversationId(response.conversationId);
      setConversations((current) => {
        const updated = current.filter((item) => item.id !== response.conversationId);
        return [{ id: response.conversationId, title: message, updatedAt: new Date().toISOString() }, ...updated].slice(0, 50);
      });
      setMessages((current) => [...current, {
        role: 'assistant',
        content: response.message,
        action: response.actions?.[0] || null,
      }]);
      setRetryText('');
    } catch (error) {
      console.error('[Ask Vettri] chat request failed', {
        status: error?.response?.status,
        code: error?.code,
      });
      setRetryText(message);
      setChatError(vettriMicrocopy.error.assistant);
    } finally {
      sendingRef.current = false;
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function submitMessage(event) {
    event.preventDefault();
    void sendMessage(query);
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage(query);
    }
  }

  function handleMessagesScroll() {
    const container = messagesRef.current;
    if (!container) return;
    const atLatest = container.scrollHeight - container.scrollTop - container.clientHeight <= 72;
    followLatestRef.current = atLatest;
    setIsAwayFromLatest(!atLatest);
  }

  function scrollToLatest() {
    followLatestRef.current = true;
    setIsAwayFromLatest(false);
    const container = messagesRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }

  function startNewConversation() {
    followLatestRef.current = true;
    setIsAwayFromLatest(false);
    setMessages([]);
    setChatError('');
    setQuery('');
    setRetryText('');
    setConversationId(null);
    inputRef.current?.focus();
  }

  async function openConversation(id) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    followLatestRef.current = true;
    setIsAwayFromLatest(false);
    setIsSending(true);
    setChatError('');
    try {
      const snapshot = await assistantApi.conversation(id);
      setConversationId(snapshot.conversation.id);
      setMessages([...snapshot.messages]
        .sort((left, right) => {
          const leftTime = Date.parse(left.createdAt || '');
          const rightTime = Date.parse(right.createdAt || '');
          return Number.isFinite(leftTime) && Number.isFinite(rightTime) ? leftTime - rightTime : 0;
        })
        .map((message) => ({
          role: message.role.toLowerCase(),
          content: message.content,
          action: null,
        })));
    } catch (error) {
      console.error('[Ask Vettri] conversation load failed', {
        status: error?.response?.status,
        code: error?.code,
      });
      setChatError(vettriMicrocopy.assistant.historyUnavailable);
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="vettri-assistant-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="vettri-assistant-panel" aria-label="Ask Vettri" role="dialog" aria-modal="true">
        <div className="vettri-assistant-panel__header">
          <div className="vettri-assistant-panel__title-wrap">
            <span className="vettri-assistant-panel__badge"><Sparkles size={12} /> {vettriMicrocopy.assistant.title}</span>
            <h2>Your AI workplace assistant</h2>
          </div>
          <button type="button" aria-label="Close Ask Vettri" className="vettri-assistant-panel__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="vettri-assistant-panel__body">
          {messages.length > 0 && (
            <div className="vettri-assistant-panel__conversation-heading">
              <strong>Conversation</strong>
              <button type="button" disabled={isSending} onClick={startNewConversation}>
                <RotateCcw size={13} /> New chat
              </button>
            </div>
          )}
          <div
            ref={messagesRef}
            className="vettri-assistant-panel__messages"
            onScroll={handleMessagesScroll}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="Conversation messages"
          >
            {messages.length === 0 ? (
              <div className="vettri-assistant-panel__welcome">
                <span className="vettri-assistant-panel__welcome-icon"><Sparkles size={20} /></span>
                <h3>{getAssistantWelcome(user)}</h3>
                <p>Your AI workplace assistant.</p>
                <div className="vettri-assistant-panel__starter-prompts" aria-label="Suggested questions">
                  {vettriMicrocopy.assistant.suggestions.map((prompt) => (
                    <button key={prompt} type="button" disabled={isSending} onClick={() => void sendMessage(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
                {conversations.length > 0 && (
                  <details className="vettri-assistant-panel__history">
                    <summary>Recent conversations</summary>
                    {conversations.map((item) => (
                      <button key={item.id} type="button" disabled={isSending} onClick={() => void openConversation(item.id)}>
                        {item.title}
                      </button>
                    ))}
                  </details>
                )}
                {conversationError && <p className="vettri-assistant-panel__history-error" role="status">{conversationError}</p>}
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <article key={`${message.role}-${index}`} className={`vettri-assistant-message vettri-assistant-message--${message.role}`}>
                    <div className="vettri-assistant-message__identity">
                      <span className={`vettri-assistant-message__avatar vettri-assistant-message__avatar--${message.role}`} aria-hidden="true">
                        {message.role === 'user' ? <UserRound size={15} /> : <Sparkles size={15} />}
                      </span>
                      <strong>{message.role === 'user' ? userDisplayName : 'Ask Vettri'}</strong>
                    </div>
                    <p>{message.content}</p>
                    {message.action?.route && (
                      <button type="button" onClick={() => handleNavigate(message.action.route)}>
                        {message.action.label || 'Open page'} <ArrowRight size={14} />
                      </button>
                    )}
                  </article>
                ))}
              </>
            )}
            {isSending && messages.length > 0 && (
              <div className="vettri-assistant-panel__typing" role="status" aria-label="Ask Vettri is thinking">
                <span className="vettri-assistant-message__avatar vettri-assistant-message__avatar--assistant" aria-hidden="true">
                  <Sparkles size={15} />
                </span>
                <span className="vettri-assistant-panel__typing-copy">
                  <strong>Ask Vettri</strong>
                  <span>{vettriMicrocopy.loading.assistant}</span>
                </span>
                <span className="vettri-assistant-panel__typing-indicator" aria-hidden="true"><i /><i /><i /></span>
              </div>
            )}
            {chatError && (
              <div className="vettri-assistant-panel__error" role="alert">
                <span>{chatError}</span>
                <button type="button" disabled={isSending} onClick={() => void sendMessage(retryText, true)}>Retry</button>
              </div>
            )}
            {messages.length > 0 && suggestions.length > 0 && (
              <details className="vettri-assistant-panel__quick-actions">
                <summary>Optional quick links <span>{suggestions.length} available</span></summary>
                <div className="vettri-assistant-panel__list" role="listbox" aria-label="Authorized quick links">
                  {suggestions.map((item) => {
                    const Icon = item.icon || Sparkles;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className="vettri-assistant-panel__item"
                        onClick={() => handleNavigate(item.route)}
                        role="option"
                      >
                        <span className="vettri-assistant-panel__item-icon"><Icon size={16} /></span>
                        <span className="vettri-assistant-panel__item-copy">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                        <ArrowRight size={15} />
                      </button>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
          {messages.length > 0 && isAwayFromLatest && (
            <button type="button" className="vettri-assistant-panel__latest" onClick={scrollToLatest}>
              <ChevronDown size={15} /> Scroll to latest
            </button>
          )}
        </div>
        <footer className="vettri-assistant-panel__footer">
          <form className="vettri-assistant-panel__composer" onSubmit={submitMessage}>
            <div className="vettri-assistant-panel__composer-box">
              <Sparkles className="vettri-assistant-panel__composer-icon" size={17} aria-hidden="true" />
              <textarea
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                disabled={isSending}
                placeholder="Ask Vettri anything..."
                aria-label="Message Ask Vettri"
                rows={1}
              />
              <button type="submit" aria-label="Send message" title="Send message" disabled={!query.trim() || isSending}>
                {isSending ? <LoaderCircle size={17} className="vettri-assistant-spin" /> : <Send size={17} />}
              </button>
            </div>
            <small>Enter to send · Shift+Enter for a new line</small>
          </form>
        </footer>
      </section>
    </div>,
    document.body
  );
}
