import {
  useState,
  useEffect,
  useRef,
  lazy,
  Suspense,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  LayoutDashboard,
  FlaskConical,
  Route,
  ChartNoAxesCombined,
  Images,
  GraduationCap,
  Search,
  ChevronLeft,
  ArrowUpLeft,
  ArrowLeft,
  Check,
  Lock,
  Play,
  Monitor,
  Cpu,
  MemoryStick,
  Power,
  Wrench,
  BookOpen,
  LogIn,
  LogOut,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Download,
  ZoomIn,
  Cloud,
  HardDrive,
  Menu,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import {
  labs,
  weeks,
  phases,
  emptyWeek,
  mastery,
  type Progress,
  type Week,
  type Phase,
  type WeekProgress,
} from "./curriculum";
import {
  api,
  request,
  type User,
  type PublicCaseState,
  type QuizResult,
} from "./api";
import type { CaseState } from "./cases";
import type { Question, PublicQuestion } from "./questions";
const AssemblyLab = lazy(() => import("./AssemblyLab"));
const image = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;
const icons = [Cpu, Power, MemoryStick, Monitor, Wrench];
const ar = (n: number) => n.toLocaleString("ar-SA");
function readGuest(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem("itqan-pc-guest-v1") || "{}");
    const p: Progress = {};
    for (const w of weeks) {
      const r = raw[w.id];
      if (r && typeof r === "object") {
        p[w.id] = {
          trained: r.trained === true,
          discovered: r.discovered === true,
          applied: r.applied === true,
          quizScore:
            typeof r.quizScore === "number" && Number.isFinite(r.quizScore)
              ? Math.min(100, Math.max(0, r.quizScore))
              : 0,
          mastered: false,
          assembly: r.assembly === true,
          report:
            typeof r.report === "string" ? r.report.slice(0, 4000) : undefined,
        };
        p[w.id].mastered = mastery(p[w.id], w.id);
      }
    }
    return p;
  } catch {
    return {};
  }
}
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const focusable = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,textarea,select,[tabindex="0"]',
          ) || [],
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (!focusable.length) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      old?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <IconButton label="إغلاق" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
export default function App() {
  const [view, setView] = useState("dashboard");
  const [labFilter, setLabFilter] = useState<number | null>(null);
  const [week, setWeek] = useState<Week | null>(null);
  const [phase, setPhase] = useState<Phase>("train");
  const [guest, setGuest] = useState<Progress>(readGuest);
  const [central, setCentral] = useState<Progress>({});
  const [user, setUser] = useState<User | null>(null);
  const [login, setLogin] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [assembly, setAssembly] = useState(false);
  const [search, setSearch] = useState("");
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [healthy, setHealthy] = useState(false);
  const progress = user ? central : guest;
  const completed = weeks.filter((w) => progress[w.id]?.mastered).length;
  const percent = Math.round((completed / 19) * 100);
  const next = weeks.find((w) => !progress[w.id]?.mastered) || weeks[18];
  useEffect(() => {
    try {
      localStorage.setItem("itqan-pc-guest-v1", JSON.stringify(guest));
    } catch {
      setNotice("التخزين المحلي غير متاح في هذا المتصفح؛ تقدم التجربة مؤقت.");
    }
  }, [guest]);
  useEffect(() => {
    request("/health")
      .then(() => setHealthy(true))
      .catch(() => setHealthy(false));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  const notify = (s: string) => setNotice(s);
  function patch(id: number, value: Partial<WeekProgress>) {
    setGuest((old) => {
      const p = { ...(old[id] || emptyWeek()), ...value };
      p.mastered = mastery(p, id);
      return { ...old, [id]: p };
    });
  }
  async function save(action: () => Promise<{ progress: Progress }>) {
    setSaving(true);
    try {
      const r = await action();
      setCentral(r.progress);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  function openWeek(w: Week) {
    setWeek(w);
    const p = progress[w.id] || emptyWeek();
    setPhase(
      !p.trained
        ? "train"
        : !p.discovered
          ? "discover"
          : !p.applied
            ? "apply"
            : p.quizScore < 80
              ? "test"
              : "master",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function navigate(v: string) {
    setView(v);
    setWeek(null);
    setLabFilter(null);
    setSearch("");
    setMobile(false);
  }
  async function training() {
    if (!week) return;
    if (user) {
      if (!(await save(() => api.train(week.id)))) return;
    } else patch(week.id, { trained: true });
    setPhase("discover");
  }
  function exportProgress() {
    const rows = [
      ["الأسبوع", "الموضوع", "تدرّب", "اكتشف", "طبّق", "أفضل اختبار", "أتقن"],
      ...weeks.map((w) => {
        const p = progress[w.id] || emptyWeek();
        return [
          w.id,
          w.title,
          p.trained ? "نعم" : "لا",
          p.discovered ? "نعم" : "لا",
          p.applied ? "نعم" : "لا",
          p.quizScore,
          p.mastered ? "نعم" : "لا",
        ];
      }),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) =>
          r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "تقدم-صيانة-الحاسب.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const active = week ? progress[week.id] || emptyWeek() : emptyWeek();
  const title = week
    ? week.title
    : {
        dashboard: "مساحتك للتعلّم",
        labs: "المختبرات التعليمية",
        path: "مسارك في ١٩ أسبوعًا",
        results: "نتائجك ومهاراتك",
        library: "المكتبة البصرية",
        trainer: "متابعة المتدربين",
      }[view] || "مساحتك للتعلّم";
  const filteredWeeks = weeks.filter(
    (w) =>
      (!labFilter || w.lab === labFilter) &&
      (!search ||
        `${w.title} ${w.objective} ${w.id} ${labs[w.lab - 1].title}`.includes(
          search,
        )),
  );
  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
        aria-label="القائمة الرئيسية"
      >
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-mark">
            <Cpu size={26} />
          </span>
          <span>
            <strong>
              إتقان<span className="brand-dot">.</span>
            </strong>
            <small>مختبرات صيانة الحاسب</small>
          </span>
        </a>
        <div className="sidebar-label">بيئة التعلّم</div>
        <nav>
          {[
            { id: "dashboard", label: "لوحة التعلّم", icon: LayoutDashboard },
            { id: "labs", label: "المختبرات", icon: FlaskConical },
            { id: "path", label: "المسار الأسبوعي", icon: Route },
            {
              id: "results",
              label: "نتائجي ومهاراتي",
              icon: ChartNoAxesCombined,
            },
            { id: "library", label: "المكتبة البصرية", icon: Images },
            ...(user?.role === "trainer"
              ? [
                  {
                    id: "trainer",
                    label: "متابعة المتدربين",
                    icon: GraduationCap,
                  },
                ]
              : []),
          ].map((n) => (
            <button
              key={n.id}
              className={view === n.id && !week ? "active" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "labs" && <small>٥</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-course">
          <div className="course-symbol">
            <GraduationCap size={24} />
          </div>
          <strong>مهارة اليوم، مهنة الغد</strong>
          <p>تعلّم بالتجربة، واكتشف الحل بنفسك.</p>
          <button onClick={() => navigate("path")}>
            استكشف مسارك <ArrowUpLeft size={16} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className={`status-dot ${user ? "online" : ""}`} />
          <span>{user ? "حساب متصل بالخادم" : "وضع التجربة المحلية"}</span>
          <small>الإصدار ١.٠</small>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="إغلاق القائمة"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton label="فتح القائمة" onClick={() => setMobile(!mobile)}>
              <Menu size={21} />
            </IconButton>
            <span>المنظومة المهنية التفاعلية</span>
            <ChevronLeft size={14} />
            <strong>{week ? "المختبر " + ar(week.lab) : "صيانة الحاسب"}</strong>
          </div>
          <div className="top-actions">
            <label className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setWeek(null);
                  setView("path");
                }}
                placeholder="ابحث عن مهارة أو أسبوع…"
                aria-label="البحث في المسار"
              />
              {search && (
                <button aria-label="مسح البحث" onClick={() => setSearch("")}>
                  <X size={14} />
                </button>
              )}
            </label>
            <button
              className="profile"
              onClick={() => (user ? navigate("results") : setLogin(true))}
            >
              <span className="avatar">
                {user ? user.name.slice(0, 1) : "م"}
              </span>
              <span>
                <strong>{user ? user.name : "مرحبًا، متدرّب"}</strong>
                <small>
                  {user ? "رقم " + user.trainingNumber : "استكشف ثم سجّل دخولك"}
                </small>
              </span>
            </button>
            {user && (
              <IconButton
                label="تسجيل الخروج"
                onClick={async () => {
                  if (
                    await (async () => {
                      try {
                        await api.logout();
                        return true;
                      } catch (e) {
                        notify((e as Error).message);
                        return false;
                      }
                    })()
                  ) {
                    setUser(null);
                    setCentral({});
                    setWeek(null);
                    navigate("dashboard");
                  }
                }}
              >
                <LogOut size={17} />
              </IconButton>
            )}
          </div>
        </header>
        <main id="main-content" className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">تعلّم عملي. أثر يدوم.</span>
              <h1>{title}</h1>
              <p>
                {week
                  ? `الأسبوع ${ar(week.id)} · ${labs[week.lab - 1].title}`
                  : "كل عطل فرصة لتفهم أكثر، وكل تجربة خطوة نحو الإتقان."}
              </p>
            </div>
            <div className="heading-meta">
              {week ? (
                <button
                  className="button subtle"
                  onClick={() => {
                    setWeek(null);
                    setView("path");
                  }}
                >
                  العودة إلى المسار <ArrowLeft size={16} />
                </button>
              ) : (
                <span>
                  <span className="tiny-dot" />
                  مسار تدريبي · ١٩ أسبوعًا
                </span>
              )}
            </div>
          </div>
          {!user && (
            <div className="demo-note">
              <HardDrive size={15} />
              <span>تجربة محلية: التقدم محفوظ في هذا المتصفح فقط.</span>
              <button onClick={() => setLogin(true)}>
                الدخول للحفظ المركزي <ArrowUpLeft size={14} />
              </button>
            </div>
          )}
          {user && (
            <div className="sync-note">
              <Cloud size={14} />
              {saving
                ? "جارٍ الحفظ في قاعدة البيانات…"
                : "التقدم المعروض من حسابك المركزي"}
              <span>لا يُنقل تقدم التجربة إلى الحساب تلقائيًا.</span>
            </div>
          )}
          {week ? (
            <>
              <div className="phase-track">
                {phases.map((s, i) => {
                  const available =
                    i === 0 ||
                    (i === 1 && active.trained) ||
                    (i === 2 && active.discovered) ||
                    (i === 3 && active.applied) ||
                    i === 4;
                  const done = [
                    active.trained,
                    active.discovered,
                    active.applied,
                    active.quizScore >= 80,
                    active.mastered,
                  ][i];
                  return (
                    <button
                      key={s.id}
                      className={`${phase === s.id ? "selected" : ""} ${done ? "done" : ""}`}
                      disabled={!available}
                      onClick={() => setPhase(s.id)}
                    >
                      <span>{done ? <Check size={16} /> : ar(i + 1)}</span>
                      <div>
                        <strong>{s.label}</strong>
                        <small>{s.detail}</small>
                      </div>
                      {!available && <Lock size={13} />}
                    </button>
                  );
                })}
              </div>
              {phase === "train" && (
                <Training
                  key={week.id}
                  week={week}
                  onComplete={training}
                  saving={saving}
                  zoom={setPhoto}
                  done={active.trained}
                />
              )}
              {(phase === "discover" || phase === "apply") && (
                <CasePanel
                  key={`${week.id}-${phase}-${user?.trainingNumber || "guest"}`}
                  week={week}
                  stage={phase}
                  connected={!!user}
                  onProgress={setCentral}
                  onLocalPassed={() =>
                    patch(week.id, {
                      [phase === "discover" ? "discovered" : "applied"]: true,
                    })
                  }
                  onNext={() =>
                    setPhase(phase === "discover" ? "apply" : "test")
                  }
                  notify={notify}
                  zoom={setPhoto}
                />
              )}
              {phase === "test" && (
                <QuizPanel
                  key={`${week.id}-${user?.trainingNumber || "guest"}`}
                  week={week}
                  connected={!!user}
                  onProgress={setCentral}
                  onLocalScore={(score) =>
                    patch(week.id, {
                      quizScore: Math.max(active.quizScore, score),
                    })
                  }
                  onNext={() => setPhase("master")}
                  notify={notify}
                />
              )}
              {phase === "master" && (
                <div className="master-layout">
                  <section className="panel mastery-card">
                    <div
                      className={`mastery-icon ${active.mastered ? "earned" : ""}`}
                    >
                      <ShieldCheck size={44} />
                    </div>
                    <span className="eyebrow">حصيلة الأسبوع {ar(week.id)}</span>
                    <h2>
                      {active.mastered
                        ? "خطوة جديدة نحو الإتقان!"
                        : "أكمل أدلة إتقانك"}
                    </h2>
                    <p>{labs[week.lab - 1].skill}</p>
                    <div className="mastery-checks">
                      {[
                        {
                          label: "فهم المحتوى وإتمام التدريب",
                          done: active.trained,
                          go: "train",
                        },
                        {
                          label: "جمع الأدلة وتحديد السبب",
                          done: active.discovered,
                          go: "discover",
                        },
                        {
                          label: "إصلاح الحالة والتحقق دون خطأ حرج",
                          done: active.applied,
                          go: "apply",
                        },
                        {
                          label: `اختبار معرفي: ${ar(active.quizScore)}٪ / المطلوب ٨٠٪`,
                          done: active.quizScore >= 80,
                          go: "test",
                        },
                      ].map((c) => (
                        <button
                          key={c.go}
                          onClick={() => setPhase(c.go as Phase)}
                          disabled={
                            (c.go === "discover" && !active.trained) ||
                            (c.go === "apply" && !active.discovered) ||
                            (c.go === "test" && !active.applied)
                          }
                        >
                          <span className={c.done ? "check yes" : "check"}>
                            {c.done ? <Check size={15} /> : <span />}
                          </span>
                          {c.label}
                          <ChevronLeft size={15} />
                        </button>
                      ))}
                      {week.id === 4 && (
                        <button onClick={() => setAssembly(true)}>
                          <span
                            className={active.assembly ? "check yes" : "check"}
                          >
                            {active.assembly && <Check size={15} />}
                          </span>
                          إكمال مختبر التجميع التفاعلي
                          <ChevronLeft size={15} />
                        </button>
                      )}
                    </div>
                    {active.mastered && week.id < 19 && (
                      <button
                        className="button primary"
                        onClick={() => openWeek(weeks[week.id])}
                      >
                        الأسبوع التالي <ArrowLeft size={17} />
                      </button>
                    )}
                    <small className="muted">
                      اعتماد المنصة يدل على إنجاز الأنشطة؛ التطبيق على أجهزة
                      المعمل يقيّمه المدرب.
                    </small>
                  </section>
                  {week.id >= 16 ? (
                    <Report
                      key={week.id}
                      done={!!active.report}
                      saved={active.report}
                      onSave={async (report) =>
                        user
                          ? await save(() => api.report(week.id, report))
                          : (patch(week.id, {
                              report: JSON.stringify(report),
                            }),
                            true)
                      }
                    />
                  ) : (
                    <section className="panel note-panel">
                      <BookOpen size={26} />
                      <h3>من الشاشة إلى المعمل</h3>
                      <p>
                        نفّذ المهارة على جهاز المعمل وفق تعليمات المدرب، ثم فسّر
                        سبب اختيارك لكل فحص.
                      </p>
                      <h4>تذكّر قبل التطبيق</h4>
                      {week.checks.map((c) => (
                        <p className="small-check" key={c}>
                          <Check size={16} />
                          {c}
                        </p>
                      ))}
                    </section>
                  )}
                </div>
              )}
              {week.id === 4 && phase === "apply" && (
                <button
                  className="button secondary assembly-launch"
                  onClick={() => setAssembly(true)}
                >
                  <Cpu size={20} />
                  افتح مختبر التجميع الأصلي المطوّر
                  {active.assembly && <CheckCircle2 size={18} />}
                </button>
              )}
            </>
          ) : (
            <>
              {view === "dashboard" && (
                <>
                  <div className="welcome-grid">
                    <section className="hero">
                      <img
                        src={image("hero.png")}
                        alt="صورة توضيحية مولدة للوحة حاسب ومكوناتها على منضدة عمل"
                      />
                      <div className="hero-shade" />
                      <div className="hero-copy">
                        <span className="hero-tag">
                          <span />
                          تعلّم بالممارسة
                        </span>
                        <h2>
                          لا تحفظ الحل.
                          <br />
                          تعلّم كيف <em>تكتشفه.</em>
                        </h2>
                        <p>
                          خمسة مختبرات مترابطة تأخذك من معرفة
                          <br className="desktop-break" /> المكونات إلى احتراف
                          تشخيص الأعطال.
                        </p>
                        <button
                          className="button primary"
                          onClick={() => openWeek(next)}
                        >
                          {completed ? "واصل رحلتك" : "ابدأ رحلتك الآن"}
                          <ArrowLeft size={18} />
                        </button>
                        <span className="hero-footnote">
                          تدرّب بثقة في بيئة محاكاة آمنة
                        </span>
                      </div>
                      <div className="hero-caption">
                        <span />
                        HARDWARE LAB <small>01 / 05</small>
                      </div>
                    </section>
                    <section className="panel journey-card">
                      <div className="card-heading">
                        <span>رحلتك نحو الإتقان</span>
                        <Route size={18} />
                      </div>
                      <div
                        className="progress-ring"
                        style={
                          {
                            "--progress": `${percent * 3.6}deg`,
                          } as React.CSSProperties
                        }
                      >
                        <div>
                          <strong>
                            {ar(percent)}
                            <small>٪</small>
                          </strong>
                          <span>من المسار مكتمل</span>
                        </div>
                      </div>
                      <div className="journey-count">
                        <span>
                          <strong>{ar(completed)}</strong> أسبوع متقن
                        </span>
                        <i />
                        <span>
                          <strong>١٩</strong> أسبوعًا
                        </span>
                      </div>
                      <button
                        className="journey-next"
                        onClick={() => openWeek(next)}
                      >
                        <span className="play-small">
                          <Play size={14} />
                        </span>
                        <span>
                          <small>خطوتك القادمة · الأسبوع {ar(next.id)}</small>
                          <strong>{next.title}</strong>
                        </span>
                        <ChevronLeft size={18} />
                      </button>
                    </section>
                  </div>
                  <section className="metrics">
                    {[
                      {
                        icon: FlaskConical,
                        value: "٥",
                        label: "مختبرات مترابطة",
                        tone: "mint",
                      },
                      {
                        icon: BookOpen,
                        value: "١٩",
                        label: "أسبوعًا من التعلّم",
                        tone: "blue",
                      },
                      {
                        icon: Wrench,
                        value: "١٩",
                        label: "حالة تشخيص عملية",
                        tone: "amber",
                      },
                      {
                        icon: ShieldCheck,
                        value: ar(completed),
                        label: "مهارات أسبوعية متقنة",
                        tone: "purple",
                      },
                    ].map((m) => (
                      <div className="metric" key={m.label}>
                        <span className={`metric-icon ${m.tone}`}>
                          <m.icon size={21} />
                        </span>
                        <div>
                          <strong>{m.value}</strong>
                          <span>{m.label}</span>
                        </div>
                      </div>
                    ))}
                  </section>
                  <div className="section-heading">
                    <div>
                      <h2>
                        مختبراتك التعليمية
                        <span className="count-pill">٥ مختبرات</span>
                      </h2>
                      <p>
                        ابدأ بالأساسيات، ثم تقدّم إلى تحديات الصيانة الحقيقية.
                      </p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => navigate("labs")}
                    >
                      عرض جميع المختبرات <ArrowLeft size={15} />
                    </button>
                  </div>
                  <div className="labs-grid">
                    {labs.map((l) => (
                      <LabCard
                        key={l.id}
                        lab={l}
                        progress={progress}
                        onOpen={() => {
                          setView("labs");
                          setLabFilter(l.id);
                        }}
                      />
                    ))}
                  </div>
                  <section className="method-strip">
                    <div>
                      <span className="eyebrow">
                        خطوات صغيرة. مهارة حقيقية.
                      </span>
                      <h3>طريقتك إلى الإتقان</h3>
                    </div>
                    <div>
                      {phases.map((p, i) => (
                        <span key={p.id}>
                          <b>{ar(i + 1)}</b>
                          {p.label}
                          {i < 4 && <ChevronLeft size={14} />}
                        </span>
                      ))}
                    </div>
                    <button
                      className="text-link"
                      onClick={() => navigate("path")}
                    >
                      اكتشف المسار <ArrowUpLeft size={16} />
                    </button>
                  </section>
                </>
              )}
              {view === "labs" && !labFilter && (
                <>
                  <div className="labs-grid catalog">
                    {labs.map((l) => (
                      <LabCard
                        key={l.id}
                        lab={l}
                        progress={progress}
                        onOpen={() => setLabFilter(l.id)}
                      />
                    ))}
                  </div>
                  <div className="panel curriculum-note">
                    <BookOpen size={20} />
                    <p>
                      التوزيع التعليمي مبدئي وفق التصور المعتمد؛ تُطابق
                      الموضوعات مع توصيف المقرر الرسمي عند توفره.
                    </p>
                  </div>
                </>
              )}
              {(view === "path" || (view === "labs" && labFilter)) && (
                <>
                  {labFilter && (
                    <div className="lab-intro panel">
                      <img
                        src={image(labs[labFilter - 1].image + ".svg")}
                        alt={"مخطط " + labs[labFilter - 1].title}
                      />
                      <div>
                        <span className="eyebrow">المختبر {ar(labFilter)}</span>
                        <h2>{labs[labFilter - 1].title}</h2>
                        <p>{labs[labFilter - 1].skill}</p>
                        <button
                          className="text-link"
                          onClick={() => setLabFilter(null)}
                        >
                          جميع المختبرات <ArrowLeft size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="filter-row">
                    <button
                      className={!labFilter ? "active" : ""}
                      onClick={() => setLabFilter(null)}
                    >
                      جميع الأسابيع
                    </button>
                    {labs.map((l) => (
                      <button
                        key={l.id}
                        className={labFilter === l.id ? "active" : ""}
                        onClick={() => setLabFilter(l.id)}
                      >
                        {l.short}
                      </button>
                    ))}
                  </div>
                  <div className="week-list">
                    {filteredWeeks.map((w) => (
                      <button
                        className="week-row"
                        key={w.id}
                        onClick={() => openWeek(w)}
                      >
                        <span
                          className={`week-number ${progress[w.id]?.mastered ? "complete" : ""}`}
                        >
                          {progress[w.id]?.mastered ? (
                            <Check size={20} />
                          ) : (
                            ar(w.id).padStart(2, "٠")
                          )}
                        </span>
                        <span className="week-info">
                          <small>
                            المختبر {ar(w.lab)} · الأسبوع {ar(w.id)}
                          </small>
                          <strong>{w.title}</strong>
                          <span>{w.objective}</span>
                        </span>
                        <span className="week-phases">
                          {phases.map((p, i) => (
                            <i
                              key={p.id}
                              title={p.label}
                              className={
                                [
                                  progress[w.id]?.trained,
                                  progress[w.id]?.discovered,
                                  progress[w.id]?.applied,
                                  (progress[w.id]?.quizScore || 0) >= 80,
                                  progress[w.id]?.mastered,
                                ][i]
                                  ? "done"
                                  : ""
                              }
                            />
                          ))}
                        </span>
                        <span className="week-state">
                          {progress[w.id]?.mastered
                            ? "متقن"
                            : progress[w.id]?.trained
                              ? "قيد التعلّم"
                              : "ابدأ التعلّم"}
                        </span>
                        <ChevronLeft size={19} />
                      </button>
                    ))}
                    {!filteredWeeks.length && (
                      <div className="empty panel">
                        <Search size={32} />
                        <h3>لم نجد موضوعًا بهذا البحث</h3>
                        <p>جرّب اسم قطعة أو مهارة مثل «الذاكرة».</p>
                        <button
                          className="button subtle"
                          onClick={() => {
                            setSearch("");
                            setLabFilter(null);
                          }}
                        >
                          مسح البحث والفلاتر
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              {view === "results" && (
                <>
                  <div className="results-head panel">
                    <div>
                      <span className="eyebrow">
                        {user ? "سجل حسابك المركزي" : "سجل التجربة المحلية"}
                      </span>
                      <h2>{ar(completed)} من ١٩ أسبوعًا متقنًا</h2>
                      <p>
                        تُحتسب المهارة بعد التدريب والاكتشاف والتطبيق ودرجة ٨٠٪
                        فأعلى، مع متطلبات الأسبوع الإضافية.
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      onClick={exportProgress}
                    >
                      <Download size={16} />
                      تصدير النتائج
                    </button>
                  </div>
                  <div className="labs-grid">
                    {labs.map((l) => {
                      const ws = weeks.filter((w) => w.lab === l.id);
                      const n = ws.filter(
                        (w) => progress[w.id]?.mastered,
                      ).length;
                      const Icon = icons[l.id - 1];
                      return (
                        <section className="panel skill-card" key={l.id}>
                          <span
                            className="skill-icon"
                            style={{ color: l.color }}
                          >
                            <Icon size={28} />
                          </span>
                          <h3>{l.title}</h3>
                          <p>{l.skill}</p>
                          <div className="progress-bar">
                            <span
                              style={{
                                width: `${(n / ws.length) * 100}%`,
                                background: l.color,
                              }}
                            />
                          </div>
                          <small>
                            {ar(n)} / {ar(ws.length)} أسابيع متقنة
                          </small>
                          <button
                            className="text-link"
                            onClick={() =>
                              openWeek(
                                ws.find((w) => !progress[w.id]?.mastered) ||
                                  ws[0],
                              )
                            }
                          >
                            متابعة المهارة <ArrowLeft size={15} />
                          </button>
                        </section>
                      );
                    })}
                  </div>
                  <div className="panel results-table">
                    <table>
                      <thead>
                        <tr>
                          <th>الأسبوع</th>
                          <th>المهارة</th>
                          <th>أفضل اختبار</th>
                          <th>الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeks.map((w) => (
                          <tr key={w.id}>
                            <td>{ar(w.id)}</td>
                            <td>
                              <button onClick={() => openWeek(w)}>
                                {w.title}
                              </button>
                            </td>
                            <td>
                              {progress[w.id]?.quizScore
                                ? ar(progress[w.id].quizScore) + "٪"
                                : "—"}
                            </td>
                            <td>
                              <span
                                className={
                                  progress[w.id]?.mastered
                                    ? "badge green"
                                    : "badge"
                                }
                              >
                                {progress[w.id]?.mastered
                                  ? "متقن"
                                  : progress[w.id]?.trained
                                    ? "قيد التعلّم"
                                    : "لم يبدأ"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {view === "library" && (
                <>
                  <div className="library-intro panel">
                    <Images size={28} />
                    <div>
                      <h2>شاهد المكوّن. افهم وظيفته.</h2>
                      <p>
                        رسوم تعليمية قابلة للتكبير، تُستخدم مع أجهزة المعمل.
                        صورة الغلاف مولدة للتوضيح وليست مرجعًا لتركيب طراز محدد.
                      </p>
                    </div>
                  </div>
                  <div className="labs-grid library-grid">
                    {labs.map((l) => (
                      <button
                        className="library-card panel"
                        key={l.id}
                        onClick={() => setPhoto(l.image + ".svg")}
                      >
                        <img
                          src={image(l.image + ".svg")}
                          alt={"مخطط تعليمي: " + l.title}
                        />
                        <div>
                          <h3>{l.title}</h3>
                          <span>
                            <ZoomIn size={16} />
                            تكبير الصورة
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {view === "trainer" && user?.role === "trainer" && (
                <Trainer notify={notify} />
              )}
            </>
          )}
          <footer className="footer">
            <span>
              <Cpu size={15} />
              إتقان · المنظومة المهنية التفاعلية لصيانة الحاسب
            </span>
            <span>تدرّب ← اكتشف ← طبّق ← اختبر ← أتقن</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <AlertTriangle size={18} />
          <span>{notice}</span>
          <IconButton label="إخفاء التنبيه" onClick={() => setNotice("")}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      {login && (
        <Login
          healthy={healthy}
          onClose={() => setLogin(false)}
          onLogin={(u, p) => {
            setUser(u);
            setCentral(p);
            setLogin(false);
            setWeek(null);
            setView("dashboard");
            notify("تم الدخول وتحميل تقدمك من قاعدة البيانات المركزية.");
          }}
        />
      )}
      {photo && (
        <Modal title="الصورة التعليمية" onClose={() => setPhoto(null)} wide>
          <img
            className="zoom-photo"
            src={image(photo)}
            alt="مخطط تعليمي مكبّر لمكونات وتشخيص الحاسب"
          />
          <p className="muted modal-caption">
            مخطط تعليمي مبسط؛ راجع دليل الجهاز لتحديد المواضع والمواصفات
            الفعلية.
          </p>
        </Modal>
      )}
      {assembly && (
        <Modal
          title="مختبر التجميع التفاعلي · مستفاد من العمل السابق"
          onClose={() => setAssembly(false)}
          wide
        >
          <Suspense fallback={<p className="loading">جارٍ تحميل المختبر…</p>}>
            <AssemblyLab
              storageKey={`pc-assembly-progress-v3-${user?.trainingNumber || "guest"}`}
              onComplete={async () => {
                if (user) await save(api.assembly);
                else patch(4, { assembly: true });
              }}
            />
          </Suspense>
        </Modal>
      )}
    </div>
  );
}
function LabCard({
  lab: l,
  progress,
  onOpen,
}: {
  lab: (typeof labs)[number];
  progress: Progress;
  onOpen: () => void;
}) {
  const ws = weeks.filter((w) => w.lab === l.id);
  const n = ws.filter((w) => progress[w.id]?.mastered).length;
  const Icon = icons[l.id - 1];
  return (
    <button
      className="lab-card"
      onClick={onOpen}
      style={{ "--lab-color": l.color } as React.CSSProperties}
    >
      <div className="lab-image">
        <img src={image(l.image + ".svg")} alt={"مخطط تعليمي لـ" + l.title} />
        <span className="lab-number">المختبر ٠{ar(l.id)}</span>
        <span className="lab-image-icon">
          <Icon size={18} />
        </span>
      </div>
      <div className="lab-body">
        <div className="lab-meta">
          <span>
            الأسابيع <b dir="ltr">{l.range}</b>
          </span>
          <small>{ar(ws.length)} أسابيع</small>
        </div>
        <h3>{l.title}</h3>
        <p>{l.description}</p>
        <div className="lab-card-footer">
          <span
            className={
              n === ws.length
                ? "lab-badge finished"
                : n
                  ? "lab-badge started"
                  : "lab-badge"
            }
          >
            <span />
            {n === ws.length ? "مكتمل" : n ? "قيد التعلّم" : "متاح للتعلّم"}
          </span>
          <span className="card-arrow">
            <ArrowUpLeft size={19} />
          </span>
        </div>
      </div>
    </button>
  );
}
function Training({
  week,
  onComplete,
  saving,
  zoom,
  done,
}: {
  week: Week;
  onComplete: () => void;
  saving: boolean;
  zoom: (s: string) => void;
  done: boolean;
}) {
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [audio, setAudio] = useState(false);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  function speak() {
    if (audio) {
      window.speechSynthesis?.cancel();
      setAudio(false);
      return;
    }
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(`${week.title}. ${week.lesson}`);
    u.lang = "ar-SA";
    u.onend = () => setAudio(false);
    u.onerror = () => setAudio(false);
    setAudio(true);
    window.speechSynthesis.speak(u);
  }
  return (
    <div className="training-layout">
      <section className="panel lesson">
        <span className="eyebrow">تدرّب · فهم قبل التجربة</span>
        <h2>{week.objective}</h2>
        <p className="lesson-text">{week.lesson}</p>
        <button className="button subtle" onClick={speak}>
          <Volume2 size={17} />
          {audio ? "إيقاف القراءة" : "استمع للشرح"}
        </button>
        <div className="lesson-checks">
          <h3>تحقّق من فهمك</h3>
          {week.checks.map((c, i) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={checks[i]}
                onChange={(e) =>
                  setChecks(
                    checks.map((v, j) => (j === i ? e.target.checked : v)),
                  )
                }
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
        <button
          className="button primary"
          disabled={saving || !checks.every(Boolean)}
          onClick={onComplete}
        >
          {saving
            ? "جارٍ الحفظ…"
            : done
              ? "أعد المراجعة وانتقل للاكتشاف"
              : "فهمت الأساسيات، لنكتشف العطل"}
          <ArrowLeft size={17} />
        </button>
      </section>
      <figure className="panel lesson-visual">
        <button
          onClick={() => zoom(week.visual + ".svg")}
          aria-label="تكبير الصورة التعليمية"
        >
          <img src={image(week.visual + ".svg")} alt={week.caption} />
          <span>
            <ZoomIn size={17} />
            تكبير
          </span>
        </button>
        <figcaption>{week.caption}</figcaption>
        <div className="visual-note">
          <ShieldCheck size={19} />
          <p>
            طبّق على أجهزة المعمل بإشراف المدرب، واتبع دليل الطراز وإجراءات
            السلامة.
          </p>
        </div>
      </figure>
    </div>
  );
}
function Login({
  healthy,
  onClose,
  onLogin,
}: {
  healthy: boolean;
  onClose: () => void;
  onLogin: (u: User, p: Progress) => void;
}) {
  const [number, setNumber] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api.login(number, password);
      onLogin(r.user, r.progress);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="دخول المتدرب" onClose={onClose}>
      <form className="login-form" onSubmit={submit}>
        <span className="login-symbol">
          <LogIn size={28} />
        </span>
        <p>
          ادخل برقمك التدريبي وكلمة المرور التي سلّمها لك المدرب، لتتابع من أي
          جهاز.
        </p>
        <label>
          الرقم التدريبي
          <input
            dir="ltr"
            inputMode="numeric"
            autoComplete="username"
            pattern="[0-9]{4,14}"
            required
            value={number}
            onChange={(e) =>
              setNumber(
                e.target.value.replace(/[٠-٩]/g, (c) =>
                  String("٠١٢٣٤٥٦٧٨٩".indexOf(c)),
                ),
              )
            }
            placeholder="أدخل رقمك التدريبي"
          />
        </label>
        <label>
          كلمة المرور
          <input
            dir="ltr"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="أدخل كلمة المرور"
          />
        </label>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {!healthy && (
          <div className="info-message">
            خادم الحسابات غير متصل حاليًا. يمكنك متابعة التجربة المحلية؛ لن
            تُحفظ مركزيًا.
          </div>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "جارٍ التحقق…" : "الدخول إلى حسابي"}
          <ArrowLeft size={17} />
        </button>
        <button type="button" className="text-link" onClick={onClose}>
          متابعة التجربة المحلية
        </button>
        <small className="muted">
          لا توجد حسابات افتراضية. يُنشئ المدرب الحسابات، ويتولى إعادة تعيين
          كلمات المرور.
        </small>
      </form>
    </Modal>
  );
}
function CasePanel({
  week,
  stage,
  connected,
  onProgress,
  onLocalPassed,
  onNext,
  notify,
  zoom,
}: {
  week: Week;
  stage: "discover" | "apply";
  connected: boolean;
  onProgress: (p: Progress) => void;
  onLocalPassed: () => void;
  onNext: () => void;
  notify: (s: string) => void;
  zoom: (s: string) => void;
}) {
  const [state, setState] = useState<PublicCaseState | null>(null);
  const [busy, setBusy] = useState(false);
  const internal = useRef<CaseState | null>(null);
  async function start() {
    setBusy(true);
    try {
      if (connected) {
        setState((await api.startCase(week.id, stage)).state);
      } else {
        const engine = await import("./cases");
        internal.current = engine.makeCase(week.id, stage);
        setState(engine.publicCase(internal.current));
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(id: string) {
    if (!state) return;
    setBusy(true);
    try {
      if (connected) {
        const r = await api.action(state.id, id);
        setState(r.state);
        onProgress(r.progress);
      } else {
        const engine = await import("./cases");
        internal.current = engine.advanceCase(internal.current!, id);
        setState(engine.publicCase(internal.current));
        if (internal.current.complete && internal.current.passed)
          onLocalPassed();
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="case-layout">
      <section className="panel case-main">
        <div className="case-heading">
          <span className="badge amber">
            {stage === "discover" ? "مهمة اكتشاف" : "محاكاة إصلاح"}
          </span>
          <span className="muted">الأسبوع {ar(week.id)}</span>
        </div>
        <h2>{state?.definition.title || week.title}</h2>
        <p className="case-brief">
          {state?.definition.brief ||
            "استقبل البلاغ، واجمع الأدلة، ثم اختر قرارك بناءً على نتائج الفحص."}
        </p>
        {!state ? (
          <>
            <div className="case-start-visual">
              <img src={image(week.visual + ".svg")} alt={week.caption} />
            </div>
            <div className="info-message">
              {stage === "discover"
                ? "اجمع دليلين ثم اختر الاستنتاج الذي تدعمه النتائج."
                : "اجمع الأدلة وحدّد السبب ثم أصلح الحالة وأعد الفحص."}{" "}
              أي إجراء سلامة حرج يمنع الاجتياز، وتحتاج لإعادة المحاولة.
            </div>
            <button className="button primary" onClick={start} disabled={busy}>
              <Play size={17} />
              {busy ? "جارٍ التحضير…" : "استلام البلاغ وبدء الحالة"}
            </button>
          </>
        ) : (
          <>
            <button
              className="case-image"
              onClick={() => zoom(state.definition.image + ".svg")}
            >
              <img
                src={image(state.definition.image + ".svg")}
                alt="مخطط توضيحي لمنطقة العطل؛ النتائج الفعلية تظهر في سجل الفحص"
              />
              <span>
                <ZoomIn size={16} />
                صورة توضيحية · الأدلة في سجل الفحص
              </span>
            </button>
            {!state.complete ? (
              <>
                <h3>ما خطوتك التالية؟</h3>
                <div className="actions-list">
                  {state.definition.actions.map((a) => (
                    <button
                      key={a.id}
                      disabled={busy || state.done.includes(a.id)}
                      onClick={() => act(a.id)}
                    >
                      {state.done.includes(a.id) ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <span className="action-dot" />
                      )}
                      <span>{a.label}</span>
                      <ChevronLeft size={16} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div
                className={`case-outcome ${state.passed ? "passed" : "failed"}`}
              >
                {state.passed ? (
                  <ShieldCheck size={34} />
                ) : (
                  <RotateCcw size={32} />
                )}
                <h3>
                  {state.passed
                    ? "قرار تدعمه الأدلة. أحسنت التحقق."
                    : "المحاولة تحتاج إلى مراجعة"}
                </h3>
                <p>
                  {state.passed
                    ? "اكتمل الهدف دون خطأ سلامة حرج. انتقل إلى الخطوة التالية."
                    : state.critical
                      ? "سُجّل إجراء حرج. راجع السلامة وحماية البيانات ثم أعد المحاولة."
                      : "كثرت القرارات غير المدعومة. راجع سجل الفحص ثم أعد المحاولة."}
                </p>
                <div className="button-row">
                  {state.passed && (
                    <button className="button primary" onClick={onNext}>
                      {stage === "discover"
                        ? "انتقل للتطبيق"
                        : "انتقل للاختبار"}
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <button
                    className="button subtle"
                    onClick={start}
                    disabled={busy}
                  >
                    <RotateCcw size={16} />
                    محاولة جديدة
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <aside className="panel evidence-panel">
        <div className="card-heading">
          <h3>دفتر التشخيص</h3>
          <BookOpen size={20} />
        </div>
        <p className="muted">
          نتائج فحوصك تظهر هنا. اقرأ الدليل قبل اختيار القرار.
        </p>
        <div className="case-counters">
          <span>
            <b>{ar(state?.log.length || 0)}</b> إجراءات
          </span>
          <span>
            <b>{ar(state?.mistakes || 0)}</b> قرارات تحتاج مراجعة
          </span>
        </div>
        <div className="evidence-log" aria-live="polite">
          {state?.log.length ? (
            state.log.map((l, i) => (
              <div className={`log-item ${l.ok ? "" : "warning"}`} key={i}>
                <span>{ar(i + 1)}</span>
                <div>
                  <strong>{l.label}</strong>
                  <p>{l.result}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-log">
              <Search size={30} />
              <p>
                ابدأ بفحص مناسب.
                <br />
                كل دليل يقرّبك من السبب.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
function QuizPanel({
  week,
  connected,
  onProgress,
  onLocalScore,
  onNext,
  notify,
}: {
  week: Week;
  connected: boolean;
  onProgress: (p: Progress) => void;
  onLocalScore: (score: number) => void;
  onNext: () => void;
  notify: (s: string) => void;
}) {
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [index, setIndex] = useState(0);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const internal = useRef<Question[]>([]);
  async function start() {
    setBusy(true);
    try {
      if (connected) {
        const r = await api.startQuiz(week.id);
        setQuestions(r.questions);
        setId(r.id);
      } else {
        const engine = await import("./questions");
        internal.current = engine.pickQuestions(week.lab);
        setQuestions(engine.exposeQuestions(internal.current));
      }
      setAnswers({});
      setIndex(0);
      setResult(null);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    try {
      if (connected) {
        const r = await api.submitQuiz(id, answers);
        setResult(r);
        onProgress(r.progress);
      } else {
        const r = (await import("./questions")).grade(
          internal.current,
          answers,
        );
        setResult(r);
        onLocalScore(r.score);
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const q = questions[index];
  const complete =
    questions.length > 0 &&
    questions.every((q) => {
      const a = answers[q.id];
      return (
        a?.length === (q.kind === "choice" ? 1 : q.options.length) &&
        new Set(a).size === a.length
      );
    });
  return (
    <section className="panel quiz-panel">
      <div className="case-heading">
        <span className="badge purple">اختبر · قياس الفهم والتطبيق</span>
        <span className="muted">درجة الاجتياز ٨٠٪</span>
      </div>
      {!questions.length ? (
        <div className="quiz-start">
          <GraduationCap size={48} />
          <h2>اختبر فهمك بحالة جديدة</h2>
          <p>
            ٥ أسئلة عشوائية من بنك مهارات المختبر: اختيار متعدد، وترتيب،
            ومطابقة. تختلف الخيارات والأسئلة بين المحاولات؛ وقد تتكرر بعض
            الأسئلة.
          </p>
          <div className="quiz-rules">
            <span>
              <Check size={16} />
              خيارات دون تمييز للإجابة
            </span>
            <span>
              <Check size={16} />
              تفسير بعد تسليم الاختبار
            </span>
            <span>
              <Check size={16} />
              تُحفظ أفضل نتيجة
            </span>
          </div>
          <button className="button primary" onClick={start} disabled={busy}>
            {busy ? "جارٍ إعداد الأسئلة…" : "ابدأ الاختبار"}
            <ArrowLeft size={17} />
          </button>
        </div>
      ) : result ? (
        <div className="quiz-result">
          <div className={`score-medal ${result.score >= 80 ? "passed" : ""}`}>
            {ar(result.score)}
            <small>٪</small>
          </div>
          <h2>
            {result.score >= 80
              ? "فهمك يتقدّم إلى مهارة"
              : "محاولة مفيدة. راجع ثم جرّب."}
          </h2>
          <p>
            {result.score >= 80
              ? "اجتزت المعيار المعرفي. راجع أدلة الإتقان ومتطلبات الأسبوع."
              : "تحتاج إلى ٨٠٪ فأعلى. ستجد تفسير كل إجابة أدناه."}
          </p>
          <div className="button-row">
            {result.score >= 80 && (
              <button className="button primary" onClick={onNext}>
                راجع الإتقان <ShieldCheck size={17} />
              </button>
            )}
            <button className="button subtle" onClick={start} disabled={busy}>
              <RotateCcw size={16} />
              اختبار جديد
            </button>
          </div>
          <div className="answer-review">
            {result.results.map((r, i) => (
              <div key={r.id} className={r.correct ? "correct" : "incorrect"}>
                <span>
                  {r.correct ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <AlertTriangle size={20} />
                  )}
                </span>
                <div>
                  <h3>
                    {ar(i + 1)}. {questions.find((q) => q.id === r.id)?.prompt}
                  </h3>
                  <p>{r.explanation}</p>
                  <small>الإجابة: {r.correctTexts.join(" ← ")}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="quiz-nav">
            {questions.map((item, i) => (
              <button
                key={item.id}
                className={`${i === index ? "active" : ""} ${answers[item.id]?.length ? "answered" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`السؤال ${i + 1}`}
              >
                {ar(i + 1)}
              </button>
            ))}
            <span>
              {ar(index + 1)} من {ar(questions.length)}
            </span>
          </div>
          <span className="eyebrow">
            {q.kind === "choice"
              ? "اختر إجابة واحدة"
              : q.kind === "order"
                ? "رتّب الخطوات من الأعلى إلى الأسفل"
                : "اختر مقابلًا مختلفًا لكل وصف"}
          </span>
          <h2 className="question-title">{q.prompt}</h2>
          {q.image && (
            <img
              className="quiz-image"
              src={image(q.image + ".svg")}
              alt="مخطط تعليمي مرتبط بالسؤال"
            />
          )}
          {q.kind === "choice" ? (
            <div className="quiz-options">
              {q.options.map((o, i) => (
                <label
                  className={answers[q.id]?.[0] === o.id ? "selected" : ""}
                  key={o.id}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id]?.[0] === o.id}
                    onChange={() => setAnswers({ ...answers, [q.id]: [o.id] })}
                  />
                  <span className="option-letter">
                    {["أ", "ب", "ج", "د"][i]}
                  </span>
                  <span>{o.text}</span>
                </label>
              ))}
            </div>
          ) : q.kind === "match" ? (
            <div className="matching-options">
              {q.pairs?.map((pair, i) => (
                <label key={pair}>
                  <span>{pair}</span>
                  <select
                    aria-label={pair}
                    value={answers[q.id]?.[i] || ""}
                    onChange={(e) => {
                      const a = answers[q.id]
                        ? [...answers[q.id]]
                        : Array(q.options.length).fill("");
                      a[i] = e.target.value;
                      setAnswers({ ...answers, [q.id]: a });
                    }}
                  >
                    <option value="">اختر المكوّن أو المصطلح</option>
                    {q.options.map((o) => (
                      <option value={o.id} key={o.id}>
                        {o.text}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : (
            <div className="order-options">
              {(answers[q.id] || q.options.map((o) => o.id)).map(
                (oid, i, arr) => {
                  const move = (to: number) => {
                    const a = [...arr];
                    [a[i], a[to]] = [a[to], a[i]];
                    setAnswers({ ...answers, [q.id]: a });
                  };
                  return (
                    <div key={oid}>
                      <span className="order-number">{ar(i + 1)}</span>
                      <span>{q.options.find((o) => o.id === oid)?.text}</span>
                      <div>
                        <button
                          aria-label={"تحريك الخطوة " + ar(i + 1) + " لأعلى"}
                          disabled={i === 0}
                          onClick={() => move(i - 1)}
                        >
                          <ArrowUp size={17} />
                        </button>
                        <button
                          aria-label={"تحريك الخطوة " + ar(i + 1) + " لأسفل"}
                          disabled={i === arr.length - 1}
                          onClick={() => move(i + 1)}
                        >
                          <ArrowDown size={17} />
                        </button>
                      </div>
                    </div>
                  );
                },
              )}
              <button
                className="button subtle"
                onClick={() =>
                  setAnswers({
                    ...answers,
                    [q.id]: answers[q.id] || q.options.map((o) => o.id),
                  })
                }
              >
                <Check size={16} />
                {answers[q.id]
                  ? "الترتيب معتمد، ويمكن تعديله"
                  : "اعتماد هذا الترتيب"}
              </button>
            </div>
          )}
          <div className="quiz-bottom">
            <button
              className="button subtle"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              السابق
            </button>
            {index < questions.length - 1 ? (
              <button
                className="button secondary"
                onClick={() => setIndex(index + 1)}
              >
                السؤال التالي <ArrowLeft size={16} />
              </button>
            ) : (
              <button
                className="button primary"
                disabled={!complete || busy}
                onClick={submit}
              >
                {busy ? "جارٍ التصحيح…" : "تسليم الاختبار"}
              </button>
            )}
          </div>
          {index === questions.length - 1 && !complete && (
            <p className="muted">
              أكمل جميع الإجابات، واعتمد الترتيب، وتأكد من عدم تكرار خيارات
              المطابقة.
            </p>
          )}
        </>
      )}
    </section>
  );
}
function Report({
  onSave,
  done,
  saved,
}: {
  onSave: (r: Record<string, string>) => Promise<boolean>;
  done: boolean;
  saved?: string;
}) {
  const [values, setValues] = useState(() => {
    const blank = { symptom: "", cause: "", action: "", verification: "" };
    try {
      const data = JSON.parse(saved || "{}");
      for (const key of Object.keys(blank) as (keyof typeof blank)[]) {
        if (typeof data[key] === "string") blank[key] = data[key];
      }
    } catch {
      /* Earlier local drafts remain saved in the progress record. */
    }
    return blank;
  });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel report-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(values);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">توثيق مهني</span>
      <h2>تقرير الصيانة</h2>
      <p>اكتب تفسيرك لنتيجة المحاكاة. لا يُطلب رفع صور لإثبات الإنجاز.</p>
      {[
        { id: "symptom", label: "العرض المبلغ عنه" },
        { id: "cause", label: "السبب والأدلة" },
        { id: "action", label: "الإجراء المنفذ" },
        { id: "verification", label: "نتيجة التحقق والتوصية الوقائية" },
      ].map((f) => (
        <label key={f.id}>
          {f.label}
          <textarea
            minLength={8}
            maxLength={1000}
            required
            value={values[f.id as keyof typeof values]}
            onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
            rows={2}
          />
        </label>
      ))}
      <button className="button primary" disabled={busy}>
        {busy ? "جارٍ الحفظ…" : done ? "تحديث التقرير" : "حفظ التقرير"}
      </button>
      {done && (
        <span className="badge green">
          <Check size={14} />
          يوجد تقرير محفوظ ضمن تقدم الأسبوع
        </span>
      )}
    </form>
  );
}
function Trainer({ notify }: { notify: (s: string) => void }) {
  const [rows, setRows] = useState<
    { name: string; trainingNumber: string; progress: Progress }[]
  >([]);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  async function load() {
    setBusy(true);
    setFailed(false);
    try {
      setRows((await api.trainer()).trainees);
    } catch (e) {
      setFailed(true);
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="panel results-table">
      <div className="section-heading">
        <h2>متابعة الحسابات المركزية</h2>
        <button className="button subtle" onClick={load} disabled={busy}>
          <RotateCcw size={16} />
          تحديث
        </button>
      </div>
      {busy ? (
        <p className="loading">جارٍ تحميل النتائج…</p>
      ) : failed ? (
        <p>تعذر تحميل النتائج. أعد المحاولة.</p>
      ) : rows.length ? (
        <table>
          <thead>
            <tr>
              <th>المتدرب</th>
              <th>الرقم التدريبي</th>
              <th>أسابيع متقنة</th>
              <th>تقارير الورشة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.trainingNumber}>
                <td>{r.name}</td>
                <td>{r.trainingNumber}</td>
                <td>
                  {ar(
                    Object.values(r.progress).filter((p) => p.mastered).length,
                  )}{" "}
                  / ١٩
                </td>
                <td>
                  {ar(Object.values(r.progress).filter((p) => p.report).length)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">
          لم تُنشأ حسابات متدربين بعد. ينشئها مسؤول الخادم بأداة الحسابات.
        </p>
      )}
    </section>
  );
}
