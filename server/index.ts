import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  openStore,
  passwordHash,
  verifyPassword,
  hashToken,
  type Store,
} from "./store";
import { weeks, emptyWeek } from "../src/curriculum";
import {
  makeCase,
  advanceCase,
  publicCase,
  type CaseState,
} from "../src/cases";
import { pickQuestions, exposeQuestions, grade, bank } from "../src/questions";
export function createApp(store: Store, origin: string) {
  const buckets = new Map<string, { count: number; until: number }>();
  function limit(key: string, max: number, window = 300000) {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
    if (buckets.size > 10000 && !buckets.has(key))
      throw Object.assign(new Error("الخدمة مشغولة، أعد المحاولة لاحقًا."), {
        status: 429,
      });
    const b = buckets.get(key) || { count: 0, until: now + window };
    b.count++;
    buckets.set(key, b);
    if (b.count > max)
      throw Object.assign(
        new Error("محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة."),
        { status: 429 },
      );
  }
  async function body(req: IncomingMessage) {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      throw Object.assign(new Error("يلزم إرسال JSON."), { status: 415 });
    let s = "";
    for await (const chunk of req) {
      s += chunk;
      if (Buffer.byteLength(s) > 32768)
        throw Object.assign(new Error("الطلب كبير جدًا."), { status: 413 });
    }
    try {
      return JSON.parse(s);
    } catch {
      throw Object.assign(new Error("طلب غير صالح."), { status: 400 });
    }
  }
  function fail(message: string, status = 400): never {
    throw Object.assign(new Error(message), { status });
  }
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, data: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(data));
    };
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (req.headers.origin === origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    try {
      if (req.headers.origin && req.headers.origin !== origin)
        fail("مصدر الطلب غير مسموح.", 403);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      const url = new URL(req.url || "/", "http://localhost");
      const path = url.pathname;
      if (path === "/api/health" && req.method === "GET") {
        reply(200, { ok: true, storage: "sqlite", version: 1 });
        return;
      }
      if (req.method === "POST" && req.headers.origin !== origin)
        fail("مصدر الطلب مطلوب.", 403);
      if (path === "/api/login" && req.method === "POST") {
        const b = await body(req);
        const num = String(b.trainingNumber || "").trim();
        const pwd = String(b.password || "");
        limit(`ip:${req.socket.remoteAddress}`, 20, 900000);
        limit(`account:${num.slice(0, 30)}`, 8, 900000);
        if (!/^\d{4,14}$/.test(num) || pwd.length > 128)
          fail("الرقم التدريبي أو كلمة المرور غير صحيحة.", 401);
        const user = store.db
          .prepare("SELECT * FROM users WHERE training_number=?")
          .get(num) as any;
        const valid = await verifyPassword(
          pwd,
          user?.salt || "00000000000000000000000000000000",
          user?.password_hash || "0".repeat(128),
        );
        if (!user || !valid)
          fail("الرقم التدريبي أو كلمة المرور غير صحيحة.", 401);
        const token = randomBytes(32).toString("hex");
        store.db
          .prepare("DELETE FROM sessions WHERE expires<?")
          .run(Date.now());
        store.db
          .prepare("INSERT INTO sessions VALUES(?,?,?)")
          .run(hashToken(token), user.id, Date.now() + 8 * 3600000);
        reply(200, {
          token,
          user: {
            name: user.name,
            trainingNumber: user.training_number,
            role: user.role,
          },
          progress: store.getProgress(user.id),
        });
        return;
      }
      const token = req.headers.authorization?.match(
        /^Bearer ([a-f0-9]{64})$/,
      )?.[1];
      const user = token
        ? (store.db
            .prepare(
              "SELECT users.* FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.token_hash=? AND sessions.expires>?",
            )
            .get(hashToken(token), Date.now()) as any)
        : null;
      if (!user) fail("سجّل الدخول للمتابعة.", 401);
      limit(`user:${user.id}`, 180, 60000);
      if (path === "/api/logout" && req.method === "POST") {
        store.db
          .prepare("DELETE FROM sessions WHERE token_hash=?")
          .run(hashToken(token!));
        reply(200, { ok: true });
        return;
      }
      if (path === "/api/me" && req.method === "GET") {
        reply(200, {
          user: {
            name: user.name,
            trainingNumber: user.training_number,
            role: user.role,
          },
          progress: store.getProgress(user.id),
        });
        return;
      }
      if (path === "/api/trainer" && req.method === "GET") {
        if (user.role !== "trainer") fail("هذه الصفحة للمدرب.", 403);
        const users = store.db
          .prepare(
            "SELECT id,name,training_number FROM users WHERE role='trainee' ORDER BY training_number",
          )
          .all() as any[];
        reply(200, {
          trainees: users.map((u) => ({
            name: u.name,
            trainingNumber: u.training_number,
            progress: store.getProgress(u.id),
          })),
        });
        return;
      }
      const b = req.method === "POST" ? await body(req) : {};
      const week = Number(b.week);
      const w = weeks.find((w) => w.id === week);
      if (
        [
          "/api/train",
          "/api/cases/start",
          "/api/quiz/start",
          "/api/report",
          "/api/assembly",
        ].includes(path) &&
        !w
      )
        fail("أسبوع غير صالح.");
      const p = () => store.getProgress(user.id)[week] || emptyWeek();
      if (path === "/api/train" && req.method === "POST") {
        reply(200, {
          progress: store.update(user.id, week, { trained: true }, "train"),
        });
        return;
      }
      if (path === "/api/report" && req.method === "POST") {
        if (week < 16) fail("التقرير متاح في أسابيع الورشة.");
        const fields = ["symptom", "cause", "action", "verification"];
        if (
          fields.some(
            (k) =>
              typeof b.report?.[k] !== "string" ||
              b.report[k].trim().length < 8 ||
              b.report[k].length > 1000,
          )
        )
          fail("أكمل الحقول الأربعة بتفصيل مناسب.");
        const report = JSON.stringify(
          Object.fromEntries(fields.map((k) => [k, b.report[k].trim()])),
        );
        reply(200, {
          progress: store.update(user.id, week, { report }, "report"),
        });
        return;
      }
      if (path === "/api/assembly" && req.method === "POST") {
        if (
          week !== 4 ||
          JSON.stringify(b.parts) !==
            JSON.stringify(["psu", "motherboard", "cpu", "ram", "gpu"])
        )
          fail("أكمل تسلسل التجميع.");
        reply(200, {
          progress: store.update(
            user.id,
            4,
            { assembly: true },
            "assembly-practice",
          ),
        });
        return;
      }
      if (path === "/api/cases/start" && req.method === "POST") {
        if (!p().trained) fail("أكمل التدريب أولًا.");
        if (!["discover", "apply"].includes(b.stage)) fail("مرحلة غير صالحة.");
        if (b.stage === "apply" && !p().discovered)
          fail("أكمل الاكتشاف أولًا.");
        const state = makeCase(week, b.stage);
        store.db
          .prepare(
            "INSERT INTO attempts(id,user_id,week,type,payload,created) VALUES(?,?,?,?,?,?)",
          )
          .run(
            state.id,
            user.id,
            week,
            "case",
            JSON.stringify(state),
            Date.now(),
          );
        reply(200, { state: publicCase(state) });
        return;
      }
      if (path === "/api/cases/action" && req.method === "POST") {
        const a = store.db
          .prepare(
            "SELECT * FROM attempts WHERE id=? AND user_id=? AND type='case'",
          )
          .get(String(b.id), user.id) as any;
        if (!a) fail("المحاولة غير موجودة.", 404);
        if (a.finished) fail("انتهت المحاولة.");
        if (Date.now() - a.created > 7200000)
          fail("انتهى وقت المحاولة. ابدأ حالة جديدة.");
        const next = advanceCase(
          JSON.parse(a.payload) as CaseState,
          String(b.action),
        );
        store.db
          .prepare(
            "UPDATE attempts SET payload=?,finished=?,score=? WHERE id=?",
          )
          .run(
            JSON.stringify(next),
            Number(next.complete),
            next.complete ? Math.max(0, 100 - next.mistakes * 20) : null,
            a.id,
          );
        let progress = store.getProgress(user.id);
        if (next.complete && next.passed)
          progress = store.update(
            user.id,
            a.week,
            { [next.stage === "discover" ? "discovered" : "applied"]: true },
            next.stage,
          );
        reply(200, { state: publicCase(next), progress });
        return;
      }
      if (path === "/api/quiz/start" && req.method === "POST") {
        if (!p().applied) fail("أكمل التطبيق أولًا.");
        const qs = pickQuestions(w!.lab);
        const id = randomUUID();
        store.db
          .prepare(
            "INSERT INTO attempts(id,user_id,week,type,payload,created) VALUES(?,?,?,?,?,?)",
          )
          .run(
            id,
            user.id,
            week,
            "quiz",
            JSON.stringify(qs.map((q) => q.id)),
            Date.now(),
          );
        reply(200, { id, questions: exposeQuestions(qs) });
        return;
      }
      if (path === "/api/quiz/submit" && req.method === "POST") {
        const a = store.db
          .prepare(
            "SELECT * FROM attempts WHERE id=? AND user_id=? AND type='quiz'",
          )
          .get(String(b.id), user.id) as any;
        if (!a) fail("الاختبار غير موجود.", 404);
        if (a.finished) fail("تم تسليم الاختبار مسبقًا.");
        if (Date.now() - a.created > 3600000)
          fail("انتهى وقت الاختبار. ابدأ محاولة جديدة.");
        const ids = JSON.parse(a.payload) as string[];
        const qs = ids.map((id) => bank.find((q) => q.id === id)!);
        if (
          !b.answers ||
          qs.some(
            (q) =>
              !Array.isArray(b.answers[q.id]) ||
              b.answers[q.id].length !== q.answer.length ||
              new Set(b.answers[q.id]).size !== q.answer.length ||
              b.answers[q.id].some(
                (v: unknown) => !q.options.some((o) => o.id === v),
              ),
          )
        )
          fail("أكمل جميع الإجابات دون تكرار.");
        const result = grade(qs, b.answers);
        store.db
          .prepare("UPDATE attempts SET finished=1,score=? WHERE id=?")
          .run(result.score, a.id);
        const old = store.getProgress(user.id)[a.week] || emptyWeek();
        const progress = store.update(
          user.id,
          a.week,
          { quizScore: Math.max(old.quizScore, result.score) },
          "quiz",
        );
        reply(200, { ...result, progress });
        return;
      }
      fail("المسار غير موجود.", 404);
    } catch (error) {
      const e = error as Error & { status?: number };
      reply(e.status || 400, {
        error:
          e.status ||
          e.message.startsWith("انتهت") ||
          e.message.startsWith("إجراء")
            ? e.message
            : "تعذر تنفيذ الطلب. تحقق من المدخلات وأعد المحاولة.",
      });
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const origin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://"))
    throw new Error("FRONTEND_ORIGIN must use HTTPS in production");
  const store = openStore(process.env.DATA_DIR || "./data");
  const server = createApp(store, origin);
  const port = Number(process.env.PORT || 3001);
  server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(`Maintenance API listening on port ${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () =>
      server.close(() => {
        store.db.close();
        process.exit(0);
      }),
    );
}
