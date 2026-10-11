/** Hidden field bots often fill. Humans never see it. */
export function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden" tabIndex={-1}>
      <label>
        Company website
        <input
          type="text"
          name="websiteConfirm"
          autoComplete="off"
          tabIndex={-1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
