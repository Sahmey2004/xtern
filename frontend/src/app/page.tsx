export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600">
        Inventory overview, active pipelines, and recent POs will appear here.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-500">Total SKUs</h2>
          <p className="text-3xl font-bold mt-2">—</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-500">Pending POs</h2>
          <p className="text-3xl font-bold mt-2">—</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-500">Pipeline Runs</h2>
          <p className="text-3xl font-bold mt-2">—</p>
        </div>
      </div>
    </div>
  );
}
