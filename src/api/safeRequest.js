import request from './request.js'

export function safePost(url, data = {}) {

  if (data.__admin) {
    return request.post(url, data)
  }

  return request.post(url, data)
}

export function safeGet(url, params = {}) {
  return safePost(url, params)
}

export default {
  safePost,
  safeGet
}
