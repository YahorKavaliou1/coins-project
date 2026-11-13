import { RequireRole } from "../components/RequireRole";
import { SalesPage } from "../pages/SalesPage";

export default function Route() {
  return (
    <RequireRole roles={["seller", "admin"]}>
      <SalesPage />
    </RequireRole>
  );
}
