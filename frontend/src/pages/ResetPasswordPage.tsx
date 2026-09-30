import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, MailX } from "lucide-react";
import { resetPassword } from "../api/auth";
import { getErrorMessage, type ApiError } from "../api/client";
import { toast } from "../store/toastStore";
import { AuthCard } from "../components/auth/AuthCard";
import { inputClass, labelClass } from "../components/formStyles";
import { PasswordRequirements } from "../components/auth/PasswordRequirements";
import { passwordError } from "../utils/password";


export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: (data) => {
      toast.success(data.message);
      navigate("/auth", { replace: true });
    },
    onError: (err: ApiError) => {
      if (err.response?.status !== 400) toast.error(getErrorMessage(err));
    },
  });

  const linkBroken = !token || (mutation.error as ApiError | null)?.response?.status === 400;
  if (linkBroken) {
    return (
      <AuthCard
        icon={<MailX className="w-10 h-10 text-red-700" />}
        title="This link doesn't work"
        subtitle="The reset link is invalid, already used or expired. Request a new one."
      >
        <Link
          to="/forgot-password"
          className="block text-center w-full bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm py-3"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  const weak = passwordError(password) !== null;
  const mismatch = password !== confirm;

  return (
    <AuthCard
      icon={<KeyRound className="w-10 h-10 text-accent" />}
      title="Choose a new password"
      subtitle="After saving you'll be able to log in with the new password."
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!weak && !mismatch) mutation.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor="new-password" className={labelClass}>
            New password
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              className={`${inputClass} pr-10 ${touched && weak ? "border-red-400" : ""}`}
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
          <PasswordRequirements password={password} showErrors={touched} />
        </div>
        <div>
          <label htmlFor="confirm-password" className={labelClass}>
            Repeat password
          </label>
          <input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`${inputClass} ${touched && mismatch ? "border-red-400" : ""}`}
          />
          {touched && mismatch && <p className="text-xs text-red-700 mt-1">Passwords don't match</p>}
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-2 w-full bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm py-3 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthCard>
  );
}
