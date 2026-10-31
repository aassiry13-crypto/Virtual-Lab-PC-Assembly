import { motion, AnimatePresence } from "motion/react";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Power,
  Cpu,
  MemoryStick,
  Video,
  LayoutDashboard,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
} from "lucide-react";

type PartId = "psu" | "motherboard" | "cpu" | "ram" | "gpu";

interface Part {
  id: PartId;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface Step {
  id: PartId;
  instruction: string;
  hint: string;
}

const PARTS: Record<PartId, Part> = {
  psu: {
    id: "psu",
    name: "مزود الطاقة",
    icon: <Power size={28} />,
    description:
      "يحوّل التغذية الكهربائية إلى جهود مناسبة لمكونات الحاسب. لا تفتح المزود.",
  },
  motherboard: {
    id: "motherboard",
    name: "اللوحة الأم",
    icon: <LayoutDashboard size={28} />,
    description: "تربط المعالج والذاكرة وبقية المكونات وتتيح التواصل بينها.",
  },
  cpu: {
    id: "cpu",
    name: "المعالج",
    icon: <Cpu size={28} />,
    description: "ينفّذ التعليمات والعمليات الحسابية والمنطقية.",
  },
  ram: {
    id: "ram",
    name: "الذاكرة",
    icon: <MemoryStick size={28} />,
    description:
      "ذاكرة عمل مؤقتة للبيانات النشطة، وتفقد محتواها عند انقطاع الطاقة.",
  },
  gpu: {
    id: "gpu",
    name: "بطاقة العرض",
    icon: <Video size={28} />,
    description: "تعالج الرسوميات وتوفر مخارج العرض في هذا التكوين.",
  },
};

const STEPS: Step[] = [
  {
    id: "psu",
    instruction: "ابدأ بتركيب مزود الطاقة في الحيز السفلي.",
    hint: "مزود الطاقة يغذي القطع. موضعه في الحيز الكبير أسفل الهيكل.",
  },
  {
    id: "motherboard",
    instruction: "ركّب اللوحة الأم في الهيكل.",
    hint: "اللوحة تربط المكونات وتشغل المساحة الرئيسية في الهيكل.",
  },
  {
    id: "cpu",
    instruction: "ضع المعالج في مقبسه على اللوحة.",
    hint: "موضع المعالج هو المقبس المربع الصغير في وسط اللوحة.",
  },
  {
    id: "ram",
    instruction: "ركّب الذاكرة في شقها المناسب.",
    hint: "ابحث عن شقوق الذاكرة العمودية بجوار المعالج.",
  },
  {
    id: "gpu",
    instruction: "أخيرًا، ركّب بطاقة العرض في شق التوسعة.",
    hint: "موضع البطاقة شق PCIe الأفقي أسفل المعالج.",
  },
];

const AUDIO_TEXT: Record<string, string> = {
  step_0: "ابدأ بتركيب مزود الطاقة في الحيز السفلي.",
  step_1: "ثم ركّب اللوحة الأم في الهيكل.",
  step_2: "ركّب المعالج في المقبس المربع وسط اللوحة.",
  step_3: "ركّب الذاكرة في الشقوق العمودية.",
  step_4: "ركّب بطاقة العرض في الشق أسفل المعالج.",
  complete: "أكملت تجميع القطع الخمس في المحاكاة.",
  error_sequence: "القطعة لا تطابق الخطوة الحالية. راجع التسلسل.",
  error_location: "الموضع غير صحيح. راجع مكان القطعة.",
};

export default function AssemblyLab({
  storageKey = "pc-assembly-progress-v3-guest",
  onComplete,
}: {
  storageKey?: string;
  onComplete?: () => void;
}) {
  const savedRef = useRef<{
    parts: PartId[];
    attempts: number;
    mistakes: number;
  } | null>(null);
  if (!savedRef.current) {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const parts = Array.isArray(raw.installedParts) ? raw.installedParts : [];
      const valid =
        parts.length <= 5 &&
        parts.every((id: unknown, i: number) => id === STEPS[i].id);
      savedRef.current = {
        parts: valid ? parts : [],
        attempts:
          Number.isFinite(raw.attempts) && raw.attempts >= 0 ? raw.attempts : 0,
        mistakes:
          Number.isFinite(raw.mistakes) && raw.mistakes >= 0 ? raw.mistakes : 0,
      };
    } catch {
      savedRef.current = { parts: [], attempts: 0, mistakes: 0 };
    }
  }
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const reported = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (f: () => void, ms: number) => {
    timers.current.push(setTimeout(f, ms));
  };
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  const [currentStep, setCurrentStep] = useState(
    Math.min(savedRef.current.parts.length, 4),
  );
  const [installedParts, setInstalledParts] = useState<PartId[]>(
    savedRef.current.parts,
  );
  const [attempts, setAttempts] = useState(savedRef.current.attempts);
  const [mistakes, setMistakes] = useState(savedRef.current.mistakes);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "success" | "error" | null;
  }>({ message: "", type: null });
  const [selectedPart, setSelectedPart] = useState<PartId | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  const audioEnabledRef = useRef(isAudioEnabled);
  useEffect(() => {
    audioEnabledRef.current = isAudioEnabled;
  }, [isAudioEnabled]);

  const speak = useCallback((textKey: string, force = false) => {
    if (!force && !audioEnabledRef.current) return;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const textToSpeak = AUDIO_TEXT[textKey] || textKey;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "ar-SA";

      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find((v) => v.lang.startsWith("ar"));
      if (enVoice) utterance.voice = enVoice;

      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    if (newState) {
      const isComplete = installedParts.length === STEPS.length;
      if (isComplete) {
        speak("complete", true);
      } else {
        speak(`step_${currentStep}`, true);
      }
    } else {
      window.speechSynthesis?.cancel();
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ currentStep, installedParts, attempts, mistakes }),
      );
    } catch {
      /* Parent displays local storage limitations. */
    }
    if (installedParts.length === 5 && !reported.current) {
      reported.current = true;
      completeRef.current?.();
    }
    if (installedParts.length < 5) reported.current = false;
  }, [currentStep, installedParts, attempts, mistakes, storageKey]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const handleDragStart = (e: React.DragEvent, partId: PartId) => {
    e.dataTransfer.setData("partId", partId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const processDrop = (draggedPartId: PartId, targetSlotId: PartId) => {
    if (!draggedPartId || installedParts.includes(draggedPartId)) {
      setSelectedPart(null);
      return;
    }

    setAttempts((a) => a + 1);
    setSelectedPart(null);

    const expectedPartId = STEPS[currentStep].id;

    if (draggedPartId === expectedPartId && targetSlotId === expectedPartId) {
      // Success
      setInstalledParts((prev) => [...prev, draggedPartId]);
      setFeedback({ message: "تم تركيب القطعة", type: "success" });

      // Auto-advance after a short delay
      later(() => {
        setFeedback({ message: "", type: null });
        if (currentStep < STEPS.length - 1) {
          setCurrentStep(currentStep + 1);
          speak(`step_${currentStep + 1}`);
        } else {
          speak("complete");
        }
      }, 1500);
    } else if (draggedPartId !== expectedPartId) {
      // Wrong part for this step
      setMistakes((m) => m + 1);
      speak("error_sequence");
      setFeedback({
        message: `خطأ في التسلسل: المطلوب ${PARTS[expectedPartId].name}.`,
        type: "error",
      });
      later(() => setFeedback({ message: "", type: null }), 3000);
    } else {
      // Right part, wrong slot
      setMistakes((m) => m + 1);
      speak("error_location");
      setFeedback({ message: `موضع القطعة غير صحيح.`, type: "error" });
      later(() => setFeedback({ message: "", type: null }), 3000);
    }
  };

  const handleDragDrop = (e: React.DragEvent, targetSlotId: PartId) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedPartId = e.dataTransfer.getData("partId") as PartId;
    processDrop(draggedPartId, targetSlotId);
  };

  const handleSlotClick = (
    e: React.MouseEvent | React.KeyboardEvent,
    targetSlotId: PartId,
  ) => {
    e.stopPropagation();
    if (selectedPart) {
      processDrop(selectedPart, targetSlotId);
    }
  };

  const handleReset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setCurrentStep(0);
    setInstalledParts([]);
    setAttempts(0);
    setMistakes(0);
    setFeedback({ message: "", type: null });
    setSelectedPart(null);
    speak("step_0");
  };

  const isComplete = installedParts.length === STEPS.length;
  const progress = (installedParts.length / STEPS.length) * 100;

  return (
    <div
      dir="rtl"
      className="assembly-root min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-cyan-500/30 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <header className="h-16 border-b border-cyan-500/20 bg-slate-900/50 flex items-center justify-between px-4 md:px-8 backdrop-blur-md z-40 relative">
        <div className="flex items-center gap-2 md:gap-3 flex-1">
          <div className="shrink-0 w-6 h-6 md:w-8 md:h-8 bg-cyan-500 rounded-sm flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Cpu size={16} className="text-slate-950" />
          </div>
          <h1 className="hidden md:block text-sm lg:text-lg font-bold tracking-tight uppercase text-cyan-400 whitespace-nowrap">
            مختبر التجميع
          </h1>
        </div>

        <span className="text-sm text-cyan-300">تجميع موجّه · خمس قطع</span>

        <div className="flex items-center justify-end gap-3 md:gap-6 text-sm flex-1">
          {
            <>
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  المحاولات
                </span>
                <span className="font-bold font-mono text-lg text-slate-200">
                  {attempts}
                </span>
              </div>
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  الأخطاء
                </span>
                <span className="font-bold font-mono text-lg text-red-500">
                  {mistakes}
                </span>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 border border-slate-700 hover:border-cyan-500 text-[10px] md:text-xs font-mono transition-colors rounded text-slate-300 ml-0 md:ml-4"
              >
                <RotateCcw size={14} />{" "}
                <span className="hidden md:inline">إعادة البدء</span>
              </button>
              <button
                onClick={toggleAudio}
                className={`p-1.5 md:p-2 border rounded transition-colors ${isAudioEnabled ? "border-cyan-500 text-cyan-400 bg-cyan-500/10" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}
                title="تشغيل أو إيقاف التعليمات الصوتية"
                aria-label="تشغيل أو إيقاف التعليمات الصوتية"
              >
                {isAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            </>
          }
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-y-auto lg:overflow-hidden relative">
        <div className="flex flex-1 flex-col lg:flex-row w-full h-full">
          {/* Left Panel: Instructions */}
          <aside className="w-full lg:w-80 border-r border-cyan-500/10 bg-slate-900/30 p-6 flex flex-col gap-6 overflow-y-visible lg:overflow-y-auto z-10">
            <div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-2">
                <span>التقدم</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {!isComplete ? (
              <div className="flex-1 flex flex-col relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
                  <h3 className="text-[11px] uppercase font-bold tracking-widest text-cyan-400">
                    OBJ_{currentStep + 1}
                  </h3>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="flex-1 flex flex-col"
                  >
                    <div className="bg-slate-800/40 border border-slate-700 p-4 rounded-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-1 text-[8px] font-mono opacity-20">
                        محاكاة مبسطة
                      </div>
                      <p className="text-sm leading-relaxed text-slate-300 mb-3 font-medium">
                        <span className="text-white font-semibold">
                          الخطوة:{" "}
                        </span>
                        {STEPS[currentStep].instruction}
                      </p>
                      <div className="bg-slate-900/50 border border-slate-700 rounded p-3 text-slate-400 flex gap-3 text-xs leading-relaxed mt-2">
                        <AlertCircle
                          className="shrink-0 text-cyan-500"
                          size={16}
                        />
                        <p>{STEPS[currentStep].hint}</p>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Feedback messages */}
                <div className="h-16 mt-6">
                  <AnimatePresence>
                    {feedback.message && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`flex items-center gap-2 p-3 text-xs rounded border font-mono tracking-wide ${
                          feedback.type === "success"
                            ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-400"
                            : "bg-red-900/20 border-red-500/30 text-red-500"
                        }`}
                      >
                        {feedback.type === "success" ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <AlertCircle size={16} />
                        )}
                        {feedback.message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center flex-1 text-center border border-emerald-500/30 bg-emerald-900/10 rounded-xl p-6"
              >
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-xl font-bold tracking-widest uppercase text-white mb-2">
                  اكتمل التجميع
                </h2>
                <p className="text-slate-400 text-sm mb-6">
                  ركبت القطع الخمس مع {mistakes} أخطاء. المحاكاة لا تشمل جميع
                  توصيلات الجهاز الحقيقي.
                </p>
                <button
                  onClick={() => completeRef.current?.()}
                  className="bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500 text-cyan-400 font-mono text-xs uppercase tracking-widest font-bold py-3 px-6 rounded transition-colors w-full mb-3 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                >
                  إكمال التدريب
                </button>
                <button
                  onClick={handleReset}
                  className="border border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 font-mono text-xs uppercase tracking-widest font-bold py-3 px-6 rounded transition-colors w-full"
                >
                  إعادة التجميع
                </button>
              </motion.div>
            )}
          </aside>

          {/* Center: Drop Zone (PC Case) */}
          <section className="flex-1 relative bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#020617_100%)] p-8 flex items-center justify-center min-h-[500px]">
            {/* Grid Overlay */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
              style={{
                backgroundImage: "radial-gradient(#06b6d4 1px, transparent 0)",
                backgroundSize: "40px 40px",
              }}
            ></div>

            {/* Setup Case Display */}
            <div className="w-full max-w-[450px] aspect-[4/5] border border-cyan-500/20 rounded-xl bg-slate-900/40 backdrop-blur-sm p-5 shadow-2xl relative flex flex-col gap-4 z-10">
              {/* Case Silhouette */}
              <div className="absolute inset-4 border-2 border-slate-700/50 rounded-lg pointer-events-none"></div>

              {/* Motherboard slot */}
              <div
                className={`flex-1 rounded border border-dashed relative transition-colors flex flex-col p-4 z-10 ${
                  installedParts.includes("motherboard")
                    ? "border-slate-700 bg-slate-800/60 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]"
                    : STEPS[currentStep]?.id === "motherboard" && !isComplete
                      ? "border-cyan-400/50 bg-cyan-400/5"
                      : "border-slate-700 bg-slate-800/20"
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDragDrop(e, "motherboard")}
                onClick={(e) => handleSlotClick(e, "motherboard")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSlotClick(e, "motherboard");
                  }
                }}
                role="button"
                tabIndex={selectedPart ? 0 : -1}
                aria-label="Motherboard Slot"
              >
                {installedParts.includes("motherboard") && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute inset-3 border border-slate-700/50 bg-slate-800/30 rounded pointer-events-none flex"
                  >
                    {/* Slots inside motherboard */}

                    {/* CPU Area */}
                    <div className="absolute top-10 left-[25%] w-[80px] h-[80px]">
                      <div
                        className={`w-full h-full rounded border border-dashed transition-colors flex items-center justify-center relative group ${
                          installedParts.includes("cpu")
                            ? "border-slate-600 bg-slate-800/80 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)]"
                            : STEPS[currentStep]?.id === "cpu" && !isComplete
                              ? "border-cyan-400/50 bg-cyan-400/5 pointer-events-auto"
                              : "border-slate-700 pointer-events-auto"
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDragDrop(e, "cpu")}
                        onClick={(e) => handleSlotClick(e, "cpu")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSlotClick(e, "cpu");
                          }
                        }}
                        role="button"
                        tabIndex={selectedPart ? 0 : -1}
                        aria-label="CPU Socket"
                      >
                        {!installedParts.includes("cpu") &&
                          STEPS[currentStep]?.id === "cpu" &&
                          !isComplete && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-mono text-cyan-400 bg-slate-900 px-1 py-0.5 border border-cyan-400/30 shadow-[0_0_8px_rgba(34,211,238,0.2)]">
                              مقبس المعالج
                            </div>
                          )}

                        {installedParts.includes("cpu") && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <Cpu size={40} className="text-cyan-600/50" />
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* RAM Area */}
                    <div className="absolute top-8 right-[25%] w-[45px] h-[100px] flex flex-col gap-1">
                      <div
                        className={`w-full h-full rounded border border-dashed transition-colors flex items-center justify-center ${
                          installedParts.includes("ram")
                            ? "border-slate-600 bg-slate-800/80 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)]"
                            : STEPS[currentStep]?.id === "ram" && !isComplete
                              ? "border-cyan-400/50 bg-cyan-400/5 pointer-events-auto"
                              : "border-slate-700 pointer-events-auto"
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDragDrop(e, "ram")}
                        onClick={(e) => handleSlotClick(e, "ram")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSlotClick(e, "ram");
                          }
                        }}
                        role="button"
                        tabIndex={selectedPart ? 0 : -1}
                        aria-label="RAM Slots"
                      >
                        {installedParts.includes("ram") && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <div className="w-[8px] h-[70px] bg-cyan-500/80 rounded-sm mx-auto shadow-[0_0_10px_rgba(34,211,238,0.5)]"></div>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* GPU Slot */}
                    <div className="absolute bottom-12 left-10 right-10 h-[50px]">
                      <div
                        className={`w-full h-full rounded border border-dashed transition-colors flex items-center justify-center relative ${
                          installedParts.includes("gpu")
                            ? "border-slate-600 bg-slate-800/80 shadow-inner translate-y-[-2px]"
                            : STEPS[currentStep]?.id === "gpu" && !isComplete
                              ? "border-cyan-400/50 bg-cyan-400/5 pointer-events-auto"
                              : "border-slate-700 pointer-events-auto"
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDragDrop(e, "gpu")}
                        onClick={(e) => handleSlotClick(e, "gpu")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSlotClick(e, "gpu");
                          }
                        }}
                        role="button"
                        tabIndex={selectedPart ? 0 : -1}
                        aria-label="GPU Slot"
                      >
                        {installedParts.includes("gpu") && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-4 text-cyan-600/50"
                          >
                            <Video size={24} />
                            <span className="font-mono text-xs uppercase font-bold tracking-widest">
                              PCIe RTX
                            </span>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* PSU slot */}
              <div
                className={`h-[120px] rounded border border-dashed flex items-center justify-center transition-colors relative z-10 ${
                  installedParts.includes("psu")
                    ? "border-slate-700 bg-slate-800/60 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]"
                    : STEPS[currentStep]?.id === "psu" && !isComplete
                      ? "border-cyan-400/50 bg-cyan-400/5"
                      : "border-slate-700 bg-slate-800/20"
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDragDrop(e, "psu")}
                onClick={(e) => handleSlotClick(e, "psu")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSlotClick(e, "psu");
                  }
                }}
                role="button"
                tabIndex={selectedPart ? 0 : -1}
                aria-label="PSU Bay"
              >
                {installedParts.includes("psu") && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-4 text-slate-500"
                  >
                    <Power size={32} />
                    <span className="font-mono text-[10px] tracking-widest font-bold uppercase">
                      التغذية
                    </span>
                  </motion.div>
                )}
              </div>
            </div>
          </section>

          {/* Right Panel: Inventory */}
          <aside className="w-full lg:w-72 bg-slate-900/30 border-l border-cyan-500/10 flex flex-col z-10 box-border">
            <div className="p-4 border-b border-cyan-500/10 bg-slate-900/50">
              <h3 className="font-mono text-xs uppercase tracking-widest text-slate-500">
                قائمة القطع
              </h3>
            </div>
            <div className="p-4 flex-1 overflow-y-visible lg:overflow-y-auto grid grid-cols-2 lg:grid-cols-1 gap-3 items-start content-start">
              {Object.values(PARTS).map((part) => {
                const isInstalled = installedParts.includes(part.id);
                const isNext = !isComplete && STEPS[currentStep].id === part.id;

                return (
                  <motion.div
                    key={part.id}
                    layoutId={`inv-${part.id}`}
                    draggable={!isInstalled}
                    onDragStartCapture={(e) => handleDragStart(e, part.id)}
                    role="button"
                    tabIndex={isInstalled ? -1 : 0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!isInstalled)
                          setSelectedPart(
                            selectedPart === part.id ? null : part.id,
                          );
                      }
                    }}
                    onClick={() => {
                      if (!isInstalled)
                        setSelectedPart(
                          selectedPart === part.id ? null : part.id,
                        );
                    }}
                    className={`
                    p-3 rounded-lg flex flex-col md:flex-row lg:flex-row items-center gap-3 border transition-all group select-none focus:outline-none focus:ring-2 focus:ring-cyan-500 relative
                    ${
                      isInstalled
                        ? "bg-slate-800/20 border-slate-800/40 opacity-40 grayscale cursor-not-allowed"
                        : selectedPart === part.id
                          ? "border-cyan-400 bg-cyan-900/30 shadow-[0_0_15px_rgba(34,211,238,0.2)] scale-[0.98]"
                          : "bg-slate-800/40 border-slate-700 opacity-80 cursor-grab hover:bg-cyan-500/5 hover:border-cyan-500/40 hover:opacity-100 active:cursor-grabbing"
                    }
                    ${isNext && !isInstalled && selectedPart !== part.id ? "ring-1 ring-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.1)]" : ""}
                  `}
                    whileHover={
                      !isInstalled && selectedPart !== part.id ? { y: -1 } : {}
                    }
                    whileTap={
                      !isInstalled && selectedPart !== part.id
                        ? { scale: 0.98 }
                        : {}
                    }
                  >
                    {isInstalled && (
                      <div className="absolute top-2 right-2 text-[8px] font-mono uppercase text-slate-600">
                        تم التركيب
                      </div>
                    )}
                    <div
                      className={`w-12 h-12 flex items-center justify-center border border-transparent rounded transition-colors bg-slate-900/50 ${!isInstalled ? "group-hover:border-cyan-500/30" : ""}`}
                    >
                      <div
                        className={`transition-colors ${isInstalled ? "text-slate-600" : selectedPart === part.id ? "text-cyan-400" : "text-slate-500 group-hover:text-cyan-400"}`}
                      >
                        {part.icon}
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[11px] uppercase tracking-wide font-bold transition-colors ${selectedPart === part.id ? "text-cyan-300" : isInstalled ? "text-slate-600" : "text-slate-400 group-hover:text-cyan-300"}`}
                    >
                      {part.name}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
