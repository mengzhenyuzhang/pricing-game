import { loginAction } from "@/lib/admin-actions";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="mx-auto max-w-md">
      <section className="panel p-6">
        <h1 className="text-3xl font-black">Instructor Login</h1>
        <form action={loginAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="label">Admin password</span>
            <input className="input mt-1" name="password" type="password" autoFocus />
          </label>
          <button className="btn-primary w-full">Login</button>
        </form>
        {searchParams.error ? <p className="mt-4 rounded-md bg-red-50 p-3 font-semibold text-red-700">Password was not accepted.</p> : null}
      </section>
    </div>
  );
}
