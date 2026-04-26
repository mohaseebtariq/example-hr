import { ManagerShell } from '@/features/time-off/manager/components/ManagerShell';

export default async function ManagerPage({
  params,
}: {
  params: Promise<{ managerId: string }>;
}) {
  const { managerId } = await params;
  return <ManagerShell managerId={managerId} />;
}

