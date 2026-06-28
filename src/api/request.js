import axios from 'axios'
import { adaptRequest } from '../utils/fieldAdapter.js'
import { createSign } from './security.js'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://api.yesapi.net',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
})

service.interceptors.request.use(config => {
  if (config.method === 'post' && config.data && typeof config.data === 'object') {
    const converted = adaptRequest(config.data)

    const bypassThrottle = config.headers['X-Bypass-Throttle'] === 'true'
    delete config.headers['X-Bypass-Throttle']

    const timestamp = Date.now()
    const nonce = Math.random().toString(36).substring(2, 15)

    const signData = { ...converted, timestamp, nonce }
    const sign = createSign(signData)

    const params = new URLSearchParams()
    for (const key of Object.keys(converted)) {
      if (converted[key] !== undefined && converted[key] !== null) {
        params.append(key, converted[key])
      }
    }
    params.append('timestamp', timestamp)
    params.append('nonce', nonce)
    params.append('sign', sign)

    config.data = params
  }
  return config
})

service.interceptors.response.use(
  res => res.data,
  err => {
    console.error('API Error:', err)

    if (err.message === 'Network Error' || !err.response) {
      return Promise.reject({
        type: 'NETWORK_ERROR',
        message: '网络连接失败，请检查后端服务',
        original: err
      })
    }

    if (err.response) {
      return Promise.reject({
        type: 'SERVER_ERROR',
        message: err.response.data?.msg || err.response.statusText || '服务器错误',
        status: err.response.status,
        original: err
      })
    }

    return Promise.reject({
      type: 'UNKNOWN_ERROR',
      message: err.message || '未知错误',
      original: err
    })
  }
)

export default service
