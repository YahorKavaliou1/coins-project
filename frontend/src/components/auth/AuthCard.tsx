import type { ReactNode } from "react";

interface AuthCardProps {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}

/** Centered card used by the login/registration and email-link pages. */
export function AuthCard({ icon, title, subtitle, children }: AuthCardProps) {
  return (
    <div className="flex justify-center pt-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-md p-8">
        {icon && <div className="mb-4">{icon}</div>}
        <h1 className="text-xl font-bold mb-1">{title}</h1>
        {subtitle && <div className="text-sm text-gray-500 mb-6">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}
