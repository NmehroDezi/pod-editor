export function ProcessingSpinner() {
  return (
    <div className="flex justify-center mb-12">
      <style>{`
        @keyframes om-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .om-spinner {
          animation: om-spin 3s linear infinite;
        }
      `}</style>
      <div className="om-spinner text-6xl text-satsang-gold opacity-70">
        ॐ
      </div>
    </div>
  );
}
