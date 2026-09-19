import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  obrigatorio?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Campo({ id, rotulo, erro, dica, obrigatorio, className, children }: Props) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {dica && !erro ? <p className="text-muted-foreground text-xs">{dica}</p> : null}
      {erro ? (
        <p id={`${id}-erro`} className="text-destructive text-xs">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
