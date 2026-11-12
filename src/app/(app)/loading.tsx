export default function Loading() {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل" className="flex animate-pulse flex-col gap-5">
      <div className="h-8 w-64 rounded-xl bg-line" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-32 rounded-card bg-white" />)}
      </div>
      <div className="h-80 rounded-card bg-white" />
    </div>
  );
}
