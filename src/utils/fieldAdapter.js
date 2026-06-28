const LEGACY_FIELD_PATTERN = /[A-Z]/

const ALLOWED_FIELDS = [
  'user_id',
  'instrument_id',
  'category_id',
  'time_slot_id',
  'booking_id',
  'booking_date',
  'booking_remark',
  'user_role',
  'role',
  'device_id',
  'timestamp',
  'sign',
  'nonce',
  's',
  'app_key',
  'model_name',
  'logic',
  'where',
  'page',
  'perpage',
  'id',
  'data',
  'instrument_name',
  'category_name',
  'category_icon',
  'user_name',
  'employee_no',
  'created_by',
  'created_by_name',
  'scope_type',
  'lock_type',
  'lock_date',
  'lock_reason',
  'start_date',
  'slot_start',
  'slot_end',
  'slot_index',
  'admin_password',
  'custom_slots',
  'booking_advance_days',
  'booking_open_time',
  'user_list',
  'user_key',
  'remark',
  'add_time',
  'update_time',
  'uuid',
  'ext_data',
  'list',
  'total',
  'code',
  'msg',
  'err_code',
  'err_msg',
  'ret',
  'data_type'
]

function isLegacyField(key) {
  return LEGACY_FIELD_PATTERN.test(key)
}

function validateNoLegacyFields(data, path = '') {
  if (!data || typeof data !== 'object') return

  if (Array.isArray(data)) {
    data.forEach((item, index) => validateNoLegacyFields(item, `${path}[${index}]`))
    return
  }

  for (const key of Object.keys(data)) {
    const fullPath = path ? `${path}.${key}` : key
    if (isLegacyField(key)) {
      throw new Error(`Forbidden legacy field detected: ${fullPath}. Use snake_case instead.`)
    }
    if (data[key] && typeof data[key] === 'object') {
      validateNoLegacyFields(data[key], fullPath)
    }
  }
}

export function adaptRequest(data, options = {}) {
  const { strict = true } = options

  if (!data || typeof data !== 'object') return data

  if (strict) {
    validateNoLegacyFields(data)
  }

  if (Array.isArray(data)) {
    return data.map(item => adaptRequest(item, options))
  }

  const result = {}
  for (const [key, value] of Object.entries(data)) {
    if (ALLOWED_FIELDS.includes(key) || key.startsWith('_')) {
      result[key] = adaptRequest(value, options)
    }
  }
  return result
}

export function adaptResponse(data) {
  return data
}

export function toSnakeCase(data, options) {
  return adaptRequest(data, options)
}

export function toCamelCase(data) {
  return adaptResponse(data)
}

export function validateFields(data) {
  const errors = []
  try {
    validateNoLegacyFields(data)
  } catch (e) {
    errors.push({ field: 'legacy', message: e.message })
  }
  return errors
}

export { ALLOWED_FIELDS }

export default {
  adaptRequest,
  adaptResponse,
  toSnakeCase,
  toCamelCase,
  validateFields,
  ALLOWED_FIELDS,
  isLegacyField
}
