import StationMap from "@/app/components/StationMap";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-bold text-black dark:text-white">GasMeUp</h1>
        {session?.user ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Signed in as {session.user.name}
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Not signed in</p>
        )}
      </header>
      <main className="flex-1">
        <StationMap />
      </main>
    </div>
  );
}