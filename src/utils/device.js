const DEVICE_ID_KEY = 'kg7500_device_id'

export function getDeviceId() {
  let device_id = localStorage.getItem(DEVICE_ID_KEY)
  if (!device_id) {
    device_id = `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(DEVICE_ID_KEY, device_id)
  }
  return device_id
}

export function getSubmissionStorageKey(device_id) {
  return `kg7500_submission_logs_${device_id}`
}

export function readSubmissionLogs(device_id) {
  try {
    const raw = localStorage.getItem(getSubmissionStorageKey(device_id))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function writeSubmissionLogs(device_id, logs) {
  localStorage.setItem(getSubmissionStorageKey(device_id), JSON.stringify(logs))
}

export function createLogId() {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export default {
  getDeviceId,
  getSubmissionStorageKey,
  readSubmissionLogs,
  writeSubmissionLogs,
  createLogId
}
