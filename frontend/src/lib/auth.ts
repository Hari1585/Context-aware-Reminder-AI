import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserSession } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID || '',
  ClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '',
};

const userPool = new CognitoUserPool(poolData);

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  static getHostedUIUrl(redirectUri: string): string {
    const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID;
    return `https://${domain}/login?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  static getLogoutUrl(redirectUri: string): string {
    const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID;
    return `https://${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(redirectUri)}`;
  }

  static getCurrentUser(): CognitoUser | null {
    return userPool.getCurrentUser();
  }

  static getSession(): Promise<CognitoUserSession> {
    const user = this.getCurrentUser();
    if (!user) {
      return Promise.reject(new Error('No current user'));
    }

    return new Promise((resolve, reject) => {
      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(err || new Error('No session'));
        } else {
          resolve(session);
        }
      });
    });
  }

  static async getIdToken(): Promise<string> {
    const session = await this.getSession();
    return session.getIdToken().getJwtToken();
  }

  static async getAccessToken(): Promise<string> {
    const session = await this.getSession();
    return session.getAccessToken().getJwtToken();
  }

  static signOut(): void {
    const user = this.getCurrentUser();
    if (user) {
      user.signOut();
    }
    // Clear local storage
    localStorage.clear();
  }

  static async isAuthenticated(): Promise<boolean> {
    try {
      await this.getSession();
      return true;
    } catch {
      return false;
    }
  }

  // For OAuth code exchange (called from callback page)
  static async exchangeCodeForTokens(code: string, redirectUri: string): Promise<AuthTokens> {
    const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID;
    
    const response = await fetch(`https://${domain}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId!,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const data = await response.json();
    return {
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }
}
