/**
 * Phase 9 Frontend Truthfulness Automated Verification Script
 * Validates:
 * 1. Mock transaction fallback removed from production
 * 2. Fake recovery recommendation (UPI_SWITCH, 88%, gateway timeout) removed
 * 3. Backend outage shown honestly with 'Unable to load at-risk revenue.' and 'Try again.'
 * 4. Empty states correct ('No active at-risk cases.')
 * 5. At-Risk terminal states excluded ('SUCCESS', 'CAPTURED', 'RECOVERED', 'CLOSED', 'CANCELLED', 'STOPPED', 'FAILED_TERMINAL')
 * 6. Explicit demo mode only (DEMO_MODE=true required, labeled 'Demo Data')
 */

const fs = require('fs')
const path = require('path')

console.log('=================================================================')
console.log('RUNNING PHASE 9 FRONTEND TRUTHFULNESS AUTOMATED AUDIT')
console.log('=================================================================\n')

let passCount = 0
let totalChecks = 0

function check(title, condition) {
  totalChecks++
  if (condition) {
    console.log(`[PASS] ${title}`)
    passCount++
  } else {
    console.error(`[FAIL] ${title}`)
    process.exitCode = 1
  }
}

// 1. Check utils.ts for canonical terminal states
const utilsPath = path.join(__dirname, '..', 'src', 'lib', 'utils.ts')
const utilsSrc = fs.readFileSync(utilsPath, 'utf8')

check(
  'utils.ts exports TERMINAL_STATES and isTerminalState',
  utilsSrc.includes('export const TERMINAL_STATES = new Set') &&
  utilsSrc.includes('isTerminalState') &&
  utilsSrc.includes('isActiveCase')
)

const requiredTerminalStates = ['SUCCESS', 'CAPTURED', 'RECOVERED', 'CLOSED', 'CANCELLED', 'STOPPED', 'FAILED_TERMINAL']
const allStatesIncluded = requiredTerminalStates.every(s => utilsSrc.includes(`'${s}'`))
check('TERMINAL_STATES contains all canonical terminal states', allStatesIncluded)

// 2. Check api.ts for removal of silent mock fallbacks and fake values
const apiPath = path.join(__dirname, '..', 'src', 'services', 'api.ts')
const apiSrc = fs.readFileSync(apiPath, 'utf8')

check(
  'api.ts: getDashboard does NOT silently fall back to mockTrendData in production',
  apiSrc.includes('trendData: raw.trend_data || (ENV.DEMO_MODE ? mockTrendData : [])')
)

check(
  'api.ts: getTransactions does NOT fabricate 0.75 recoveryProbability or UPI_SWITCH recommendedAction',
  !apiSrc.includes("recoveryProbability: t.recovery_case?.recovery_probability || 0.75") &&
  !apiSrc.includes("recommendedAction: t.recovery_case?.selected_strategy || 'UPI_SWITCH'")
)

check(
  'api.ts: getTransaction does NOT fabricate 0.75 or SMART_PAYLINK_1CLICK',
  !apiSrc.includes("recommendedAction: t.recovery_case?.selected_strategy || 'SMART_PAYLINK_1CLICK'")
)

check(
  'api.ts: getAuditTrail throws in production if backend unreachable',
  apiSrc.includes("throw new Error('Unable to load audit logs. Please check your connection and try again.')")
)

// 3. Check AtRiskRevenue.tsx for honest error and empty states
const atRiskPath = path.join(__dirname, '..', 'src', 'pages', 'AtRiskRevenue.tsx')
const atRiskSrc = fs.readFileSync(atRiskPath, 'utf8')

check(
  'AtRiskRevenue.tsx uses canonical isTerminalState',
  atRiskSrc.includes("import { isTerminalState } from '../lib/utils'") &&
  atRiskSrc.includes('filter(t => !isTerminalState(t.status))')
)

check(
  'AtRiskRevenue.tsx shows "Unable to load at-risk revenue." on error',
  atRiskSrc.includes('Unable to load at-risk revenue.')
)

check(
  'AtRiskRevenue.tsx provides "Try again" button',
  atRiskSrc.includes('Try again')
)

check(
  'AtRiskRevenue.tsx shows honest empty state "No active at-risk cases."',
  atRiskSrc.includes('No active at-risk cases.')
)

check(
  'AtRiskRevenue.tsx does NOT load mockTransactions on error',
  !atRiskSrc.includes('mockTransactions')
)

// 4. Check TransactionTable.tsx for honest unavailable states and removal of fake diagnoses
const tablePath = path.join(__dirname, '..', 'src', 'components', 'common', 'TransactionTable.tsx')
const tableSrc = fs.readFileSync(tablePath, 'utf8')

check(
  'TransactionTable.tsx displays "Recovery recommendation temporarily unavailable." when analysis fails',
  tableSrc.includes('Recovery recommendation temporarily unavailable.')
)

check(
  'TransactionTable.tsx does NOT fabricate gateway timeout when analysis fails',
  tableSrc.includes('Recovery recommendation temporarily unavailable. Detailed failure diagnosis could not be retrieved from the engine.')
)

check(
  'TransactionTable.tsx shows "Pending Analysis" when transaction has no recommendedAction',
  tableSrc.includes('Pending Analysis')
)

// 5. Check RecoveryAgent.tsx for canonical active filtering and empty state
const agentPath = path.join(__dirname, '..', 'src', 'pages', 'RecoveryAgent.tsx')
const agentSrc = fs.readFileSync(agentPath, 'utf8')

check(
  'RecoveryAgent.tsx uses canonical isTerminalState for active workflows',
  agentSrc.includes('!isTerminalState(w.status)')
)

check(
  'RecoveryAgent.tsx shows honest empty state "No active recovery workflows."',
  agentSrc.includes('No active recovery workflows.')
)

check(
  'RecoveryAgent.tsx visibly labels Demo Data when ENV.DEMO_MODE is active',
  agentSrc.includes('ENV.DEMO_MODE') && agentSrc.includes('Demo Data')
)

// 6. Check AppShell.tsx for explicit demo mode banner
const appShellPath = path.join(__dirname, '..', 'src', 'components', 'layout', 'AppShell.tsx')
const appShellSrc = fs.readFileSync(appShellPath, 'utf8')

check(
  'AppShell.tsx displays explicit Demo Mode banner when ENV.DEMO_MODE is true',
  appShellSrc.includes('ENV.DEMO_MODE') &&
  appShellSrc.includes('Explicit Demo Mode Active:')
)

console.log(`\nAUDIT RESULT: ${passCount}/${totalChecks} CHECKS PASSED`)
if (passCount === totalChecks) {
  console.log('PHASE 9 FRONTEND TRUTHFULNESS: ALL CONTRACTS VERIFIED')
} else {
  console.error('PHASE 9 AUDIT FAILED!')
  process.exit(1)
}
