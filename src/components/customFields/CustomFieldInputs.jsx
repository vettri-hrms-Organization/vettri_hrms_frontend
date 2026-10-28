import { useId } from 'react';

/**
 * Renders one form control per custom field definition, grouped by section.
 * values: { [key]: value }, errors: { [key]: message }, onChange(key, value).
 * readOnlyKeys: keys shown but not editable (e.g. HR-only fields on self-service).
 */
export default function CustomFieldInputs({ definitions, values, errors = {}, onChange, readOnlyKeys = [], disabled = false }) {
  const sections = [];
  const bySection = new Map();
  (definitions || []).forEach((definition) => {
    const section = definition.section || 'Additional details';
    if (!bySection.has(section)) {
      bySection.set(section, []);
      sections.push(section);
    }
    bySection.get(section).push(definition);
  });
  if (!sections.length) return null;
  return (
    <div className="d-flex flex-column gap-3">
      {sections.map((section) => (
        <fieldset key={section}>
          <legend style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>{section}</legend>
          <div className="row">
            {bySection.get(section).map((definition) => (
              <CustomFieldInput
                key={definition.key}
                definition={definition}
                value={values?.[definition.key]}
                error={errors[definition.key]}
                disabled={disabled || readOnlyKeys.includes(definition.key)}
                onChange={(value) => onChange(definition.key, value)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function CustomFieldInput({ definition, value, error, disabled, onChange }) {
  const id = `cf-${useId().replace(/:/g, '')}`;
  const options = definition.options || [];
  const invalid = error ? ' is-invalid' : '';
  const label = (
    <label htmlFor={id} className="form-label" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 500 }}>
      {definition.label}
      {definition.required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
    </label>
  );
  let control;
  switch (definition.type) {
    case 'BOOLEAN':
      return (
        <div className="col-12 col-md-6 mb-3 d-flex align-items-end">
          <div className="form-check">
            <input id={id} type="checkbox" className={`form-check-input${invalid}`} checked={value === true || value === 'true'}
              disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
            <label htmlFor={id} className="form-check-label">{definition.label}</label>
            {error && <div className="invalid-feedback d-block">{error}</div>}
          </div>
        </div>
      );
    case 'SELECT':
      control = (
        <select id={id} className={`form-select${invalid}`} value={value ?? ''} disabled={disabled}
          aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select…</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
      break;
    case 'MULTISELECT': {
      const selected = Array.isArray(value) ? value : [];
      control = (
        <div id={id} role="group" aria-label={definition.label} className="d-flex flex-wrap gap-3">
          {options.map((option) => (
            <label key={option} className="form-check-label d-flex align-items-center gap-1">
              <input type="checkbox" className="form-check-input" checked={selected.includes(option)} disabled={disabled}
                onChange={(event) => onChange(event.target.checked
                  ? options.filter((o) => o === option || selected.includes(o))
                  : selected.filter((o) => o !== option))} />
              {option}
            </label>
          ))}
        </div>
      );
      break;
    }
    default: {
      const type = { NUMBER: 'number', DATE: 'date', EMAIL: 'email', PHONE: 'tel' }[definition.type] || 'text';
      control = (
        <input id={id} type={type} className={`form-control${invalid}`} value={value ?? ''} disabled={disabled}
          step={definition.type === 'NUMBER' ? 'any' : undefined}
          placeholder={definition.type === 'PHONE' ? '+91 98765 43210' : undefined}
          maxLength={definition.type === 'TEXT' ? 1000 : undefined}
          aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
      );
    }
  }
  return (
    <div className="col-12 col-md-6 mb-3">
      {label}
      {control}
      {error && <div className="invalid-feedback d-block">{error}</div>}
    </div>
  );
}
