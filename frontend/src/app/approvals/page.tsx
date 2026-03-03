export default function ApprovalsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Approval Queue</h1>
      <p className="text-gray-600">
        Review, approve, reject, or modify Purchase Orders here.
      </p>
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <p className="text-gray-400 text-center py-8">
          No pending approvals. Run a pipeline first.
        </p>
      </div>
    </div>
  );
}
