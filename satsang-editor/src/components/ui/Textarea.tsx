interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  className = '',
  ...props
}: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-satsang-bark mb-2">
          {label}
        </label>
      )}
      <textarea
        className={`w-full px-4 py-2.5 rounded-lg border-2 border-satsang-sandalwood bg-satsang-parchment text-satsang-soil placeholder-satsang-ash focus:outline-none focus:border-satsang-saffron focus:ring-2 focus:ring-satsang-turmeric/20 transition-all resize-none ${className}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}
