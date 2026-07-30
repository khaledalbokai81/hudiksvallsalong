export function buildActiveBookingFilter(
  extraFilter: Record<string, unknown> = {},
  now = new Date()
) {
  return {
    $and: [
      { $or: [{ status: "open" }, { status: { $exists: false } }] },
      {
        $nor: [
          {
            emailVerified: false,
            emailVerificationExpiresAt: { $exists: true, $lte: now }
          }
        ]
      },
      extraFilter
    ]
  };
}

export function buildExpiredUnverifiedBookingFilter(now = new Date()) {
  return {
    emailVerified: false,
    emailVerificationExpiresAt: { $exists: true, $lte: now },
    $or: [{ status: "open" }, { status: { $exists: false } }]
  };
}
