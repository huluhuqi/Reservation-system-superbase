import axios from 'axios'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://api.yesapi.net',
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
