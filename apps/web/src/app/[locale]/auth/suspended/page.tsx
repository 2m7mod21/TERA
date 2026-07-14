import { signOut } from "@/server/auth/config";

export const metadata = { title: "Account Suspended — TERA" };

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
          <span className="text-4xl">🚫</span>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Your Account Has Been Suspended
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Your account has been temporarily suspended due to a policy
            violation. You cannot access TERA during the suspension period.
          </p>
        </div>

        {/* Info box */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-left space-y-2">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            During suspension you cannot:
          </p>
          <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
            <li>Access your feed, profile, or messages</li>
            <li>Post, comment, or interact with content</li>
            <li>Follow or message other users</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <p className="text-zinc-500 text-xs">
            If you believe this suspension is in error, please reach out to our support team.
          </p>
          <a
            href="mailto:support@tera.app"
            className="px-6 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Appeal Suspension
          </a>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/auth/login" });
            }}
          >
            <button
              type="submit"
              className="w-full px-6 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-850 text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
