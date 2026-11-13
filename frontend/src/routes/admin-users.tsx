import { RequireRole } from "../components/RequireRole";
import { AdminUsersPage } from "../pages/AdminUsersPage";

export default function Route() {
  return (
    <RequireRole roles={["admin"]}>
      <AdminUsersPage />
    </RequireRole>
  );
}
