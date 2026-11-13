import { RequireRole } from "../components/RequireRole";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";

export default function Route() {
  return (
    <RequireRole roles={["admin"]}>
      <AdminOrdersPage />
    </RequireRole>
  );
}
