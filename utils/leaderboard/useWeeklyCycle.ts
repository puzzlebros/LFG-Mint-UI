// utils/metaplex/useWeeklyCycle.ts
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ──────────────────────────────────────────────────────────────────────────────
// 1) The pure cycle logic, defined exactly once:
// ──────────────────────────────────────────────────────────────────────────────
export function getWeeklyCycle(now = new Date()) {
  const y       = now.getUTCFullYear()
  const m       = now.getUTCMonth()
  const d       = now.getUTCDate()
  const wd      = now.getUTCDay()            // 0=Sun…6=Sat
  const daysOff = (wd - 6 + 7) % 7           // how many days since Saturday

  // Saturday @ 00:00 UTC — end of Friday, start of weekend freeze
  const satUTC = new Date(Date.UTC(y, m, d - daysOff, 0, 0, 0, 0))
  // Monday @ 00:00 UTC — end of Sunday, leaderboard clears here
  const monUTC = new Date(satUTC.getTime() + 2 * MS_PER_DAY)
  // are we in [Sat00, Mon00)?
  const isFrozen = now >= satUTC && now < monUTC

  return { satUTC, monUTC, isFrozen }
}

/** convenience export */
export function isWeeklyFrozen(now?: Date) {
  return getWeeklyCycle(now).isFrozen
}

// ──────────────────────────────────────────────────────────────────────────────
// 2) Your hook now just **uses** that logic—no duplication!
// ──────────────────────────────────────────────────────────────────────────────
export function useWeeklyCycle() {
  const [isFrozen,  setIsFrozen]  = useState(false)
  const [next,      setNext]      = useState<Date>(new Date())
  const [countdown, setCountdown] = useState<string>('')
  const router = useRouter()

  // debug override?
  const isFreezeDebug =
    process.env.NODE_ENV === 'development' &&
    router.query.freeze === 'true'

  useEffect(() => {
    if (isFreezeDebug) {
      setIsFrozen(true)
      return
    }

    const tick = () => {
      const now = new Date()
      // **reuse** your shared logic:
      const { satUTC, monUTC, isFrozen } = getWeeklyCycle(now)

      setIsFrozen(isFrozen)

      // pick the next transition point
      let nextTransition: Date
      if (now < satUTC)      nextTransition = satUTC
      else if (now < monUTC) nextTransition = monUTC
      else                   nextTransition = new Date(satUTC.getTime() + 7 * MS_PER_DAY)

      setNext(nextTransition)

      // build a simple “xxh yym” countdown
      const diffMs = nextTransition.getTime() - now.getTime()
      const hrs    = Math.floor(diffMs / (60*60*1000))
      const mins   = Math.floor((diffMs % (60*60*1000)) / (60*1000))
      setCountdown(`${hrs}h ${mins}m`)
    }

    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [isFreezeDebug])

  return { isFrozen, next, countdown }
}

