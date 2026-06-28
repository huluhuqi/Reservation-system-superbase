import axios from 'axios'
import { adaptRequest } from '../utils/fieldAdapter.js'
import { securityGateway } from './security.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://api.yesapi.net'

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
})

request.interceptors.request.use(config => {
  if (config.method === 'post' && config.data && typeof config.data === 'object') {
    const converted = adaptRequest(config.data)

    const bypassThrottle = config.headers['X-Bypass-Throttle'] === 'true'

    const secured = securityGateway(converted, {
      enableThrottle: !bypassThrottle,
      enableNonce: true,
      enableSign: true,
      strict: false
    })

    const params = new URLSearchParams()
    for (const key of Object.keys(secured)) {
      params.append(key, secured[key])
    }
    config.data = params
  }
  return config
})

request.interceptors.response.use(
  res => {
    return res.data
  },
  error => {
    if (error.message === 'Network Error' || !error.response) {
      return Promise.reject({
        type: 'NETWORK_ERROR',
        message: '网络连接失败，请检查网络或后端服务',
        original: error
      })
    }

    if (error.response) {
      return Promise.reject({
        type: 'SERVER_ERROR',
        message: error.response.data?.msg || error.response.statusText || '服务器错误',
        status: error.response.status,
        original: error
      })
    }

    return Promise.reject({
      type: 'UNKNOWN_ERROR',
      message: error.message || '未知错误',
      original: error
    })
  }
)

export default request
