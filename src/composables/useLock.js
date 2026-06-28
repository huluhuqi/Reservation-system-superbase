import { ref } from 'vue'

export function useLock(delay = 1000) {
  const lock = ref(false)

  const run = async (fn) => {
    if (lock.value) return

    lock.value = true
    try {
      await fn()
    } finally {
      setTimeout(() => {
        lock.value = false
      }, delay)
    }
  }

  return {
    lock,
    run
  }
}

export default useLock
