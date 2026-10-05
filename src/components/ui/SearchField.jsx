import { Search } from 'lucide-react';

export default function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  ...rest
}) {
  return (
    <label className={`hz-search-field ${className}`.trim()}>
      <Search size={16} className="hz-search-field__icon" aria-hidden="true" />
      <input
        type="search"
        className="form-control hz-search-field__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        {...rest}
      />
    </label>
  );
}
