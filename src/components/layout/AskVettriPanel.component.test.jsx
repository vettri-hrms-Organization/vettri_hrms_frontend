import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AskVettriPanel from './AskVettriPanel.jsx';

const mocks = vi.hoisted(() => ({
  assistantApi: {
    chat: vi.fn(),
    conversations: vi.fn(),
    conversation: vi.fn(),
  },
  auth: null,
  navigate: vi.fn(),
}));

vi.mock('../../api/endpoints/assistant.js', () => ({ assistantApi: mocks.assistantApi }));
vi.mock('../../hooks/useAuth.js', () => ({ useAuth: () => mocks.auth }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('./askVettriSuggestions.js', () => ({ getAskVettriSuggestions: () => [] }));

function deferred() {
  let resolve;
  const promise = new Promise((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function renderPanel(user = null) {
  mocks.auth = {
    user,
    hasPermission: () => false,
    hasRole: () => false,
  };
  return render(<AskVettriPanel open onClose={vi.fn()} />);
}

describe('AskVettriPanel chat experience', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.assistantApi.chat.mockReset().mockResolvedValue({
      conversationId: 'conversation-1',
      message: 'Vettri response',
      actions: [],
    });
    mocks.assistantApi.conversations.mockReset().mockResolvedValue([]);
    mocks.assistantApi.conversation.mockReset();
    mocks.navigate.mockReset();
  });

  afterEach(() => {
    cleanup();
    delete HTMLElement.prototype.scrollTo;
  });

  it('sends a message with Enter', async () => {
    const user = userEvent.setup();
    renderPanel();
    const input = screen.getByRole('textbox', { name: 'Message Ask Vettri' });

    await user.type(input, 'Hello Vettri{Enter}');

    await waitFor(() => expect(mocks.assistantApi.chat).toHaveBeenCalledTimes(1));
    expect(mocks.assistantApi.chat).toHaveBeenCalledWith({
      message: 'Hello Vettri',
      conversationId: null,
    });
  });

  it('keeps Shift+Enter as a newline and does not submit', async () => {
    const user = userEvent.setup();
    renderPanel();
    const input = screen.getByRole('textbox', { name: 'Message Ask Vettri' });

    await user.type(input, 'First line');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(input, 'Second line');

    expect(input.value).toBe('First line\nSecond line');
    expect(mocks.assistantApi.chat).not.toHaveBeenCalled();
  });

  it('scrolls to the newest message after one is added', async () => {
    const user = userEvent.setup();
    renderPanel();
    const transcript = screen.getByRole('log', { name: 'Conversation messages' });
    transcript.scrollTo = vi.fn();
    Object.defineProperty(transcript, 'scrollHeight', { configurable: true, value: 640 });

    await user.type(screen.getByRole('textbox', { name: 'Message Ask Vettri' }), 'Scroll me{Enter}');

    await waitFor(() => expect(transcript.scrollTo).toHaveBeenCalledWith({
      top: 640,
      behavior: 'smooth',
    }));
  });

  it('does not force-scroll after the user moves up, and offers a scroll-to-latest control', async () => {
    const user = userEvent.setup();
    const request = deferred();
    mocks.assistantApi.chat.mockReturnValue(request.promise);
    renderPanel();
    const transcript = screen.getByRole('log', { name: 'Conversation messages' });
    transcript.scrollTo = vi.fn();
    Object.defineProperties(transcript, {
      scrollHeight: { configurable: true, value: 640 },
      clientHeight: { configurable: true, value: 240 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });

    await user.type(screen.getByRole('textbox', { name: 'Message Ask Vettri' }), 'Keep my place{Enter}');
    await waitFor(() => expect(transcript.scrollTo).toHaveBeenCalled());
    const callCountBeforeReply = transcript.scrollTo.mock.calls.length;
    transcript.scrollTop = 0;
    fireEvent.scroll(transcript);

    request.resolve({ conversationId: 'conversation-1', message: 'New reply', actions: [] });
    await screen.findByText('New reply');

    expect(transcript.scrollTo).toHaveBeenCalledTimes(callCountBeforeReply);
    const latestButton = screen.getByRole('button', { name: 'Scroll to latest' });
    await user.click(latestButton);
    expect(transcript.scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: 'smooth' });
  });

  it('renders the authenticated user display name on user messages', async () => {
    const user = userEvent.setup();
    renderPanel({ fullName: 'Avery Employee' });
    await user.type(screen.getByRole('textbox', { name: 'Message Ask Vettri' }), 'My question{Enter}');

    const message = await screen.findByText('My question');
    expect(within(message.closest('article')).getByText('Avery Employee')).toBeTruthy();
  });

  it('falls back to You when the authenticated display name is unavailable', async () => {
    const user = userEvent.setup();
    renderPanel({ fullName: '  ' });
    await user.type(screen.getByRole('textbox', { name: 'Message Ask Vettri' }), 'My question{Enter}');

    const message = await screen.findByText('My question');
    expect(within(message.closest('article')).getByText('You')).toBeTruthy();
  });

  it('shows the Ask Vettri thinking state while a request is pending', async () => {
    const user = userEvent.setup();
    const request = deferred();
    mocks.assistantApi.chat.mockReturnValue(request.promise);
    renderPanel();
    await user.type(screen.getByRole('textbox', { name: 'Message Ask Vettri' }), 'Please help{Enter}');

    expect(await screen.findByRole('status', { name: 'Ask Vettri is thinking' })).toBeTruthy();
    request.resolve({ conversationId: 'conversation-1', message: 'Done', actions: [] });
    await screen.findByText('Done');
  });

  it('loads and renders conversation history in chronological order', async () => {
    const user = userEvent.setup();
    mocks.assistantApi.conversations.mockResolvedValue([{ id: 'history-1', title: 'History conversation' }]);
    mocks.assistantApi.conversation.mockResolvedValue({
      conversation: { id: 'history-1' },
      messages: [
        { role: 'ASSISTANT', content: 'Later answer', createdAt: '2025-02-02T10:00:00Z' },
        { role: 'USER', content: 'Earlier question', createdAt: '2025-02-01T10:00:00Z' },
      ],
    });
    renderPanel();
    const transcript = screen.getByRole('log', { name: 'Conversation messages' });
    transcript.scrollTo = vi.fn();

    await user.click(await screen.findByRole('button', { name: 'History conversation' }));

    const earlier = await screen.findByText('Earlier question');
    const renderedMessages = within(transcript).getAllByRole('article');
    expect(renderedMessages[0].textContent).toContain(earlier.textContent);
    expect(renderedMessages[1].textContent).toContain('Later answer');
    await waitFor(() => expect(transcript.scrollTo).toHaveBeenCalled());
  });

  it('renders a backend leave confirmation card and sends only the explicit confirmation text', async () => {
    const user = userEvent.setup();
    mocks.assistantApi.chat
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        message: 'I have prepared the request.',
        actions: [{
          type: 'LEAVE_CONFIRMATION',
          label: 'Submit Leave',
          route: null,
          data: {
            leaveType: 'Casual Leave',
            startDate: '2026-10-09',
            endDate: '2026-10-09',
            days: 1,
            remainingDays: 3,
            duration: 'Full day',
          },
        }],
      })
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        message: 'Your request is pending approval.',
        actions: [],
      });
    renderPanel();
    await user.type(screen.getByRole('textbox', { name: 'Message Ask Vettri' }), 'Apply leave{Enter}');

    const confirmation = await screen.findByRole('group', { name: 'Confirm leave request' });
    expect(within(confirmation).getByText('Casual Leave')).toBeTruthy();
    expect(within(confirmation).getByText(/October 9, 2026/)).toBeTruthy();
    expect(within(confirmation).getByText(/Available balance: 3 days/)).toBeTruthy();
    await user.click(within(confirmation).getByRole('button', { name: 'Submit Leave' }));

    await waitFor(() => expect(mocks.assistantApi.chat).toHaveBeenCalledTimes(2));
    expect(mocks.assistantApi.chat).toHaveBeenLastCalledWith({
      message: 'Yes, submit it.',
      conversationId: 'conversation-1',
    });
    await screen.findByText('Your request is pending approval.');
  });

  it('lets an employee edit leave details and asks the backend to prepare a fresh confirmation', async () => {
    const user = userEvent.setup();
    const confirmation = (startDate, endDate, reason) => ({
      type: 'LEAVE_CONFIRMATION',
      label: 'Submit Leave',
      route: null,
      data: {
        leaveType: 'Casual Leave',
        startDate,
        endDate,
        days: 2,
        remainingDays: 3,
        reason,
      },
    });
    mocks.assistantApi.chat
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        message: 'Please review the leave request.',
        actions: [confirmation('2026-10-12', '2026-10-13', 'Personal work')],
      })
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        message: 'I updated the request. Please confirm the new details.',
        actions: [confirmation('2026-10-14', '2026-10-15', 'Family event')],
      });
    renderPanel();

    await user.type(screen.getByRole('textbox', { name: 'Message Ask Vettri' }), 'Apply casual leave{Enter}');
    const initialCard = await screen.findByRole('group', { name: 'Confirm leave request' });
    expect(within(initialCard).getByText('Reason: Personal work')).toBeTruthy();
    await user.click(within(initialCard).getByRole('button', { name: 'Edit' }));

    const editor = within(initialCard).getByRole('form', { name: 'Edit leave request' });
    await user.clear(within(editor).getByLabelText('Start date'));
    await user.type(within(editor).getByLabelText('Start date'), '2026-10-14');
    await user.clear(within(editor).getByLabelText('End date'));
    await user.type(within(editor).getByLabelText('End date'), '2026-10-15');
    await user.clear(within(editor).getByLabelText('Reason'));
    await user.type(within(editor).getByLabelText('Reason'), 'Family event');
    await user.click(within(editor).getByRole('button', { name: 'Review updated request' }));

    await waitFor(() => expect(mocks.assistantApi.chat).toHaveBeenCalledTimes(2));
    expect(mocks.assistantApi.chat).toHaveBeenLastCalledWith({
      message: 'Please update the pending leave request: Casual Leave from 2026-10-14 to 2026-10-15. Reason: Family event.',
      conversationId: 'conversation-1',
    });
    const updatedCard = (await screen.findAllByRole('group', { name: 'Confirm leave request' })).at(-1);
    expect(within(updatedCard).getByText(/October 14, 2026/)).toBeTruthy();
    expect(within(updatedCard).getByText('Reason: Family event')).toBeTruthy();
  });

  it('keeps a leave confirmation available when the chat API fails during submission', async () => {
    const user = userEvent.setup();
    mocks.assistantApi.chat
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        message: 'Please review the request.',
        actions: [{
          type: 'LEAVE_CONFIRMATION',
          data: {
            leaveType: 'Casual Leave',
            startDate: '2026-10-09',
            endDate: '2026-10-09',
            days: 1,
            remainingDays: 3,
          },
        }],
      })
      .mockRejectedValueOnce(new Error('network unavailable'));
    renderPanel();
    await user.type(screen.getByRole('textbox', { name: 'Message Ask Vettri' }), 'Apply casual leave{Enter}');

    const confirmation = await screen.findByRole('group', { name: 'Confirm leave request' });
    await user.click(within(confirmation).getByRole('button', { name: 'Submit Leave' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(within(confirmation).getByRole('button', { name: 'Submit Leave' }).disabled).toBe(false);
    expect(screen.queryByText('Your request is pending approval.')).toBeNull();
  });

  it('sends cancellation only after the employee selects the cancel request control', async () => {
    const user = userEvent.setup();
    mocks.assistantApi.chat
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        message: 'Please review the request.',
        actions: [{
          type: 'LEAVE_CONFIRMATION',
          data: {
            leaveType: 'Sick Leave',
            startDate: '2026-10-09',
            endDate: '2026-10-10',
            days: 2,
            remainingDays: 5,
          },
        }],
      })
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        message: 'The pending leave request was cancelled.',
        actions: [],
      });
    renderPanel();
    await user.type(screen.getByRole('textbox', { name: 'Message Ask Vettri' }), 'Apply sick leave{Enter}');

    const confirmation = await screen.findByRole('group', { name: 'Confirm leave request' });
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel request' }));

    await waitFor(() => expect(mocks.assistantApi.chat).toHaveBeenCalledTimes(2));
    expect(mocks.assistantApi.chat).toHaveBeenLastCalledWith({
      message: 'Cancel',
      conversationId: 'conversation-1',
    });
    await screen.findByText('The pending leave request was cancelled.');
    expect(within(confirmation).getByRole('button', { name: 'Submit Leave' }).disabled).toBe(true);
  });

  it('minimizes and restores without losing chat state or reloading conversations', async () => {
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(mocks.assistantApi.conversations).toHaveBeenCalledTimes(1));
    const input = screen.getByRole('textbox', { name: 'Message Ask Vettri' });
    await user.type(input, 'Earlier message{Enter}');
    await screen.findByText('Vettri response');
    await user.type(input, 'Keep this draft');
    await user.click(screen.getByRole('button', { name: 'Minimize Ask Vettri' }));

    expect(screen.queryByRole('dialog', { name: 'Ask Vettri' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Restore Ask Vettri' }));

    expect(screen.getByRole('dialog', { name: 'Ask Vettri' })).toBeTruthy();
    expect(screen.getByText('Earlier message')).toBeTruthy();
    expect(screen.getByText('Vettri response')).toBeTruthy();
    const restoredInput = screen.getByRole('textbox', { name: 'Message Ask Vettri' });
    expect(restoredInput.value).toBe('Keep this draft');
    expect(document.activeElement).toBe(restoredInput);
    expect(mocks.assistantApi.conversations).toHaveBeenCalledTimes(1);
    expect(mocks.assistantApi.chat).toHaveBeenCalledTimes(1);
  });

  it('retains the existing request error and retry behavior', async () => {
    const user = userEvent.setup();
    mocks.assistantApi.chat
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ conversationId: 'conversation-1', message: 'Recovered', actions: [] });
    renderPanel();
    await user.type(screen.getByRole('textbox', { name: 'Message Ask Vettri' }), 'Retry me{Enter}');

    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Recovered');
    expect(mocks.assistantApi.chat).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith('[Ask Vettri] chat request failed', {
      status: undefined,
      code: undefined,
    });
  });
});
