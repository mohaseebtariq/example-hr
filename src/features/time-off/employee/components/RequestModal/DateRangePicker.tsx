'use client';

type DateRangePickerProps = {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
};

const todayIso = new Date().toISOString().split('T')[0];

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex-1">
        <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
          Start date
        </label>
        <input
          id="start-date"
          type="date"
          value={startDate}
          min={todayIso}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex-1">
        <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
          End date
        </label>
        <input
          id="end-date"
          type="date"
          value={endDate}
          min={startDate || todayIso}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
