import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { login, register as registerUser } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import { getErrorMessage, isBlockedError, type ApiError } from "../api/client";
import { inputClass, labelClass } from "../components/formStyles";

type Mode = "login" | "register";

interface AuthForm {
  email: string;
  password: string;
  full_name?: string;
}

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-700 mt-1">{message}</p>;
}

export function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: Mode = searchParams.get("mode") === "register" ? "register" : "login";
  const [showPassword, setShowPassword] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const accessToken = useAuthStore((s) => s.accessToken);
  const setToken = useAuthStore((s) => s.setToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    clearErrors,
    formState: { errors },
  } = useForm<AuthForm>();

  async function signIn(email: string, password: string) {
    const token = await login(email, password);
    setToken(token.access_token);
    queryClient.invalidateQueries();
    navigate("/browse");
  }

  const loginMutation = useMutation({
    mutationFn: (data: AuthForm) => signIn(data.email, data.password),
    onError: (err: ApiError) => {
      if (isBlockedError(err)) setBlockedMessage(getErrorMessage(err));
      else toast.error(getErrorMessage(err));
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: AuthForm) => {
      await registerUser(data.email, data.password, data.full_name);
      await signIn(data.email, data.password);
    },
    onSuccess: () => toast.success("Account created. Welcome!"),
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
  });

  if (accessToken) return <Navigate to="/browse" replace />;

  const isRegister = mode === "register";
  const isPending = loginMutation.isPending || registerMutation.isPending;

  function switchMode(next: Mode) {
    clearErrors();
    setBlockedMessage(null);
    setSearchParams(next === "register" ? { mode: "register" } : {}, { replace: true });
  }

  const tabClass = (active: boolean) =>
    `flex-1 pb-3 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${
      active ? "text-accent border-accent" : "text-gray-400 border-transparent hover:text-gray-700"
    }`;

  return (
    <div className="flex justify-center pt-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-md p-8">
        <div className="flex mb-6 border-b border-gray-200">
          <button type="button" onClick={() => switchMode("login")} className={tabClass(!isRegister)}>
            Log in
          </button>
          <button type="button" onClick={() => switchMode("register")} className={tabClass(isRegister)}>
            Register
          </button>
        </div>

        <h1 className="text-xl font-bold mb-1">{isRegister ? "Create an account" : "Welcome back"}</h1>
        <p className="text-sm text-gray-500 mb-6">
          {isRegister
            ? "Register to buy and collect coins."
            : "Log in to your account to continue."}
        </p>

        <form
          noValidate
          onSubmit={handleSubmit((data) => {
            setBlockedMessage(null);
            if (isRegister) registerMutation.mutate(data);
            else loginMutation.mutate(data);
          })}
          className="flex flex-col gap-4"
        >
          {blockedMessage && (
            <div role="alert" className="flex gap-3 border border-red-200 bg-red-50 rounded-sm p-3">
              <Lock className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-red-800">Account blocked</div>
                <div className="text-sm text-red-700">{blockedMessage}</div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className={labelClass}>
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email", {
                required: "Email is required",
                pattern: { value: EMAIL_PATTERN, message: "Enter a valid email" },
              })}
              className={`${inputClass} ${errors.email ? "border-red-400" : ""}`}
            />
            <FieldError message={errors.email?.message} />
          </div>

          {isRegister && (
            <div>
              <label htmlFor="auth-full-name" className={labelClass}>
                Full name <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="auth-full-name"
                autoComplete="name"
                placeholder="John Smith"
                {...register("full_name")}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-password" className={labelClass}>
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder={isRegister ? `At least ${MIN_PASSWORD_LENGTH} characters` : "Your password"}
                {...register("password", {
                  required: "Password is required",
                  validate: (value) =>
                    !isRegister ||
                    value.length >= MIN_PASSWORD_LENGTH ||
                    `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
                })}
                className={`${inputClass} pr-10 ${errors.password ? "border-red-400" : ""}`}
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
            <FieldError message={errors.password?.message} />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 w-full bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm py-3 disabled:opacity-50"
          >
            {isPending
              ? isRegister
                ? "Creating account..."
                : "Logging in..."
              : isRegister
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => switchMode(isRegister ? "login" : "register")}
            className="font-semibold text-accent hover:underline"
          >
            {isRegister ? "Log in" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}
