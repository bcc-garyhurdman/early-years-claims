"use client";

/** Header checkbox that toggles every `name` checkbox belonging to form `formId`. */
export default function SelectAll({ formId, name }: { formId: string; name: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all cases"
      onChange={(e) => {
        const boxes = document.querySelectorAll<HTMLInputElement>(
          `input[type=checkbox][form="${formId}"][name="${name}"]`
        );
        boxes.forEach((b) => {
          if (!b.disabled) b.checked = e.currentTarget.checked;
        });
      }}
    />
  );
}
