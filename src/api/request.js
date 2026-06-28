import axios from 'axios'
import config from '../config/api'

const service = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: 10000
})

service.interceptors.response.use(
  res => res.data,
  err => {
    console.error('Network Error:', err)

    return Promise.reject({
      type: 'NETWORK_ERROR',
      message: '网络连接失败，请检查后端服务'
    })
  }
)

export default service
