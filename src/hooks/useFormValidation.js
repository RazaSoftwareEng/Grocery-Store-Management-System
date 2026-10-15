import { useCallback, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Scrolls the field with this name into view, focuses it and shakes its wrapper.
 * Works inside modals too, because scrollIntoView scrolls every scrollable ancestor.
 */
export function scrollToField(name, root = document) {
  const scope = root || document;
  const control =
    scope.querySelector(`[name="${CSS.escape(name)}"]`) ||
    scope.querySelector(`[data-field="${CSS.escape(name)}"] input, [data-field="${CSS.escape(name)}"] select, [data-field="${CSS.escape(name)}"] textarea, [data-field="${CSS.escape(name)}"] button`);
  const wrapper = control?.closest('[data-field]') || scope.querySelector(`[data-field="${CSS.escape(name)}"]`) || control;
  if (!wrapper) return;

  const reduce = prefersReducedMotion();
  wrapper.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });

  window.setTimeout(() => {
    control?.focus?.({ preventScroll: true });
    wrapper.classList.remove('animate-shake');
    void wrapper.offsetWidth; // restart the animation
    wrapper.classList.add('animate-shake');
    window.setTimeout(() => wrapper.classList.remove('animate-shake'), 420);
  }, reduce ? 0 : 320);
}

/**
 * Real-time form validation.
 *
 *   const v = useFormValidation(formData, {
 *     name: (val) => (!val.trim() ? 'Name is required' : ''),
 *     price: (val, all) => (+val < +all.cost ? 'Below cost' : ''),
 *   });
 *   <Input {...v.field('name')} value=... onChange=... />
 *   onSubmit: if (!v.validate()) return;
 *
 * A field shows its error after it has been blurred once (or after a submit
 * attempt) and then updates live on every keystroke. validate() marks every
 * field, then scrolls to, focuses and shakes the first invalid one.
 */
export function useFormValidation(values, rules) {
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef(null);

  const errors = {};
  for (const key of Object.keys(rules)) {
    const message = rules[key]?.(values?.[key] ?? '', values || {});
    if (message) errors[key] = message;
  }

  const isVisible = (name) => submitted || touched[name];
  const errorFor = (name) => (isVisible(name) ? errors[name] || '' : '');

  const touch = useCallback((name) => {
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  }, []);

  /** Spread onto <Input>/<Select>: name, error, isValid, onBlur */
  const field = (name, { onBlur } = {}) => ({
    name,
    error: errorFor(name),
    isValid: isVisible(name) && !errors[name] && values?.[name] !== '' && values?.[name] != null,
    onBlur: (e) => {
      touch(name);
      onBlur?.(e);
    },
  });

  const validate = () => {
    setSubmitted(true);
    const first = Object.keys(rules).find((key) => errors[key]);
    if (first) {
      // wait one frame so error messages render before measuring/scrolling
      requestAnimationFrame(() => scrollToField(first, formRef.current || document));
      return false;
    }
    return true;
  };

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
  }, []);

  const visibleErrors = Object.entries(errors)
    .filter(([key]) => isVisible(key))
    .map(([key, message]) => ({ name: key, message }));

  return {
    errors,
    errorFor,
    field,
    touch,
    validate,
    reset,
    submitted,
    isValid: Object.keys(errors).length === 0,
    visibleErrors,
    formRef,
    jumpTo: (name) => scrollToField(name, formRef.current || document),
  };
}

/* Reusable rule helpers */
export const rules = {
  required: (label) => (v) => (String(v ?? '').trim() ? '' : `${label} is required`),
  minLength: (n, label = 'This field') => (v) =>
    String(v ?? '').trim() && String(v).trim().length < n ? `${label} must be at least ${n} characters` : '',
  positive: (label = 'Amount') => (v) => {
    if (v === '' || v == null) return `${label} is required`;
    if (Number.isNaN(Number(v))) return 'Numbers only';
    return Number(v) > 0 ? '' : `${label} must be more than 0`;
  },
  nonNegative: (label = 'Value', { required = true } = {}) => (v) => {
    if (v === '' || v == null) return required ? `${label} is required` : '';
    if (Number.isNaN(Number(v))) return 'Numbers only';
    return Number(v) >= 0 ? '' : `${label} can't be negative`;
  },
  phone: (v) => {
    if (!String(v ?? '').trim()) return '';
    const digits = String(v).replace(/[\s-+()]/g, '');
    return /^\d{10,13}$/.test(digits) ? '' : 'Enter a valid phone number (e.g. 0300 1234567)';
  },
  email: (v) => {
    if (!String(v ?? '').trim()) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()) ? '' : 'Enter a valid email address';
  },
  url: (v) => {
    if (!String(v ?? '').trim()) return '';
    try {
      const u = new URL(String(v).trim());
      return u.protocol === 'https:' || u.protocol === 'http:' ? '' : 'URL must start with https://';
    } catch {
      return 'Enter a valid URL (https://…)';
    }
  },
};

/** Run several rules in order; first message wins. */
export const all = (...fns) => (v, values) => {
  for (const fn of fns) {
    const message = fn(v, values);
    if (message) return message;
  }
  return '';
};
