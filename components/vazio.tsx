export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
      {children}
    </div>
  );
}
