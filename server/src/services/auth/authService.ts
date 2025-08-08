import JWTService from './jwtService'
import { oauthService } from './oauthService'

export class AuthService {
  constructor(private readonly jwtService: JWTService) { }

  async signup(email: string, password: string, name?: string) {
    return this.jwtService.signup(email, password, name)
  }

  async login(email: string, password: string) {
    const result = await this.jwtService.login(email, password)
    if (!result) {
      throw new Error('Invalid credentials')
    }
    return result
  }

  async getDemoToken() {
    return this.jwtService.ensureDemoUserWithToken()
  }

  getGoogleAuthUrl(state: string) {
    return oauthService.getGoogleAuthUrl(state)
  }

  async handleGoogleCallback(code: string) {
    const { email, name } = await oauthService.exchangeGoogleCode(code)
    return this.jwtService.findOrCreateByEmail(email, name)
  }

  getGithubAuthUrl(state: string) {
    return oauthService.getGithubAuthUrl(state)
  }

  async handleGithubCallback(code: string) {
    const { email, name } = await oauthService.exchangeGithubCode(code)
    return this.jwtService.findOrCreateByEmail(email, name)
  }
}

export function createAuthService(jwtService: JWTService) {
  return new AuthService(jwtService)
}


