import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { resendVerification } from "../../api/auth";
import { getErrorMessage, type ApiError } from "../../api/client";
import { toast } from "../../store/toastStore";
import { Captcha, captchaEnabled } from "../Captcha";

/** Matches the backend limit of one confirmation email per minute. */
const COOLDOWN_SECONDS = 60;

interface ResendVerificationButtonProps {
  email: string;
  /** True when an email was just sent (e.g. right after registration). */
  justSent?: boolean;
  className?: string;
}

/**
 * A text button that sits inside a sentence. With CAPTCHA on, a click first shows the
 * security check below it and sends the email as soon as the check passes.
 */
export function ResendVerificationButton({ email, justSent = false, className = "" }: ResendVerificationButtonProps) {
  const [secondsLeft, setSecondsLeft] = useState(justSent ? COOLDOWN_SECONDS : 0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const mutation = useMutation({
    mutationFn: (captchaToken: string | null) => resendVerification(email, captchaToken),
    onSuccess: () => {
      toast.success(`If ${email} still needs confirming, a new link is on its way.`);
      setSecondsLeft(COOLDOWN_SECONDS);
    },
    onError: (err: ApiError) => toast.error(getErrorMessage(err)),
    onSettled: () => setChecking(false),
  });

  function start() {
    if (captchaEnabled) setChecking(true);
    else mutation.mutate(null);
  }

  const disabled = mutation.isPending || checking || secondsLeft > 0;
  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        className={`font-semibold text-accent hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed ${className}`}
      >
        {secondsLeft > 0 ? `Resend link (${secondsLeft}s)` : "Resend link"}
      </button>
      {checking && (
        <Captcha
          action="resend_verification"
          className="mt-3"
          onToken={(token) => {
            if (token && !mutation.isPending) mutation.mutate(token);
          }}
        />
      )}
    </>
  );
}
