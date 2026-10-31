import type { Progress } from "./curriculum";
import type { publicCase } from "./cases";
import type { PublicQuestion, grade } from "./questions";
export type PublicCaseState = ReturnType<typeof publicCase>;
export type QuizResult = ReturnType<typeof grade>;
export interface User {
  name: string;
  trainingNumber: string;
  role: "trainee" | "trainer";
}
const root = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const apiConfigured = import.meta.env.DEV || !!root;
let token: string | null = null;
export async function request<T>(path: string, data?: unknown): Promise<T> {
  if (!apiConfigured)
    throw new Error(
      "لم يُربط خادم الحسابات بعد. استخدم التجربة المحلية حاليًا.",
    );
  const response = await fetch(`${root}/api${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(15000),
  }).catch(() => {
    throw new Error(
      "تعذر الاتصال بالخادم. لم تُحفظ العملية مركزيًا؛ أعد المحاولة عند عودة الاتصال.",
    );
  });
  const result = await response.json().catch(() => {
    throw new Error(
      "خادم الحسابات غير مهيأ لهذا العنوان. يمكنك استخدام التجربة المحلية.",
    );
  });
  if (!response.ok) throw new Error(result.error || "تعذر تنفيذ الطلب.");
  return result as T;
}
export const api = {
  async login(trainingNumber: string, password: string) {
    const r = await request<{ token: string; user: User; progress: Progress }>(
      "/login",
      { trainingNumber, password },
    );
    token = r.token;
    return r;
  },
  async logout() {
    await request("/logout", {});
    token = null;
  },
  train: (week: number) => request<{ progress: Progress }>("/train", { week }),
  startCase: (week: number, stage: "discover" | "apply") =>
    request<{ state: PublicCaseState }>("/cases/start", { week, stage }),
  action: (id: string, action: string) =>
    request<{ state: PublicCaseState; progress: Progress }>("/cases/action", {
      id,
      action,
    }),
  startQuiz: (week: number) =>
    request<{ id: string; questions: PublicQuestion[] }>("/quiz/start", {
      week,
    }),
  submitQuiz: (id: string, answers: Record<string, string[]>) =>
    request<QuizResult & { progress: Progress }>("/quiz/submit", {
      id,
      answers,
    }),
  assembly: () =>
    request<{ progress: Progress }>("/assembly", {
      week: 4,
      parts: ["psu", "motherboard", "cpu", "ram", "gpu"],
    }),
  report: (week: number, report: Record<string, string>) =>
    request<{ progress: Progress }>("/report", { week, report }),
  trainer: () =>
    request<{
      trainees: { name: string; trainingNumber: string; progress: Progress }[];
    }>("/trainer"),
};
