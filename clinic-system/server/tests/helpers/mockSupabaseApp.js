let app
let mockSupabase
let scenario
let createdBuilders = []

function getNextResponse(bucket, table, fallback = { data: null, error: null }) {
  if (!bucket[table] || bucket[table].length === 0) {
    return fallback
  }

  return bucket[table].shift()
}

function makeBuilder(table) {
  const builder = {
    table,

    select: jest.fn(function () {
      return this
    }),

    eq: jest.fn(function () {
      return this
    }),

    neq: jest.fn(function () {
      return this
    }),

    in: jest.fn(function () {
      return this
    }),

    or: jest.fn(function () {
      return this
    }),

    order: jest.fn(function () {
      return this
    }),

    limit: jest.fn(function () {
      return this
    }),

    insert: jest.fn(function () {
      return this
    }),

    update: jest.fn(function () {
      return this
    }),

    maybeSingle: jest.fn(function () {
      return Promise.resolve(getNextResponse(scenario.maybeSingle, table))
    }),

    single: jest.fn(function () {
      return Promise.resolve(getNextResponse(scenario.single, table))
    }),

    then(resolve, reject) {
      return Promise.resolve(getNextResponse(scenario.thenable, table)).then(
        resolve,
        reject
      )
    },
  }

  createdBuilders.push(builder)
  return builder
}

function setupMockApp() {
  jest.resetModules()

  createdBuilders = []

  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  scenario = {
    maybeSingle: {},
    single: {},
    thenable: {},
  }

  mockSupabase = {
    from: jest.fn((table) => makeBuilder(table)),
  }

  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase),
  }))

  jest.doMock('../../src/queueNotificationService', () => ({
    configureQueueNotificationService: jest.fn(),
    checkAndTriggerNotifications: jest.fn(() => []),
  }))

  jest.doMock('../../src/emailService', () => ({
    sendAppointmentConfirmationEmail: jest.fn(() =>
      Promise.resolve({ sent: true })
    ),
  }))

  app = require('../../src/app')

  const sendAppointmentConfirmationEmail =
    require('../../src/emailService').sendAppointmentConfirmationEmail

  sendAppointmentConfirmationEmail.mockClear()

  return {
    app,
    mockSupabase,
    scenario,
    createdBuilders,
    sendAppointmentConfirmationEmail,
  }
}

module.exports = {
  setupMockApp,
}