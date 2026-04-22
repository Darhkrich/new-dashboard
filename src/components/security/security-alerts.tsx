"use client";

type Alert = {
  title: string;
  message: string;
  severity: string;
  time: string;
};

export default function SecurityAlerts({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="space-y-3">
      {alerts.length === 0 && <p className="text-sm text-gray-500">No alerts</p>}

      {alerts.map((alert, index) => (
        <div key={`${alert.title}-${alert.time}-${index}`} className="flex justify-between border-b pb-2 text-sm">
          <div>
            <p>{alert.message}</p>
            <p className="text-xs text-gray-400">{new Date(alert.time).toLocaleString()}</p>
          </div>

          <span className="font-medium text-red-500">{alert.severity}</span>
        </div>
      ))}
    </div>
  );
}
