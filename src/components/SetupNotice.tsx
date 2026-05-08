export function SetupNotice() {
  return (
    <main className="setup-screen">
      <section className="auth-card">
        <p className="eyebrow">Setup required</p>
        <h1>Connect Supabase to run the app.</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code>, add your Supabase project URL and anon key, then run
          the SQL files in <code>supabase/</code>.
        </p>
      </section>
    </main>
  );
}
