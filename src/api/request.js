import axios from 'axios'
import { adaptRequest } from '../utils/fieldAdapter.js'
import { securityGateway } from './security.js'

const request = axios.create({
  baseURL: 'https://api.yesapi.net',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
})

request.interceptors.request.use(config => {
  if (config.method === 'post' && config.data && typeof config.data === 'object') {
    const converted = adaptRequest(config.data)

    const secured = securityGateway(converted, {
      enableThrottle: true,
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
    return Promise.reject(error)
  }
)

export default request
