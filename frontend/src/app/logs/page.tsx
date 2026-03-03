export default function LogsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Decision Log</h1>
      <p className="text-gray-600">
        Full audit trail of all agent decisions with timestamps,
        inputs, outputs, and rationale.
      </p>
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <p className="text-gray-400 text-center py-8">
          No decisions logged yet. Run a pipeline first.
        </p>
      </div>
    </div>
  );
}
