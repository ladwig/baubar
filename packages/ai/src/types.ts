/**
 * Auth context passed to every tool executor call.
 * The agent service obtains this from the incoming request
 * (e.g. a Bearer token or forwarded Supabase session cookie)
 * and threads it through so tools can call the web API on behalf of the user.
 */
export type OrgContext = {
  /** Bearer token forwarded from the original request */
  token: string
  /** Base URL of apps/web — e.g. http://localhost:3000 in dev, https://app.baubar.de in prod */
  apiBase: string
  orgId: string
  userId: string
}
