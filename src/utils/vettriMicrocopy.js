const safeDisplayName = (value) => (
  typeof value === 'string' && value.trim() ? value.trim() : ''
);

export const vettriMicrocopy = Object.freeze({
  welcome: Object.freeze({
    morning: '☀️ Good morning',
    afternoon: '👋 Good afternoon',
    evening: '🌙 Good evening',
    generic: '👋 Welcome back',
    assistant: 'What can I help you with today?',
  }),
  loading: Object.freeze({
    workspace: 'Loading your workspace…',
    people: 'Loading your people directory…',
    attendance: 'Checking attendance…',
    payroll: 'Preparing payroll data…',
    documents: 'Fetching documents…',
    devices: 'Checking your device inventory…',
    reports: 'Preparing your report…',
    assistant: 'Vettri is checking that for you…',
  }),
  success: Object.freeze({
    saved: 'Changes saved.',
    employeeAdded: 'Employee added successfully.',
    documentUploaded: 'Document uploaded successfully.',
    leaveSubmitted: 'Leave request submitted.',
  }),
  empty: Object.freeze({
    genericTitle: 'Nothing here yet',
    genericDescription: 'Try adjusting your filters or check back later.',
    employeesTitle: 'No employees yet',
    employeesDescription: 'Onboard your first employee to populate the directory.',
    employeesSearchTitle: 'No employees found',
    employeesSearchDescription: 'Try adjusting your search or filters.',
    devicesTitle: 'No devices connected yet',
    devicesDescription: 'Connect a Windows computer to start monitoring employee activity.',
    devicesSearchTitle: 'No matching devices',
    devicesSearchDescription: 'Try a different search term or status filter.',
    reports: 'Nothing to report yet. Your insights will appear here when data is available.',
  }),
  error: Object.freeze({
    genericTitle: 'Something went wrong',
    generic: 'We could not complete your request right now. Please try again in a moment.',
    network: 'Looks like Vettri lost connection. Check your connection and try again.',
    assistant: 'Vettri Bot is taking a short break. Your HRMS is still available; please try again in a moment.',
    validation: 'Please check the highlighted fields and try again.',
    authentication: 'Authentication could not be completed. Please try again.',
    sessionExpired: 'Your session has expired. Please sign in again to continue.',
    notFound: "We couldn't find the requested information.",
    conflict: 'This information is already registered. Please review it and try again.',
    rateLimit: 'Please wait a moment before trying again.',
    request: 'We could not complete your request. Please try again.',
  }),
  permission: Object.freeze({
    generic: "You don't have permission to access this area. Contact your Admin team if you need access.",
    it: "This area is managed by IT. Your current role doesn't have permission to manage devices.",
    hr: 'This action is restricted to authorized HR users.',
  }),
  assistant: Object.freeze({
    title: 'Ask Vettri',
    thinking: 'Vettri is checking that for you…',
    historyUnavailable: 'Conversation history is unavailable right now.',
    retry: 'Please try again in a moment.',
    suggestions: Object.freeze([
      'How do I request leave?',
      'How can I map devices?',
      'Which devices are offline?',
    ]),
  }),
});

export function getDisplayName(user, fallback = '') {
  const fullName = safeDisplayName(user?.fullName);
  if (fullName) return fullName;

  const firstAndLast = [user?.firstName, user?.lastName]
    .map(safeDisplayName)
    .filter(Boolean)
    .join(' ');
  if (firstAndLast) return firstAndLast;

  return safeDisplayName(user?.name) || fallback;
}

export function getWelcomeGreeting(user, date = new Date()) {
  const hour = date.getHours();
  const greeting = hour < 12
    ? vettriMicrocopy.welcome.morning
    : hour < 18
      ? vettriMicrocopy.welcome.afternoon
      : vettriMicrocopy.welcome.evening;
  const name = getDisplayName(user);

  return name ? `${greeting}, ${name}.` : `${vettriMicrocopy.welcome.generic}.`;
}

export function getAssistantWelcome(user) {
  const name = getDisplayName(user);
  return name
    ? `👋 Hey ${name}. ${vettriMicrocopy.welcome.assistant}`
    : `👋 Hi there. ${vettriMicrocopy.welcome.assistant}`;
}
