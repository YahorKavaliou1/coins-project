import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login, register as registerUser } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { useState } from "react";

interface RegisterForm {
  email: string;
  password: string;
  full_name?: string;
}

interface LoginForm {
  email: string;
  password: string;
}

export function AuthPage() {
  const [log, setLog] = useState<string[]>([]);
  const setToken = useAuthStore((s) => s.setToken);
  const queryClient = useQueryClient();

  const registerForm = useForm<RegisterForm>();
  const loginForm = useForm<LoginForm>();

  const registerMutation = useMutation({
    mutationFn: (data: RegisterForm) => registerUser(data.email, data.password, data.full_name),
    onSuccess: (data) => {
      setLog((l) => [...l, JSON.stringify({ registered: data })]);
      registerForm.reset();
    },
    onError: (err: any) => {
      setLog((l) => [...l, JSON.stringify({ error: err.response?.data })]);
    },
  });

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) => login(data.email, data.password),
    onSuccess: (data) => {
      setToken(data.access_token);
      queryClient.invalidateQueries();
      setLog((l) => [...l, JSON.stringify({ logged_in: true })]);
      loginForm.reset();
    },
    onError: (err: any) => {
      setLog((l) => [...l, JSON.stringify({ error: err.response?.data })]);
    },
  });

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <form
          onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))}
          className="bg-white p-4 rounded-lg shadow flex flex-col gap-2"
        >
          <h2 className="font-semibold">Register</h2>
          <input {...registerForm.register("email", { required: true })} placeholder="Email" className="border rounded p-2" />
          <input {...registerForm.register("password", { required: true })} type="password" placeholder="Password" className="border rounded p-2" />
          <input {...registerForm.register("full_name")} placeholder="Full name (optional)" className="border rounded p-2" />
          <button type="submit" className="bg-brand text-white rounded p-2">Register</button>
        </form>

        <form
          onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))}
          className="bg-white p-4 rounded-lg shadow flex flex-col gap-2"
        >
          <h2 className="font-semibold">Log in</h2>
          <input {...loginForm.register("email", { required: true })} placeholder="Email" className="border rounded p-2" />
          <input {...loginForm.register("password", { required: true })} type="password" placeholder="Password" className="border rounded p-2" />
          <button type="submit" className="bg-brand text-white rounded p-2">Log in</button>
        </form>
      </div>

      <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded mt-4 max-h-40 overflow-y-auto whitespace-pre-wrap">
        {log.join("\n")}
      </pre>
    </div>
  );
}
