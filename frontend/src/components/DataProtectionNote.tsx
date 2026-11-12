import { Link } from "react-router-dom";
import { operator } from "../content/legal";

/**
 * The basic layer of data protection information required where personal data is collected
 * (GDPR art. 13, LOPDGDD art. 11): who, why, rights, and a link to the full policy.
 */
export function DataProtectionNote({
  purpose,
  className = "",
}: {
  purpose: string;
  className?: string;
}) {
  return (
    <p className={`text-xs text-gray-500 leading-relaxed ${className}`}>
      <span className="font-semibold">Data protection.</span> Controller:{" "}
      {operator.legalName}. Purpose: {purpose}. You may access, rectify and
      erase your data and exercise your other rights as explained in our{" "}
      <Link to="/privacy" className="text-accent hover:underline">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
