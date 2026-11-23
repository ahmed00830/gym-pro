'use strict'

const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { existsSync, readFileSync, statSync } = require('node:fs')
const path = require('node:path')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const ELECTRON_EXECUTABLE = require('electron')
const DEBUG_PORT = 9337
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}/json/list`
const EXPECTED_USER_DATA = path.join(
  process.env.APPDATA || '',
  'GYM PRO'
)

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForTarget(timeoutMs = 30_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(DEBUG_URL)
      if (response.ok) {
        const targets = await response.json()
        const page = targets.find((target) => target.type === 'page')
        if (page) return page
      }
    } catch {
      // The app may still be starting.
    }

    await delay(250)
  }

  throw new Error('Timed out waiting for the production Electron window.')
}

async function connectToPage(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  let nextId = 0
  const pending = new Map()
  const consoleMessages = []

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)

    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)

      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)

      return
    }

    if (message.method === 'Runtime.exceptionThrown') {
      consoleMessages.push({
        type: 'exception',
        text: message.params.exceptionDetails.text
      })
    }

    if (message.method === 'Log.entryAdded') {
      consoleMessages.push({
        type: message.params.entry.level,
        text: message.params.entry.text
      })
    }
  })

  socket.addEventListener('close', () => {
    for (const { reject } of pending.values()) {
      reject(new Error('The Electron debug connection closed unexpectedly.'))
    }

    pending.clear()
  })

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (socket.readyState !== WebSocket.OPEN) {
        reject(new Error('The Electron debug connection is not open.'))
        return
      }

      const id = ++nextId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    })

    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text
      )
    }

    return result.result.value
  }

  await send('Runtime.enable')
  await send('Log.enable')

  return { socket, send, evaluate, consoleMessages }
}

function waitForExit(child, timeoutMs = 15_000) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode)

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), timeoutMs)
    child.once('exit', (code) => {
      clearTimeout(timeout)
      resolve(code)
    })
  })
}

async function closeApplication(client, child) {
  // `Browser.close` shuts the app down before it can acknowledge the CDP
  // message, so waiting for a reply can hang forever. Shut down best-effort
  // and then make sure the process is gone.
  await Promise.race([
    client.send('Browser.close').catch(() => undefined),
    delay(2_000)
  ])

  const exitCode = await waitForExit(child, 2_000)

  if (exitCode === null) {
    child.kill()
    await waitForExit(child, 5_000)
  }
}

async function launchAndInspect(label) {
  const output = { stdout: '', stderr: '' }
  const childEnvironment = {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: '1'
  }
  delete childEnvironment.ELECTRON_RENDERER_URL

  const child = spawn(
    ELECTRON_EXECUTABLE,
    ['.', `--remote-debugging-port=${DEBUG_PORT}`],
    {
      cwd: PROJECT_ROOT,
      env: childEnvironment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    }
  )

  child.stdout.on('data', (chunk) => {
    output.stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    output.stderr += chunk.toString()
  })

  let client = null

  try {
    const target = await waitForTarget()
    client = await connectToPage(target)

    const ready = await client.evaluate(`new Promise((resolve) => {
      const startedAt = Date.now()
      const check = () => {
        if (document.readyState === 'complete' && window.gymPro?.database) {
          resolve(true)
        } else if (Date.now() - startedAt > 10_000) {
          resolve(false)
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    })`)

    assert.equal(ready, true, 'Renderer bridge did not become ready.')

    const rendererSecurity = await client.evaluate(`(() => {
      const databaseApi = window.gymPro?.database
      const appApi = window.gymPro?.app
      const analyticsApi = window.gymPro?.analytics
      const membersApi = window.gymPro?.members
      const plansApi = window.gymPro?.plans
      const subscriptionsApi = window.gymPro?.subscriptions
      const attendanceApi = window.gymPro?.attendance
      const expensesApi = window.gymPro?.expenses
      const forbiddenNames = [
        'query', 'execute', 'exec', 'prepare', 'open', 'close',
        'run', 'get', 'all', 'transaction', 'connection', 'database'
      ]

      return {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        apiKeys: Object.keys(window.gymPro || {}).sort(),
        databaseKeys: Object.keys(databaseApi || {}).sort(),
        databaseMethodsAreFunctions:
          ['healthCheck', 'getInitializationStatus', 'getInfo']
            .every((name) => typeof databaseApi?.[name] === 'function'),
        analyticsKeys: Object.keys(analyticsApi || {}).sort(),
        analyticsMethodsAreFunctions:
          ['getRangeReport', 'getSnapshot']
            .every((name) => typeof analyticsApi?.[name] === 'function'),
        membersKeys: Object.keys(membersApi || {}).sort(),
        membersMethodsAreFunctions:
          ['create', 'update', 'delete']
            .every((name) => typeof membersApi?.[name] === 'function'),
        plansKeys: Object.keys(plansApi || {}).sort(),
        plansMethodsAreFunctions:
          ['create', 'update', 'setActive']
            .every((name) => typeof plansApi?.[name] === 'function'),
        subscriptionsKeys: Object.keys(subscriptionsApi || {}).sort(),
        subscriptionsMethodsAreFunctions:
          ['create', 'freeze', 'resume', 'cancel', 'recordPayment']
            .every((name) => typeof subscriptionsApi?.[name] === 'function'),
        hasForbiddenDatabaseMethods:
          forbiddenNames.filter((name) => name in (databaseApi || {})),
        databaseFrozen: Object.isFrozen(databaseApi),
        appFrozen: Object.isFrozen(appApi),
        analyticsFrozen: Object.isFrozen(analyticsApi),
        membersFrozen: Object.isFrozen(membersApi),
        plansFrozen: Object.isFrozen(plansApi),
        subscriptionsFrozen: Object.isFrozen(subscriptionsApi),
        attendanceKeys: Object.keys(attendanceApi || {}).sort(),
        attendanceMethodsAreFunctions:
          ['register']
            .every((name) => typeof attendanceApi?.[name] === 'function'),
        attendanceFrozen: Object.isFrozen(attendanceApi),
        expensesKeys: Object.keys(expensesApi || {}).sort(),
        expensesMethodsAreFunctions:
          ['archive', 'create', 'createCategory', 'renameCategory', 'setCategoryActive', 'update']
            .every((name) => typeof expensesApi?.[name] === 'function'),
        expensesFrozen: Object.isFrozen(expensesApi),
        nodeGlobals: {
          require: typeof require,
          process: typeof process,
          module: typeof module,
          Buffer: typeof Buffer,
          electron: typeof electron,
          ipcRenderer: typeof ipcRenderer
        }
      }
    })()`)

    const initializationStatus = await client.evaluate(
      'window.gymPro.database.getInitializationStatus()'
    )
    const health = await client.evaluate(
      'window.gymPro.database.healthCheck()'
    )
    const info = await client.evaluate('window.gymPro.database.getInfo()')
    const snapshot = await client.evaluate(
      'window.gymPro.analytics.getSnapshot()'
    )

    assert.deepEqual(rendererSecurity.apiKeys, ['analytics', 'app', 'attendance', 'database', 'expenses', 'members', 'plans', 'subscriptions'])
    assert.deepEqual(rendererSecurity.databaseKeys.sort(), [
      'getInfo',
      'getInitializationStatus',
      'healthCheck'
    ])
    assert.deepEqual(rendererSecurity.analyticsKeys, ['getRangeReport', 'getSnapshot'])
    assert.deepEqual(rendererSecurity.membersKeys, ['create', 'delete', 'quickRegister', 'update'])
    assert.deepEqual(rendererSecurity.plansKeys, ['create', 'setActive', 'update'])
    assert.deepEqual(rendererSecurity.subscriptionsKeys, ['cancel', 'create', 'freeze', 'quickRenew', 'recordPayment', 'resume'])
    assert.deepEqual(rendererSecurity.attendanceKeys, ['register'])
    assert.equal(rendererSecurity.databaseMethodsAreFunctions, true)
    assert.equal(rendererSecurity.analyticsMethodsAreFunctions, true)
    assert.equal(rendererSecurity.membersMethodsAreFunctions, true)
    assert.equal(rendererSecurity.plansMethodsAreFunctions, true)
    assert.equal(rendererSecurity.subscriptionsMethodsAreFunctions, true)
    assert.equal(rendererSecurity.attendanceMethodsAreFunctions, true)
    assert.deepEqual(rendererSecurity.hasForbiddenDatabaseMethods, [])
    assert.equal(rendererSecurity.databaseFrozen, true)
    assert.equal(rendererSecurity.appFrozen, true)
    assert.equal(rendererSecurity.analyticsFrozen, true)
    assert.equal(rendererSecurity.membersFrozen, true)
    assert.equal(rendererSecurity.plansFrozen, true)
    assert.equal(rendererSecurity.subscriptionsFrozen, true)
    assert.equal(rendererSecurity.attendanceFrozen, true)
    assert.deepEqual(rendererSecurity.expensesKeys, ['archive', 'create', 'createCategory', 'renameCategory', 'setCategoryActive', 'update'])
    assert.equal(rendererSecurity.expensesMethodsAreFunctions, true)
    assert.equal(rendererSecurity.expensesFrozen, true)
    assert.equal(rendererSecurity.url.startsWith('file://'), true)
    assert.ok(
      rendererSecurity.url.includes('/out/renderer/index.html'),
      'Production renderer was not loaded from the built files.'
    )
    assert.deepEqual(rendererSecurity.nodeGlobals, {
      require: 'undefined',
      process: 'undefined',
      module: 'undefined',
      Buffer: 'undefined',
      electron: 'undefined',
      ipcRenderer: 'undefined'
    })

    assert.equal(initializationStatus.state, 'ready')
    assert.equal(initializationStatus.initialized, true)
    assert.equal(initializationStatus.schemaVersion, 9)
    assert.equal(initializationStatus.pendingMigrationCount, 0)
    assert.equal(initializationStatus.error, null)
    assert.equal(health.ok, true)
    assert.equal(health.integrityCheck, 'ok')
    assert.equal(health.foreignKeyViolations, 0)
    assert.equal(health.foreignKeysEnabled, true)
    assert.equal(info.engine, 'SQLite')
    assert.equal(info.fileName, 'gym-pro.db')
    assert.equal(info.schemaVersion, 9)
    assert.equal(info.applicationTableCount, 13)

    assert.match(
      snapshot.generatedAt,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    )
    assert.deepEqual(Object.keys(snapshot).sort(), [
      'attendance',
      'attendanceSeries',
      'expenseCatalog',
      'expenseCategories',
      'expenses',
      'freezes',
      'generatedAt',
      'memberStatusCounts',
      'members',
      'monthlyReport',
      'notifications',
      'paymentMethods',
      'payments',
      'plans',
      'renewals',
      'settings',
      'subscriptions',
      'totals'
    ])
    for (const [name, value] of Object.entries(snapshot.totals)) {
      assert.equal(typeof value, 'number', `Snapshot total ${name} is not numeric.`)
      assert.ok(value >= 0, `Snapshot total ${name} is negative.`)
    }
    assert.equal(snapshot.attendanceSeries.length, 7)
    assert.equal(snapshot.monthlyReport.length, 6)
    for (const collection of [
      snapshot.members,
      snapshot.memberStatusCounts,
      snapshot.plans,
      snapshot.subscriptions,
      snapshot.renewals,
      snapshot.payments,
      snapshot.attendance,
      snapshot.expenses,
      snapshot.notifications,
      snapshot.settings,
      snapshot.paymentMethods,
      snapshot.expenseCategories
    ]) {
      assert.ok(Array.isArray(collection))
    }

    const expectedDatabasePath = path.join(EXPECTED_USER_DATA, 'gym-pro.db')
    assert.equal(
      info.filePath.toLowerCase(),
      expectedDatabasePath.toLowerCase(),
      'The database is not stored in the Electron userData directory.'
    )
    assert.equal(
      info.filePath.toLowerCase().startsWith(PROJECT_ROOT.toLowerCase()),
      false,
      'The database must not live in the project/source directory.'
    )
    assert.equal(existsSync(path.join(PROJECT_ROOT, 'gym-pro.db')), false)
    assert.equal(existsSync(info.filePath), true)
    assert.ok(statSync(info.filePath).size > 0)
    assert.equal(
      readFileSync(info.filePath).subarray(0, 15).toString('utf8'),
      'SQLite format 3'
    )

    assert.deepEqual(client.consoleMessages, [])

    await closeApplication(client, child)
    client = null

    return { label, rendererSecurity, initializationStatus, health, info }
  } catch (error) {
    if (client) {
      try {
        await closeApplication(client, child)
      } catch {
        // Preserve the original assertion error.
      }
    } else if (child.exitCode === null) {
      child.kill()
    }

    console.error(`--- ${label} Electron stdout ---\n${output.stdout}`)
    console.error(`--- ${label} Electron stderr ---\n${output.stderr}`)
    throw error
  }
}

async function main() {
  const firstLaunch = await launchAndInspect('first launch')
  const secondLaunch = await launchAndInspect('restart')

  assert.equal(secondLaunch.info.filePath, firstLaunch.info.filePath)
  assert.equal(secondLaunch.initializationStatus.state, 'ready')
  assert.equal(
    secondLaunch.initializationStatus.appliedMigrations.length,
    firstLaunch.initializationStatus.appliedMigrations.length
  )

  console.log('PASS  production build initializes the database in userData')
  console.log('PASS  approved database IPC is healthy in the production build')
  console.log('PASS  renderer has no raw database, SQL, Node, or IPC access')
  console.log('PASS  database persists across a production Electron restart')
  console.log('\nProduction database path:')
  console.log(firstLaunch.info.filePath)
}

main().catch((error) => {
  console.error('\nFAIL  production database verification')
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
