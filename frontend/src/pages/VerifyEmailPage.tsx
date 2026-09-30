import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MailX } from "lucide-react";
import { verifyEmail } from "../api/auth";
import { getErrorMessage, isBlockedError, type ApiError } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import { AuthCard } from "../components/auth/AuthCard";
import { ResendVerificationButton } from "../components/auth/ResendVerificationButton";
import { inputClass, labelClass } from "../components/formStyles";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const setToken = useAuthStore((s) => s.setToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: () => verifyEmail(token),
    onSuccess: (tokens) => {
      setToken(tokens.access_token);
      queryClient.invalidateQueries();
      toast.success("Email confirmed. Welcome to Coins Catalog!");
      navigate("/browse", { replace: true });
    },
  });

  // The token is single-use: StrictMode runs effects twice in development, so guard with a ref.
  const started = useRef(false);
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    mutation.mutate();
  }, [token, mutation]);

  if (token && !mutation.isError) {
    return (
      <AuthCard
        icon={<Loader2 className="w-10 h-10 text-accent animate-spin" />}
        title="Confirming your email…"
      />
    );
  }

  const error = mutation.error as ApiError | null;
  const blocked = error ? isBlockedError(error) : false;

  return (
    <AuthCard
      icon={<MailX className="w-10 h-10 text-red-700" />}
      title={blocked ? "Account blocked" : "This link doesn't work"}
      subtitle={
        blocked
          ? getErrorMessage(error!)
          : "The confirmation link is invalid, already used or expired. Enter your email to get a new one."
      }
    >
      {!blocked && (
        <div className="mb-6">
          <label htmlFor="verify-email" className={labelClass}>
            Email
          </label>
          <input
            id="verify-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
          <div className="text-sm mt-2">{email.includes("@") && <ResendVerificationButton email={email.trim()} />}</div>
        </div>
      )}
      <Link
        to="/auth"
        className="block text-center w-full border border-gray-300 rounded-sm py-3 text-sm font-bold uppercase tracking-wide text-gray-700 hover:border-accent hover:text-accent"
      >
        Back to log in
      </Link>
    </AuthCard>
  );
}
