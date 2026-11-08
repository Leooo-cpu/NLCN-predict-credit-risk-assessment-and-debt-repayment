import { useState, type InvalidEvent } from "react";

// Expose the browser's existing constraints without adding validation rules.
export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  function onInvalid(event: InvalidEvent<HTMLFormElement>) {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement
    ) {
      setErrors((previous) => ({
        ...previous,
        [target.id]: target.validationMessage,
      }));
    }
  }
  function clear(id: string) {
    setErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }
  function attributes(id: string) {
    return {
      "aria-invalid": !!errors[id],
      "aria-describedby": errors[id] ? id + "-error" : undefined,
    };
  }
  return { errors, onInvalid, clear, attributes };
}
