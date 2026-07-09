import * as React from 'react';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// A labeled form field: label (+ optional required marker + (i) info tooltip) above the
// control. Helper text lives in the tooltip, not on its own line. Standardizes every form row.
export function Field({
    label,
    info,
    required,
    htmlFor,
    full,
    className,
    children,
}: {
    label: string;
    info?: React.ReactNode;
    required?: boolean;
    htmlFor?: string;
    full?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn('space-y-1.5', full && 'col-span-2', className)}>
            <Label htmlFor={htmlFor} className="flex items-center gap-1">
                {label}
                {required && <span className="text-destructive">*</span>}
                {info && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button type="button" tabIndex={0} aria-label="More info" className="text-muted-foreground hover:text-foreground">
                                <Info className="h-3.5 w-3.5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{info}</TooltipContent>
                    </Tooltip>
                )}
            </Label>
            {children}
        </div>
    );
}
