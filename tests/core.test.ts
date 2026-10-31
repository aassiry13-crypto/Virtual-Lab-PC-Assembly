import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { weeks, emptyWeek, mastery } from "../src/curriculum";
import { makeCase, advanceCase, publicCase } from "../src/cases";
import { bank, pickQuestions, exposeQuestions, grade } from "../src/questions";
import { openStore, passwordHash } from "../server/store";
import { createApp } from "../server/index";
test("19 weekly cases require evidence, repair and verification; critical choices prevent mastery", () => {
  assert.equal(weeks.length, 19);
  assert.equal(new Set(weeks.map((w) => w.id)).size, 19);
  for (const w of weeks) {
    let s = makeCase(w.id, "apply");
    s = advanceCase(s, "repair");
    assert.equal(s.complete, false);
    assert.equal(s.done.length, 0);
    assert.equal(s.mistakes, 1);
    for (const id of ["inspect-a", "inspect-b", "diagnose", "repair", "verify"])
      s = advanceCase(s, id);
    assert.equal(s.passed, true);
    assert.equal(s.complete, true);
    assert.throws(() => advanceCase(s, "verify"));
    let unsafe = advanceCase(makeCase(w.id, "apply"), "unsafe");
    for (const id of ["inspect-a", "inspect-b", "diagnose", "repair", "verify"])
      unsafe = advanceCase(unsafe, id);
    assert.equal(unsafe.passed, false);
    assert.equal(unsafe.critical, true);
    const publicState = publicCase(makeCase(w.id, "discover"));
    assert(!publicState.definition.actions.some((a) => a.id === "repair"));
    assert(!("result" in publicState.definition.actions[0]));
  }
});
test("mastery depends on all required evidence including assembly and workshop report", () => {
  const p = {
    ...emptyWeek(),
    trained: true,
    discovered: true,
    applied: true,
    quizScore: 80,
  };
  assert(mastery(p, 1));
  assert(!mastery({ ...p, quizScore: 79 }, 1));
  assert(!mastery(p, 4));
  assert(mastery({ ...p, assembly: true }, 4));
  assert(!mastery(p, 16));
  assert(mastery({ ...p, report: "عرض وسبب وإجراء وتحقق" }, 16));
});
test("question pools are mixed and shuffled without public answer keys", () => {
  assert.equal(bank.length, 40);
  assert.equal(new Set(bank.map((q) => q.id)).size, 40);
  for (let lab = 1; lab <= 5; lab++) {
    const qs = pickQuestions(lab);
    assert.equal(qs.length, 5);
    assert.equal(new Set(qs.map((q) => q.kind)).size, 3);
    const publicQs = exposeQuestions(qs);
    for (const q of publicQs) {
      assert(!("answer" in q));
      assert(!("explanation" in q));
      assert.equal(
        new Set(q.options.map((o) => o.text)).size,
        q.options.length,
      );
    }
    assert.equal(
      grade(qs, Object.fromEntries(qs.map((q) => [q.id, q.answer]))).score,
      100,
    );
    assert.equal(grade(qs, {}).score, 0);
  }
  const variations = new Set(
    Array.from({ length: 20 }, () =>
      JSON.stringify(exposeQuestions(pickQuestions(1))),
    ),
  );
  assert(variations.size > 1);
});
test("API persists isolated accounts, grades on server, denies replay and survives restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pc-lab-test-"));
  let store = openStore(dir);
  let server = createApp(store, "http://localhost:3000");
  const listen = async () => {
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    return `http://127.0.0.1:${(server.address() as any).port}`;
  };
  let base = await listen();
  const call = async (
    path: string,
    data?: unknown,
    token?: string,
    origin = "http://localhost:3000",
  ) => {
    const r = await fetch(base + "/api" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Origin: origin,
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: r.status, data: (await r.json()) as any };
  };
  try {
    const hashed = await passwordHash("synthetic-test-password");
    for (const [number, name] of [
      ["10001", "متدرب تجريبي أول"],
      ["10002", "متدرب تجريبي ثان"],
    ])
      store.db
        .prepare(
          "INSERT INTO users(training_number,name,salt,password_hash) VALUES(?,?,?,?)",
        )
        .run(number, name, hashed.salt, hashed.hash);
    assert.equal((await call("/me")).status, 401);
    assert.equal(
      (await call("/login", { trainingNumber: "10001", password: "wrong" }))
        .status,
      401,
    );
    const a = await call("/login", {
      trainingNumber: "10001",
      password: "synthetic-test-password",
    });
    const b = await call("/login", {
      trainingNumber: "10002",
      password: "synthetic-test-password",
    });
    const ta = a.data.token,
      tb = b.data.token;
    assert.equal(a.status, 200);
    assert(!("password_hash" in a.data.user));
    assert.equal(
      (await call("/train", { week: 1 }, ta, "https://evil.example")).status,
      403,
    );
    assert.equal((await call("/trainer", undefined, ta)).status, 403);
    assert.equal((await call("/quiz/start", { week: 1 }, ta)).status, 400);
    let trained = await call(
      "/train",
      { week: 1, quizScore: 100, mastered: true },
      ta,
    );
    assert.equal(trained.data.progress["1"].mastered, false);
    assert.equal(trained.data.progress["1"].quizScore, 0);
    for (const stage of ["discover", "apply"]) {
      const started = await call("/cases/start", { week: 1, stage }, ta);
      assert.equal(started.status, 200);
      const id = started.data.state.id;
      assert.equal(
        (await call("/cases/action", { id, action: "inspect-a" }, tb)).status,
        404,
      );
      for (const action of stage === "discover"
        ? ["inspect-a", "inspect-b", "diagnose"]
        : ["inspect-a", "inspect-b", "diagnose", "repair", "verify"]) {
        const r = await call("/cases/action", { id, action }, ta);
        assert.equal(r.status, 200);
      }
      assert.equal(
        (await call("/cases/action", { id, action: "verify" }, ta)).status,
        400,
      );
    }
    const quiz = await call("/quiz/start", { week: 1 }, ta);
    assert.equal(quiz.status, 200);
    assert(!("answer" in quiz.data.questions[0]));
    assert.equal(
      (await call("/quiz/submit", { id: quiz.data.id, answers: {} }, ta))
        .status,
      400,
    );
    const answers = Object.fromEntries(
      quiz.data.questions.map((q: any) => [
        q.id,
        bank.find((item) => item.id === q.id)!.answer,
      ]),
    );
    const grade = await call(
      "/quiz/submit",
      { id: quiz.data.id, answers, score: 0 },
      ta,
    );
    assert.equal(grade.data.score, 100);
    assert.equal(grade.data.progress["1"].mastered, true);
    assert.equal(
      (await call("/quiz/submit", { id: quiz.data.id, answers }, ta)).status,
      400,
    );
    assert.deepEqual((await call("/me", undefined, tb)).data.progress, {});
    const report = {
      symptom: "عرض صناعي قابل للتكرار",
      cause: "دليل صناعي يحدد السبب",
      action: "إجراء صناعي محدد وآمن",
      verification: "نتيجة صناعية مع توصية وقائية",
    };
    assert.equal((await call("/report", { week: 16, report }, ta)).status, 200);
    await new Promise<void>((r) => server.close(() => r()));
    store.db.close();
    store = openStore(dir);
    server = createApp(store, "http://localhost:3000");
    base = await listen();
    assert.equal(
      (await call("/me", undefined, ta)).data.progress["1"].mastered,
      true,
    );
    assert.deepEqual(
      JSON.parse((await call("/me", undefined, ta)).data.progress["16"].report),
      report,
    );
    assert.equal((await call("/logout", {}, ta)).status, 200);
    assert.equal((await call("/me", undefined, ta)).status, 401);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("login attempts are bounded and errors do not disclose account existence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pc-rate-test-"));
  const store = openStore(dir);
  const server = createApp(store, "http://localhost:3000");
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/login`;
  try {
    for (let i = 0; i < 8; i++) {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trainingNumber: "99999",
          password: "synthetic-wrong",
        }),
      });
      assert.equal(r.status, 401);
      assert.match((await r.json()).error, /الرقم التدريبي أو كلمة المرور/);
    }
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: {
            Origin: "http://localhost:3000",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trainingNumber: "99999",
            password: "synthetic-wrong",
          }),
        })
      ).status,
      429,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
