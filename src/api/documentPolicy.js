export const DOCUMENT_TYPE_METADATA = {
  ID_PROOF: { label: 'ID Proof', expiryApplicable: true },
  PASSPORT: { label: 'Passport', expiryApplicable: true },
  WORK_VISA: { label: 'Work Visa', expiryApplicable: true },
  PROFESSIONAL_CERTIFICATION: { label: 'Professional Certification', expiryApplicable: true },
  EMPLOYMENT_CONTRACT: { label: 'Employment Contract', expiryApplicable: true },
  OTHER: { label: 'Other', expiryApplicable: true },
  AADHAAR: { label: 'Aadhaar', expiryApplicable: false },
  PAN: { label: 'PAN', expiryApplicable: false },
  EXPERIENCE_LETTER: { label: 'Experience Letter', expiryApplicable: true },
};

export const DOCUMENT_TYPE_LABEL = Object.fromEntries(
  Object.entries(DOCUMENT_TYPE_METADATA).map(([type, metadata]) => [type, metadata.label])
);

export const EXPIRY_NOT_APPLICABLE_DOCUMENT_TYPES = Object.entries(DOCUMENT_TYPE_METADATA)
  .filter(([, metadata]) => !metadata.expiryApplicable)
  .map(([type]) => type);

export function canUploadOwnDocuments(user, employeeId) {
  if (user?.employeeId == null || employeeId == null || String(user.employeeId) !== String(employeeId)) {
    return false;
  }
  const permissions = user.permissions || [];
  const roles = user.roles || [];
  return !permissions.includes('EMPLOYEE_MANAGE') && !roles.includes('HR_ADMIN');
}

export function canReviewDocuments(user) {
  return (user?.permissions || []).includes('EMPLOYEE_MANAGE');
}

function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day)
    ? date
    : null;
}

export function getExpiryPresentation(document, today = new Date()) {
  const metadata = DOCUMENT_TYPE_METADATA[document?.documentType];
  if (metadata && !metadata.expiryApplicable) {
    return { date: 'Not applicable', label: null, color: 'var(--hz-text-secondary)' };
  }
  if (!document?.expiryDate) {
    return { date: '—', label: null, color: 'var(--hz-text-secondary)' };
  }

  const expiryDate = parseLocalDate(document.expiryDate);
  if (!expiryDate) {
    return { date: '—', label: null, color: 'var(--hz-text-secondary)' };
  }

  const expiryDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntilExpiry = Math.ceil((expiryDay - todayDay) / 86400000);
  if (daysUntilExpiry < 0) {
    return { date: expiryDate.toLocaleDateString(), label: 'Expired', color: 'var(--hz-danger-600)' };
  }
  if (daysUntilExpiry <= 30) {
    return { date: expiryDate.toLocaleDateString(), label: `${daysUntilExpiry}d left`, color: 'var(--hz-warning-600)' };
  }
  return { date: expiryDate.toLocaleDateString(), label: null, color: 'var(--hz-text-secondary)' };
}
