import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, MailCheck, MailX } from "lucide-react";
import { verifyEmail } from "../api/auth";
import { getErrorMessage, INVALID_LINK_DETAIL, isBlockedError, type ApiError } from "../api/client";
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
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // The server asks for the account password as well as the link, so someone who registered
  // this address before its owner can't end up with an account they know the password of.
  const mutation = useMutation({
    mutationFn: () => verifyEmail(token, password),
    onSuccess: (tokens) => {
      setToken(tokens.access_token);
      queryClient.invalidateQueries();
      toast.success("Email confirmed. Welcome to Coins Catalog!");
      navigate("/browse", { replace: true });
    },
  });

  const error = mutation.error as ApiError | null;
  const blocked = error ? isBlockedError(error) : false;
  const linkBroken = !token || error?.response?.data?.detail === INVALID_LINK_DETAIL;

  if (!blocked && !linkBroken) {
    return (
      <AuthCard
        icon={<MailCheck className="w-10 h-10 text-accent" />}
        title="Confirm your email"
        subtitle="Enter the password you chose when registering to activate your account."
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (password) mutation.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label htmlFor="verify-password" className={labelClass}>
              Password
            </label>
            <div className="relative">
              <input
                id="verify-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-10 ${error ? "border-red-400" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-red-700 mt-1">{getErrorMessage(error)}</p>}
          </div>
          <button
            type="submit"
            disabled={mutation.isPending || !password}
            className="mt-2 w-full bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm py-3 disabled:opacity-50"
          >
            {mutation.isPending ? "Confirming…" : "Confirm email"}
          </button>
          <Link to="/forgot-password" className="text-sm text-center text-gray-500 hover:text-accent">
            Forgot password?
          </Link>
        </form>
      </AuthCard>
    );
  }

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
