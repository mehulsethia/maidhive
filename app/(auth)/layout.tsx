export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md bg-background rounded-xl border shadow-sm p-8">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-primary">MaidHive</span>
        </div>
        {children}
      </div>
    </div>
  )
}
