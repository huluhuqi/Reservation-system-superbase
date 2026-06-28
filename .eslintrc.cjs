module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "Identifier[name=/^(userId|userID|instrumentId|instrumentID|categoryId|categoryID|timeSlotId|timeSlotID|timeslotId|bookingId|bookingID|bookingDate|bookingRemark|userName|userRole|employeeNo|createdBy|createdByName|scopeType|lockType|lockDate|lockReason|startDate|slotStart|slotEnd|slotIndex|adminPassword|customSlots|bookingAdvanceDays|bookingOpenTime|deviceId|recordId|recordID|instrumentName|categoryName|categoryIcon)$/]",
        message: '❌ 禁止使用旧字段（camelCase），请使用 snake_case 格式，如 user_id、instrument_id、booking_date 等'
      }
    ],
    'vue/no-restricted-syntax': [
      'error',
      {
        selector: "VIdentifier[name=/^(userId|userID|instrumentId|instrumentID|categoryId|categoryID|timeSlotId|timeSlotID|timeslotId|bookingId|bookingID|bookingDate|bookingRemark|userName|userRole|employeeNo|createdBy|createdByName|scopeType|lockType|lockDate|lockReason|startDate|slotStart|slotEnd|slotIndex|adminPassword|customSlots|bookingAdvanceDays|bookingOpenTime|deviceId|recordId|recordID|instrumentName|categoryName|categoryIcon)$/]",
        message: '❌ 禁止使用旧字段（camelCase），请使用 snake_case 格式，如 user_id、instrument_id、booking_date 等'
      }
    ]
  }
}
