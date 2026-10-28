/** "HR_ADMIN" -> "HR Admin", "SUPER_ADMIN" -> "Super Admin". */
export function formatRole(role) {
  if (!role) return 'Member';
  return String(role)
    .split('_')
    .map((part) => (part.length <= 2 ? part : part.charAt(0) + part.slice(1).toLowerCase()))
    .join(' ');
}
