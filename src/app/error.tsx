"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="screen empty-state"><div>!</div><h2>Something went wrong</h2><p>RX Tasks could not load this screen. Your data is safe.</p><button className="primary-button" onClick={reset}>Try again</button></div>; }
