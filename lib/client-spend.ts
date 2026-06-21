type ClientPaymentForSpend = {
  status?: string | null
  amount?: unknown
  refundAmount?: unknown
}

function money(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

export function getClientTotalSpent(payments: ClientPaymentForSpend[]) {
  const total = payments.reduce((sum, payment) => {
    if (!['captured', 'transferred', 'partially_refunded'].includes(String(payment.status ?? ''))) {
      return sum
    }

    return sum + Math.max(0, money(payment.amount) - money(payment.refundAmount))
  }, 0)

  return Math.round(total * 100) / 100
}
