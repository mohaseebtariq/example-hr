import { EmployeeShell } from '@/features/time-off/employee/components/EmployeeShell';

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return <EmployeeShell employeeId={employeeId} />;
}

