import { RequireRole } from "../components/RequireRole";
import { MyLotsPage } from "../pages/MyLotsPage";

export default function Route() {
  return (
    <RequireRole roles={["seller", "admin"]}>
      <MyLotsPage />
    </RequireRole>
  );
}
