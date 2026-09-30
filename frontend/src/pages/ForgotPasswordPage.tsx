import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, MailCheck } from "lucide-react";
import { forgotPassword } from "../api/auth";
import { getErrorMessage, type ApiError } from "../api/client";
import { toast } from "../store/toastStore";
import { AuthCard } from "../components/auth/AuthCard";
import { inputClass, labelClass } from "../components/formStyles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: () => forgotPassword(email.trim()),
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  if (mutation.isSuccess) {
    return (
      <AuthCard
        icon={<MailCheck className="w-10 h-10 text-accent" />}
        title="Check your inbox"
        subtitle={
          <>
            If an account exists for <strong className="text-gray-800">{email.trim()}</strong>, we've sent a link to
            reset your password. It's valid for 1 hour.
          </>
        }
      >
        <Link
          to="/auth"
          className="block text-center w-full border border-gray-300 rounded-sm py-3 text-sm font-bold uppercase tracking-wide text-gray-700 hover:border-accent hover:text-accent"
        >
          Back to log in
        </Link>
      </AuthCard>
    );
  }

  const invalid = !EMAIL_PATTERN.test(email.trim());
  return (
    <AuthCard
      icon={<KeyRound className="w-10 h-10 text-accent" />}
      title="Forgot your password?"
      subtitle="Enter your account email and we'll send you a link to choose a new password."
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!invalid) mutation.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor="forgot-email" className={labelClass}>
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`${inputClass} ${touched && invalid ? "border-red-400" : ""}`}
          />
          {touched && invalid && <p className="text-xs text-red-700 mt-1">Enter a valid email</p>}
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm py-3 disabled:opacity-50"
        >
          {mutation.isPending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-gray-500 text-center mt-6">
        Remembered it?{" "}
        <Link to="/auth" className="font-semibold text-accent hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
