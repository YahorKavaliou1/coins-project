import { Link } from "react-router-dom";

/** Shown with a 404 status for unknown addresses and coins that don't exist. */
export function NotFound() {
  return (
    <div className="max-w-xl mx-auto py-16 text-center">
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-gray-600 mb-6">This page doesn't exist or has been removed.</p>
      <Link to="/browse" className="text-accent font-semibold">
        Browse the shop
      </Link>
    </div>
  );
}
