import { ref } from 'vue'

export function useLock(delay = 1000) {
  const locked = ref(false)

  const run = async (fn) => {
    if (locked.value) return

    locked.value = true
    try {
      await fn()
    } finally {
      setTimeout(() => {
        locked.value = false
      }, delay)
    }
  }

  return {
    locked,
    run
  }
}

export default useLock
