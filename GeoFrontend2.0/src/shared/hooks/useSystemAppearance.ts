import { useEffect } from 'react'
import { useAppearanceStore } from '../stores/appearanceStore'

export function useSystemAppearance() {
  const appearance = useAppearanceStore((s) => s.appearance)
  const setResolvedAppearance = useAppearanceStore((s) => s.setResolvedAppearance)

  useEffect(() => {
    if (appearance !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => {
      setResolvedAppearance(media.matches ? 'dark' : 'light')
    }

    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [appearance, setResolvedAppearance])
}
