import AdminLogin from '@/components/admin/AdminLogin';
import { isAdminConfigured } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  const configured = isAdminConfigured();

  return <AdminLogin configured={configured} />;
}
