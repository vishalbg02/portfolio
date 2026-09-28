/**
 * Tiny toast API. Dispatches a window event handled by <ToastHost />, which lazy-loads
 * the toaster on first use so it never weighs on the initial bundle.
 */
export const TOAST_EVENT = "app:toast";

export type ToastRequest = { kind: "success" | "error" | "info"; message: string };

function emit(kind: ToastRequest["kind"], message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastRequest>(TOAST_EVENT, { detail: { kind, message } }));
}

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
};
