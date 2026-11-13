import { RequireRole } from "../components/RequireRole";
import { AdminUserDetailPage } from "../pages/AdminUserDetailPage";

export default function Route() {
  return (
    <RequireRole roles={["admin"]}>
      <AdminUserDetailPage />
    </RequireRole>
  );
}
