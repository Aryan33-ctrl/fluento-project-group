
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Upload, Mic, FileAudio, X, Info, Sparkles,
  Target, AudioLines, CheckCircle2, ArrowRight
} from 'lucide-react';

import Recorder from '../components/Recorder.jsx';
import { Spinner } from '../components/ui.jsx';
import { practiceApi, errorMessage } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtDuration } from '../utils/format.js';

export const MODES = [
  { id: 'free', label: 'Free Speaking', hint: 'Speak about anything you like.', prompts: ['Tell me about your day', 'Describe something you learned recently', 'Talk about your goals for this year'] },
  { id: 'daily', label: 'Daily Practice', hint: 'Everyday conversation topics.', prompts: ['Describe your morning routine', 'What did you eat today and why?', 'Plan a weekend with friends'] },
  { id: 'interview', label: 'Interview', hint: 'Answer like you’re in a job interview.', prompts: ['Tell me about yourself', 'Describe a challenge you overcame', 'Why should we hire you?', 'Where do you see yourself in five years?'] },
  { id: 'topic', label: 'Topic-Based', hint: 'Give a short talk on a topic.', prompts: ['Is remote work better than office work?', 'How is technology changing education?', 'Describe a person who inspires you'] },
  { id: 'qa', label: 'Q & A', hint: 'Answer a specific question clearly.', prompts: ['What is your biggest strength?', 'Describe a time you led a team', 'How do you handle stress?'] },
];

const MAX_MB = 25;
const ACCEPT = '.webm,.ogg,.wav,.mp3,.m4a,.mp4,audio/*';

export default function StudioPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params] = useSearchParams();

  const [mode, setMode] = useState('free');
  const [topic, setTopic] = useState(params.get('topic') || '');
  const [difficulty, setDifficulty] = useState(user.preferences?.defaultDifficulty || 'intermediate');
  const [input, setInput] = useState('record');
  const [take, setTake] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);

  const fileRef = useRef(null);

  const current = useMemo(
    () => MODES.find((m) => m.id === mode),
    [mode]
  );

  function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';

    if (!f) return;

    if (f.size > MAX_MB * 1024 * 1024) {
      return toast.error(`File is too large (max ${MAX_MB} MB).`);
    }

    if (!/^(audio|video)\//.test(f.type) && !/\.(webm|ogg|wav|mp3|m4a|mp4)$/i.test(f.name)) {
      return toast.error('Please choose an audio file (WebM, OGG, WAV, MP3 or M4A).');
    }

    const url = URL.createObjectURL(f);
    const a = new Audio(url);

    a.onloadedmetadata = () => {
      setTake({
        blob: f,
        duration: Math.round(a.duration || 0),
        name: f.name,
        source: 'upload'
      });
      URL.revokeObjectURL(url);
    };

    a.onerror = () => {
      URL.revokeObjectURL(url);
      setTake({
        blob: f,
        duration: 0,
        name: f.name,
        source: 'upload'
      });
    };
  }

  async function submit() {
    if (!take) return;

    setBusy(true);
    setProgress(0);

    const fd = new FormData();

    fd.append('practiceType', mode);
    fd.append('topic', topic);
    fd.append('difficulty', difficulty);
    fd.append('duration', String(take.duration || 0));
    fd.append('source', take.source);

    const ext = (take.blob.type.split('/')[1] || 'webm').split(';')[0];

    fd.append('audio', take.blob, take.name || `recording.${ext}`);

    try {
      const { id } = await practiceApi.create(fd, (e) => {
        if (e.total) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      toast.success('Uploaded. Analyzing your speech…');
      nav(`/feedback/${id}`);

    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">

      {/* HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-wash via-white to-brand-soft p-6 sm:p-8">

        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-32 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/80 px-3 py-1.5 text-xs font-bold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              AI POWERED PRACTICE
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Speaking Studio<span className="text-brand">.</span>
            </h1>

            <p className="mt-2 max-w-lg text-sm leading-6 text-muted sm:text-base">
              Build confidence, improve fluency and become a better speaker
              with personalized AI feedback.
            </p>
          </div>

          <div className="hidden h-24 w-24 items-center justify-center rounded-3xl border border-brand/20 bg-white/80 shadow-sm sm:flex">
            <AudioLines className="h-12 w-12 text-brand" />
          </div>

        </div>
      </div>


      {/* PRACTICE SETUP */}
      <section className="card rounded-2xl p-5 sm:p-7">

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-wash text-brand">
            <Target className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold">Practice Setup</h2>
            <p className="text-sm text-muted">Choose how you want to practice today.</p>
          </div>
        </div>

        {/* MODES */}
        <div role="radiogroup" aria-label="Practice mode"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

          {MODES.map((m, index) => {
            const active = mode === m.id;

            return (
              <button
                key={m.id}
                role="radio"
                aria-checked={active}
                onClick={() => setMode(m.id)}
                disabled={busy}
                className={`group relative rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed
                  ${active
                    ? 'border-brand bg-brand-wash shadow-sm ring-1 ring-brand/20'
                    : 'border-line bg-white hover:border-brand/40'
                  }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold
                    ${active ? 'bg-brand text-white' : 'bg-brand-soft text-muted'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  {active && <CheckCircle2 className="h-4 w-4 text-brand" />}
                </div>

                <p className={`text-sm font-bold ${active ? 'text-brand-dark' : 'text-ink'}`}>
                  {m.label}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-wash p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p className="text-sm text-muted">{current.hint}</p>
        </div>


        {/* TOPIC AND DIFFICULTY */}
        <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_200px]">

          <div>
            <label htmlFor="topic" className="mb-2 block text-sm font-bold">
              Topic or question
              <span className="ml-1 font-normal text-muted">(optional)</span>
            </label>

            <input
              id="topic"
              className="input transition-all focus:ring-2 focus:ring-brand/20"
              value={topic}
              maxLength={300}
              disabled={busy}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Tell me about yourself"
            />

            <p className="mt-1.5 text-right text-xs text-muted">
              {topic.length}/300
            </p>
          </div>

          <div>
            <label htmlFor="diff" className="mb-2 block text-sm font-bold">
              Difficulty level
            </label>

            <select
              id="diff"
              className="input cursor-pointer transition-all focus:ring-2 focus:ring-brand/20"
              value={difficulty}
              disabled={busy}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>


        {/* SUGGESTED PROMPTS */}
        <div className="mt-5">
          <p className="mb-3 text-sm font-bold text-ink">Suggested topics</p>

          <div className="flex flex-wrap gap-2">
            {current.prompts.map((p) => (
              <button
                key={p}
                onClick={() => setTopic(p)}
                disabled={busy}
                className={`rounded-full border px-3.5 py-2 text-xs font-medium transition-all duration-200
                  ${topic === p
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-white text-muted hover:border-brand hover:bg-brand-wash hover:text-brand'
                  }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

      </section>


      {/* RECORD / UPLOAD */}
      <section className="card rounded-2xl p-5 sm:p-7">

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-wash text-brand">
            <Mic className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold">Your Recording</h2>
            <p className="text-sm text-muted">
              Record your voice or upload an existing audio file.
            </p>
          </div>
        </div>


        {/* TABS */}
        <div className="mb-6 flex gap-2 rounded-xl bg-brand-soft/60 p-1.5">

          {[
            ['record', 'Record', Mic],
            ['upload', 'Upload file', Upload]
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setInput(id);
                setTake(null);
              }}
              disabled={busy}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-all duration-200
                ${input === id
                  ? 'bg-white text-brand shadow-sm'
                  : 'text-muted hover:bg-white/60'
                }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>


        {/* RECORDING COMPONENT */}
        {input === 'record' ? (

          <div className="rounded-2xl border border-line bg-brand-wash/30 p-4 sm:p-6">
            <Recorder
              disabled={busy}
              onComplete={({ blob, duration }) =>
                setTake({ blob, duration, source: 'recording' })
              }
              onReset={() => setTake(null)}
            />
          </div>

        ) : (

          <div className="py-4">

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={onFile}
              aria-label="Choose audio file"
            />

            {take ? (

              <div className="mx-auto flex max-w-lg items-center gap-4 rounded-2xl border border-brand/20 bg-brand-wash p-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
                  <FileAudio className="h-6 w-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{take.name}</p>

                  <p className="mt-1 font-mono text-xs text-muted">
                    {fmtDuration(take.duration)} · {(take.blob.size / 1048576).toFixed(1)} MB
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    File ready
                  </div>
                </div>

                <button
                  onClick={() => setTake(null)}
                  disabled={busy}
                  aria-label="Remove file"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>

              </div>

            ) : (

              <button
                onClick={() => fileRef.current?.click()}
                className="group mx-auto flex w-full max-w-lg flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-brand-wash/20 px-6 py-12 text-muted transition-all duration-300 hover:border-brand hover:bg-brand-wash/60"
              >

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-brand shadow-sm transition-transform duration-300 group-hover:scale-110">
                  <Upload className="h-8 w-8" />
                </div>

                <div>
                  <p className="text-base font-bold text-ink">
                    Choose an audio file
                  </p>

                  <p className="mt-1 text-sm text-muted">
                    Click to browse or select a file
                  </p>
                </div>

                <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-muted">
                  WebM · OGG · WAV · MP3 · M4A
                </span>

                <p className="text-xs text-muted">
                  Maximum file size: {MAX_MB} MB
                </p>

              </button>
            )}

          </div>
        )}


        {/* INFO */}
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand/10 bg-brand-wash/60 p-4">

          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />

          <div>
            <p className="text-sm font-bold text-ink">Recording tips</p>

            <p className="mt-1 text-xs leading-5 text-muted">
              Speak for 30 seconds to 2 minutes in a quiet place.
              Recordings are private to your account.
            </p>
          </div>

        </div>


        {/* PROGRESS */}
        {busy && progress !== null && (

          <div className="mt-6 rounded-xl border border-line bg-brand-wash/30 p-4" role="status">

            <div className="mb-2 flex justify-between text-xs font-bold">
              <span>{progress < 100 ? 'Uploading your recording...' : 'Starting analysis...'}</span>
              <span className="text-brand">{progress}%</span>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-brand-soft">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

          </div>
        )}


        {/* SUBMIT BUTTON */}
        <button
          className="btn-primary group mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!take || busy}
          onClick={submit}
        >

          {busy ? (
            <>
              <Spinner className="h-4 w-4" />
              Submitting...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analyze my speaking
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}

        </button>

        <p className="mt-3 text-center text-xs text-muted">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-green-500" />
          Your recording is securely processed for AI feedback.
        </p>

      </section>

    </div>
  );
}
