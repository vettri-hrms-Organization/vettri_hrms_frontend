import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  LoaderCircle,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { assistantApi } from '../../api/endpoints/assistant';
import { useAuth } from '../../hooks/useAuth';
import { getAskVettriSuggestions } from './askVettriSuggestions';

export default function AskVettriPanel({ open, onClose, initialQuery = '' }) {
  const navigate = useNavigate();
  const { user, hasPermission, hasRole } = useAuth();
  const inputRef = useRef(null);
  const [query, setQuery] = useState(initialQuery);
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [retryText, setRetryText] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationError, setConversationError] = useState('');

  const suggestions = useMemo(
    () => getAskVettriSuggestions({ query, user, hasPermission, hasRole }),
    [query, user, hasPermission, hasRole]
  );

  useEffect(() => {
    if (!open) return undefined;
    setQuery(initialQuery);
    inputRef.current?.focus();
    let active = true;
    assistantApi.conversations()
      .then((items) => {
        if (active) setConversations(items);
      })
      .catch(() => {
        if (active) setConversationError('Conversation history is unavailable right now.');
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

  function handleNavigate(route) {
    onClose();
    navigate(route);
  }

  async function sendMessage(rawMessage, isRetry = false) {
    const message = rawMessage.trim();
    if (!message || isSending) return;

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
    } catch {
      setRetryText(message);
      setChatError('Vettri Bot is temporarily unavailable. Please try again.');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function submitMessage(event) {
    event.preventDefault();
    void sendMessage(query);
  }

  function startNewConversation() {
    setMessages([]);
    setChatError('');
    setQuery('');
    setRetryText('');
    setConversationId(null);
    inputRef.current?.focus();
  }

  async function openConversation(id) {
    setIsSending(true);
    setChatError('');
    try {
      const snapshot = await assistantApi.conversation(id);
      setConversationId(snapshot.conversation.id);
      setMessages(snapshot.messages.map((message) => ({
        role: message.role.toLowerCase(),
        content: message.content,
        action: null,
      })));
    } catch {
      setChatError('Conversation history is unavailable right now.');
    } finally {
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
            <span className="vettri-assistant-panel__badge"><Sparkles size={12} /> Vettri Bot</span>
            <h2>Your AI workplace assistant</h2>
          </div>
          <button type="button" aria-label="Close Ask Vettri" className="vettri-assistant-panel__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form className="vettri-assistant-panel__search" onSubmit={submitMessage}>
          <span className="vettri-assistant-panel__search-icon"><Send size={15} /></span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={isSending}
            placeholder="Ask Vettri Bot anything..."
            aria-label="Ask Vettri Bot"
          />
          <button type="submit" aria-label="Send message" disabled={!query.trim() || isSending}>
            {isSending ? <LoaderCircle size={16} className="vettri-assistant-spin" /> : <Send size={16} />}
          </button>
        </form>

        <div className="vettri-assistant-panel__body">
          {messages.length === 0 ? (
            <div className="vettri-assistant-panel__welcome">
              <span className="vettri-assistant-panel__welcome-icon"><Sparkles size={20} /></span>
              <h3>Hi there 👋</h3>
              <p>I'm your Vettri workplace assistant. How can I help you today?</p>
              <div className="vettri-assistant-panel__starter-prompts" aria-label="Suggested questions">
                {['How do I request leave?', 'How can I map devices?', 'Which devices are offline?'].map((prompt) => (
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
            <div className="vettri-assistant-panel__conversation" aria-live="polite" aria-label="Conversation">
              <div className="vettri-assistant-panel__conversation-heading">
                <strong>Conversation</strong>
                <button type="button" disabled={isSending} onClick={startNewConversation}><RotateCcw size={13} /> New chat</button>
              </div>
              {messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={`vettri-assistant-message vettri-assistant-message--${message.role}`}>
                  <strong>{message.role === 'user' ? 'You' : 'Ask Vettri'}</strong>
                  <p>{message.content}</p>
                  {message.action?.route && (
                    <button type="button" onClick={() => handleNavigate(message.action.route)}>
                      {message.action.label || 'Open page'} <ArrowRight size={14} />
                    </button>
                  )}
                </article>
              ))}
              {isSending && <div className="vettri-assistant-panel__loading" role="status"><LoaderCircle size={15} className="vettri-assistant-spin" /> Vettri is thinking…</div>}
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
      </section>
    </div>,
    document.body
  );
}
