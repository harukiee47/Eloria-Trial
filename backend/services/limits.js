export const PLANS = {
  free: {
    messages: 50,
    codeRequests: 10,
    imageRequests: 4,
    voiceTurns: 10,
    githubActions: 5,
    githubToolCallsPerTurn: 6,
    eloriaCodeAccess: false,
    browsingSessions: 3,
    eloriaWebAccess: false,
  },

  pro: {
    messages: 100,
    codeRequests: 25,
    imageRequests: 12,
    voiceTurns: 30,
    githubActions: 30,
    githubToolCallsPerTurn: 15,
    eloriaCodeAccess: true,
    browsingSessions: 20,
    eloriaWebAccess: true,
  },

  admin: {
    messages: Infinity,
    codeRequests: Infinity,
    imageRequests: Infinity,
    voiceTurns: Infinity,
    githubActions: Infinity,
    githubToolCallsPerTurn: Infinity,
    eloriaCodeAccess: true,
    browsingSessions: Infinity,
    eloriaWebAccess: true,
  },
};

/**
 * Returns the limits object for a given user (based on role/plan).
 */
export function getLimitsForUser(user) {
  if (user.role === "admin") return PLANS.admin;
  if (user.plan === "pro") return PLANS.pro;
  return PLANS.free;
}