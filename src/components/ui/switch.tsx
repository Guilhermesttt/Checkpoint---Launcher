'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'
import { usePreferences } from '../../context/PreferencesContext'
import { useSoundEffects } from '../../hooks/useSoundEffects'

function Switch({
  className,
  checked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const { effectsVolume, soundTheme } = usePreferences();
  const { playSound } = useSoundEffects(effectsVolume / 100, soundTheme);

  const handleCheckedChange = (nextChecked: boolean) => {
    playSound(nextChecked ? "switchOn" : "switchOff");
    onCheckedChange?.(nextChecked);
  };

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      onCheckedChange={handleCheckedChange}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--launcher-accent))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[rgb(var(--launcher-accent))] data-[state=unchecked]:bg-white/20',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
