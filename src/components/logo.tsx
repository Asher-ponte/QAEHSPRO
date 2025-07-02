import { BrainCog } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-primary text-primary-foreground p-2 rounded-lg">
        <BrainCog className="h-6 w-6" />
      </div>
      <span className="text-xl font-bold font-headline text-primary">
        QAEHS PRO
      </span>
    </div>
  );
}
