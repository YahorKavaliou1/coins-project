import { RequireRole } from "../components/RequireRole";
import { AccountPage } from "../pages/AccountPage";

export default function Route() {
  return (
    <RequireRole roles={["user", "seller", "admin"]}>
      <AccountPage />
    </RequireRole>
  );
}
