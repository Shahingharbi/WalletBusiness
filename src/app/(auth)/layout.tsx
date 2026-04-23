import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/" className="text-2xl sm:text-3xl font-bold text-black">
            aswallet
          </Link>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-5 sm:p-8">{children}</div>

        <p className="text-center text-sm text-gray-500 mt-6 sm:mt-8">
          aswallet &mdash; Fidelisez vos clients
        </p>
      </div>
    </div>
  );
}
