function App() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#111214] text-white">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-10 py-8 shadow-2xl shadow-violet-950/30">
        <div className="mb-3 text-sm font-medium uppercase tracking-[0.35em] text-violet-300">
          Vector
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          Messenger client is ready
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400">
          React, TypeScript, Vite, Tailwind and Electron base setup.
        </p>
      </div>
    </div>
  );
}

export default App;