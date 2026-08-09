import { useState } from 'react'

export type HydrationStatus = 'loading' | 'ready'

export function usePersistenceController(hasStorage: boolean) {
  const [storageError, setStorageError] = useState('')
  const [isClearingWorkspace, setIsClearingWorkspace] = useState(false)
  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>(
    hasStorage ? 'loading' : 'ready',
  )

  return {
    storageError,
    setStorageError,
    isClearingWorkspace,
    setIsClearingWorkspace,
    hydrationStatus,
    setHydrationStatus,
  }
}
