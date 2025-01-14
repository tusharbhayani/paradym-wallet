import { useQuery } from '@tanstack/react-query'
import { type PropsWithChildren, createContext, useContext, useState } from 'react'

import { KeychainError } from '../error/KeychainError'
import { secureWalletKey } from './secureWalletKey'

const SecureUnlockContext = createContext<SecureUnlockReturn<Record<string, unknown>>>({
  state: 'initializing',
})

export function useSecureUnlock<Context extends Record<string, unknown>>(): SecureUnlockReturn<Context> {
  const value = useContext(SecureUnlockContext)
  if (!value) {
    throw new Error('useSecureUnlock must be wrapped in a <SecureUnlockProvider />')
  }

  return value as SecureUnlockReturn<Context>
}

export function SecureUnlockProvider({ children }: PropsWithChildren) {
  const secureUnlockState = _useSecureUnlockState()

  return (
    <SecureUnlockContext.Provider value={secureUnlockState as SecureUnlockReturn<Record<string, unknown>>}>
      {children}
    </SecureUnlockContext.Provider>
  )
}

export type SecureUnlockState = 'initializing' | 'not-configured' | 'locked' | 'acquired-wallet-key' | 'unlocked'
export type SecureUnlockMethod = 'pin' | 'biometrics'

export type SecureUnlockReturnInitializing = {
  state: 'initializing'
}
export type SecureUnlockReturnNotConfigured = {
  state: 'not-configured'
  setup: (pin: string) => Promise<{ walletKey: string }>
  reinitialize: () => void
}
export type SecureUnlockReturnLocked = {
  state: 'locked'
  tryUnlockingUsingBiometrics: () => Promise<string | null>
  canTryUnlockingUsingBiometrics: boolean
  unlockUsingPin: (pin: string) => Promise<string>
  isUnlocking: boolean
  reinitialize: () => void
}
export type SecureUnlockReturnWalletKeyAcquired<Context extends Record<string, unknown>> = {
  state: 'acquired-wallet-key'
  walletKey: string
  unlockMethod: SecureUnlockMethod
  setWalletKeyValid: (context: Context, options: { enableBiometrics: boolean }) => Promise<void>
  setWalletKeyInvalid: () => void
  reinitialize: () => void
}
export type SecureUnlockReturnUnlocked<Context extends Record<string, unknown>> = {
  state: 'unlocked'
  unlockMethod: SecureUnlockMethod
  context: Context
  lock: () => void
  reinitialize: () => void
}

export type SecureUnlockReturn<Context extends Record<string, unknown>> =
  | SecureUnlockReturnInitializing
  | SecureUnlockReturnNotConfigured
  | SecureUnlockReturnLocked
  | SecureUnlockReturnWalletKeyAcquired<Context>
  | SecureUnlockReturnUnlocked<Context>

function _useSecureUnlockState<Context extends Record<string, unknown>>(): SecureUnlockReturn<Context> {
  const [state, setState] = useState<SecureUnlockState>('initializing')
  const [walletKey, setWalletKey] = useState<string>()
  const [canTryUnlockingUsingBiometrics, setCanTryUnlockingUsingBiometrics] = useState<boolean>(true)
  const [biometricsUnlockAttempts, setBiometricsUnlockAttempts] = useState(0)
  const [canUseBiometrics, setCanUseBiometrics] = useState<boolean>()
  const [unlockMethod, setUnlockMethod] = useState<SecureUnlockMethod>()
  const [context, setContext] = useState<Context>()
  const [isUnlocking, setIsUnlocking] = useState(false)

  useQuery({
    queryFn: async () => {
      const salt = await secureWalletKey.getSalt(secureWalletKey.getWalletKeyVersion())
      // TODO: is salt the best way to test this?

      // We have two params. If e.g. unlocking using biometrics failed, we will
      // set setCanTryUnlockingUsingBiometrics to false, but `setCanUseBiometrics`
      // will still be true (so we can store it)
      const canUseBiometrics = await secureWalletKey.canUseBiometryBackedWalletKey()
      setCanUseBiometrics(canUseBiometrics)
      setCanTryUnlockingUsingBiometrics(canUseBiometrics)

      setState(salt ? 'locked' : 'not-configured')
      return salt
    },
    queryKey: ['wallet_unlock_salt'],
    enabled: state === 'initializing',
  })

  const reinitialize = () => {
    setState('initializing')
    setWalletKey(undefined)
    setCanTryUnlockingUsingBiometrics(true)
    setBiometricsUnlockAttempts(0)
    setCanUseBiometrics(undefined)
    setUnlockMethod(undefined)
    setContext(undefined)
    setIsUnlocking(false)
  }

  if (state === 'acquired-wallet-key') {
    if (!walletKey || !unlockMethod) {
      throw new Error('Missing walletKey or unlockMethod')
    }

    return {
      state,
      walletKey,
      unlockMethod,
      reinitialize,
      setWalletKeyInvalid: () => {
        if (unlockMethod === 'biometrics') {
          setCanTryUnlockingUsingBiometrics(false)
        }

        setState('locked')
        setWalletKey(undefined)
        setUnlockMethod(undefined)
      },
      setWalletKeyValid: async (context, options) => {
        setContext(context)
        setState('unlocked')

        // TODO: need extra option to know whether user wants to use biometrics?
        // TODO: do we need to check whether already stored?
        if (canUseBiometrics && options.enableBiometrics) {
          await secureWalletKey.storeWalletKey(walletKey, secureWalletKey.getWalletKeyVersion())
        }
      },
    }
  }

  if (state === 'unlocked') {
    if (!walletKey || !unlockMethod || !context) {
      throw new Error('Missing walletKey, unlockMethod or context')
    }

    return {
      state,
      context,
      unlockMethod,
      reinitialize,
      lock: () => {
        setState('locked')
        setWalletKey(undefined)
        setUnlockMethod(undefined)
        setContext(undefined)
      },
    }
  }

  if (state === 'locked') {
    return {
      state,
      isUnlocking,
      canTryUnlockingUsingBiometrics,
      reinitialize,
      tryUnlockingUsingBiometrics: async () => {
        // TODO: need to somehow inform user that the unlocking went wrong
        if (!canTryUnlockingUsingBiometrics) return null

        setIsUnlocking(true)
        setBiometricsUnlockAttempts((attempts) => attempts + 1)
        try {
          const walletKey = await secureWalletKey.getWalletKeyUsingBiometrics(secureWalletKey.getWalletKeyVersion())
          if (walletKey) {
            setWalletKey(walletKey)
            setUnlockMethod('biometrics')
            setState('acquired-wallet-key')
          }

          return walletKey
        } catch (error) {
          // If use cancelled we won't allow trying using biometrics again
          if (error instanceof KeychainError && error.reason === 'userCancelled') {
            setCanTryUnlockingUsingBiometrics(false)
          }
          // If other error, we will allow up to three attempts
          else if (biometricsUnlockAttempts > 3) {
            setCanTryUnlockingUsingBiometrics(false)
          }
        } finally {
          setIsUnlocking(false)
        }

        return null
      },
      unlockUsingPin: async (pin: string) => {
        setIsUnlocking(true)
        try {
          const walletKey = await secureWalletKey.getWalletKeyUsingPin(pin, secureWalletKey.getWalletKeyVersion())

          setWalletKey(walletKey)
          setUnlockMethod('pin')
          setState('acquired-wallet-key')

          return walletKey
        } finally {
          setIsUnlocking(false)
        }
      },
    }
  }

  if (state === 'not-configured') {
    return {
      state,
      reinitialize,
      setup: async (pin) => {
        await secureWalletKey.createAndStoreSalt(true, secureWalletKey.getWalletKeyVersion())
        const walletKey = await secureWalletKey.getWalletKeyUsingPin(pin, secureWalletKey.getWalletKeyVersion())

        setWalletKey(walletKey)
        setUnlockMethod('pin')
        setState('acquired-wallet-key')
        return { walletKey }
      },
    }
  }

  return {
    state,
  }
}
