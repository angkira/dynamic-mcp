import { OAuth2Client } from 'google-auth-library'
import { OAuthApp } from '@octokit/oauth-app'

export interface OAuthUser {
  email: string
  name?: string
  providerUserId: string
}

export class OAuthService {
  private googleClient: OAuth2Client
  private githubApp: OAuthApp

  constructor() {
    const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    const googleRedirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
    if (!googleClientId || !googleClientSecret || !googleRedirectUri) {
      throw new Error('Missing Google OAuth configuration')
    }

    this.googleClient = new OAuth2Client(googleClientId, googleClientSecret, googleRedirectUri)

    const githubClientId = process.env.GITHUB_OAUTH_CLIENT_ID
    const githubClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
    if (!githubClientId || !githubClientSecret) {
      throw new Error('Missing GitHub OAuth configuration')
    }

    this.githubApp = new OAuthApp({
      clientType: 'oauth-app',
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    })
  }

  getGoogleAuthUrl(state: string) {
    const scopes = ['openid', 'email', 'profile']
    return this.googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent',
    })
  }

  async exchangeGoogleCode(code: string): Promise<OAuthUser> {
    if (!code) throw new Error('Missing Google authorization code')
    const { tokens } = await this.googleClient.getToken(code)
    if (!tokens.id_token) throw new Error('Missing Google id_token')
    const ticket = await this.googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    })
    const payload = (ticket.getPayload() || {}) as { email?: string; name?: string; sub?: string }
    const email = payload.email
    if (!email) throw new Error('Google token missing email')
    const providerUserId = payload.sub || ''
    if (!providerUserId) throw new Error('Google token missing subject id')
    return { email, name: payload.name || undefined, providerUserId }
  }

  getGithubAuthUrl(state: string) {
    const { url } = this.githubApp.getWebFlowAuthorizationUrl({
      state,
      scopes: ['read:user', 'user:email'],
    })
    return url
  }

  async exchangeGithubCode(code: string): Promise<OAuthUser> {
    if (!code) throw new Error('Missing GitHub authorization code')
    const { authentication } = await this.githubApp.createToken({ code })
    const accessToken = authentication.token
    // Fetch primary email
    const emailsResp = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    } as any)
    const emails = (await emailsResp.json()) as Array<{ email: string; primary: boolean; verified: boolean }>
    const primary = emails.find((e) => e.primary && e.verified) || emails[0]
    if (!primary?.email) throw new Error('GitHub account has no email')

    // Fetch profile (for name)
    const profileResp = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    } as any)
    const profile = (await profileResp.json()) as { id?: number; name?: string; login?: string }
    const providerUserId = (profile.id ?? profile.login ?? '').toString()
    if (!providerUserId) throw new Error('GitHub profile missing id')
    return { email: primary.email, name: profile.name || profile.login || undefined, providerUserId }
  }
}

export const oauthService = new OAuthService()


