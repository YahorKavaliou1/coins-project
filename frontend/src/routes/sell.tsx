import { RequireRole } from "../components/RequireRole";
import { SellPage } from "../pages/SellPage";

export default function Route() {
  return (
    <RequireRole roles={["seller", "admin"]}>
      <SellPage />
    </RequireRole>
  );
}
