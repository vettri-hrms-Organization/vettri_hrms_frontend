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

  const suggestions = useMemo(
    () => getAskVettriSuggestions({ query, user, hasPermission, hasRole }),
    [query, user, hasPermission, hasRole]
  );

  const selectedSuggestion = suggestions[0];

  useEffect(() => {
    if (!open) return undefined;
    setQuery(initialQuery);
    inputRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, initialQuery, onClose]);

  function handleNavigate(route) {
    onClose();
    navigate(route);
  }

  async function submitMessage(event) {
    event.preventDefault();
    const message = query.trim();
    if (!message || isSending) return;

    const history = messages.slice(-12).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setQuery('');
    setChatError('');
    setIsSending(true);
    try {
      const response = await assistantApi.chat({
        message,
        history,
      });
      setMessages((current) => [...current, {
        role: 'assistant',
        content: response.message,
        action: response.actions?.[0] || null,
      }]);
    } catch {
      setChatError('Ask Vettri could not reach the assistant service. You can still use the authorized quick actions below.');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function clearConversation() {
    setMessages([]);
    setChatError('');
    setQuery('');
    inputRef.current?.focus();
  }

  if (!open) return null;

  return createPortal(
    <div className="vettri-assistant-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="vettri-assistant-panel" aria-label="Ask Vettri" role="dialog" aria-modal="true">
        <div className="vettri-assistant-panel__header">
          <div className="vettri-assistant-panel__title-wrap">
            <span className="vettri-assistant-panel__badge"><Sparkles size={12} /> Ask Vettri</span>
            <h2>Workplace assistant</h2>
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
            placeholder="Ask about leave, attendance, your payslip, or a Vettri workflow..."
            aria-label="Ask Vettri"
          />
          <button type="submit" aria-label="Send message" disabled={!query.trim() || isSending}>
            {isSending ? <LoaderCircle size={16} className="vettri-assistant-spin" /> : <Send size={16} />}
          </button>
        </form>

        <div className="vettri-assistant-panel__body">
          {messages.length > 0 && (
            <div className="vettri-assistant-panel__conversation" aria-live="polite" aria-label="Conversation">
              <div className="vettri-assistant-panel__conversation-heading">
                <strong>Conversation</strong>
                <button type="button" onClick={clearConversation}><RotateCcw size={13} /> Clear</button>
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
          {chatError && <p className="vettri-assistant-panel__error" role="alert">{chatError}</p>}
          <div className="vettri-assistant-panel__spotlight">
            <div className="vettri-assistant-panel__spotlight-icon"><Sparkles size={16} /></div>
            <div>
              <small>Recommended next step</small>
              <strong>{selectedSuggestion?.label || 'No matching action found'}</strong>
              <span>{selectedSuggestion?.description || 'Try asking about a page or task you have permission to access.'}</span>
            </div>
            <button type="button" disabled={!selectedSuggestion} onClick={() => selectedSuggestion && handleNavigate(selectedSuggestion.route)}>
              Open <ArrowRight size={15} />
            </button>
          </div>

          <div className="vettri-assistant-panel__list-header">
            <span>Quick actions</span>
            <small>{suggestions.length} matches</small>
          </div>

          <div className="vettri-assistant-panel__list" role="listbox" aria-label="Ask Vettri suggestions">
            {suggestions.length ? suggestions.map((item) => {
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
            }) : (
              <p className="vettri-assistant-panel__empty" role="status">
                No authorized actions match this query.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
