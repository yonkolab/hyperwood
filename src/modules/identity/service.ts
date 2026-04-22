import { ApiKeyAuthenticationService } from './api-key-authentication.service';
import { ApiKeyLifecycleService } from './api-key-lifecycle.service';
import { EmailVerificationService } from './email-verification.service';
import { IdentityLoginService } from './identity-login.service';
import { IdentityRegistrationService } from './identity-registration.service';
import { LoginAuditService } from './login-audit.service';
import { SensitiveActionAuthorizationService } from './sensitive-action-authorization.service';
import { IdentitySessionService } from './session.service';
import { TotpFactorService } from './totp-factor.service';
import type {
  AuthenticateApiKeyInput,
  AuthenticateHmacApiKeyInput,
  AuthorizeSensitiveActionWithTotpInput,
  ConfirmTotpSetupInput,
  CreateApiKeyInput,
  LinkExistingUserInput,
  LoginInput,
  RegisterInput,
  RequestEmailVerificationInput,
  RevokeApiKeyInput,
  RevokeSessionInput,
  RotateApiKeyInput,
  SetupTotpInput,
  VerifyEmailInput,
  VerifyTotpLoginInput,
} from './types';

export class IdentityService {
  private readonly loginAuditService = new LoginAuditService();
  private readonly sessionService = new IdentitySessionService();
  private readonly registrationService = new IdentityRegistrationService();
  private readonly emailVerificationService = new EmailVerificationService();
  private readonly loginService = new IdentityLoginService(
    this.loginAuditService,
    this.sessionService,
  );
  private readonly totpFactorService = new TotpFactorService(
    this.sessionService,
    this.loginAuditService,
  );
  private readonly sensitiveActionAuthorizationService =
    new SensitiveActionAuthorizationService();
  private readonly apiKeyLifecycleService = new ApiKeyLifecycleService();
  private readonly apiKeyAuthenticationService =
    new ApiKeyAuthenticationService();

  async register(input: RegisterInput) {
    return this.registrationService.register(input);
  }

  async login(input: LoginInput) {
    return this.loginService.login(input);
  }

  async getUserFromSessionToken(sessionToken: string) {
    return this.sessionService.getUserFromSessionToken(sessionToken);
  }

  async getSessionFromToken(sessionToken: string) {
    return this.sessionService.getSessionFromToken(sessionToken);
  }

  async listSessions(userId: string, currentSessionToken: string) {
    return this.sessionService.listSessions(userId, currentSessionToken);
  }

  async revokeSession(input: RevokeSessionInput) {
    return this.sessionService.revokeSession(input);
  }

  async requestEmailVerification(input: RequestEmailVerificationInput) {
    return this.emailVerificationService.requestEmailVerification(input);
  }

  async verifyEmail(input: VerifyEmailInput) {
    return this.emailVerificationService.verifyEmail(input);
  }

  async setupTotp(input: SetupTotpInput) {
    return this.totpFactorService.setupTotp(input);
  }

  async confirmTotpSetup(input: ConfirmTotpSetupInput) {
    return this.totpFactorService.confirmTotpSetup(input);
  }

  async verifyTotpLogin(input: VerifyTotpLoginInput) {
    return this.totpFactorService.verifyTotpLogin(input);
  }

  async authorizeSensitiveActionWithTotp(
    input: AuthorizeSensitiveActionWithTotpInput,
  ) {
    return this.sensitiveActionAuthorizationService.authorizeSensitiveActionWithTotp(
      input,
    );
  }

  async linkExistingUser(input: LinkExistingUserInput) {
    return this.registrationService.linkExistingUser(input);
  }

  async createApiKey(input: CreateApiKeyInput) {
    return this.apiKeyLifecycleService.createApiKey(input);
  }

  async listApiKeys(userId: string) {
    return this.apiKeyLifecycleService.listApiKeys(userId);
  }

  async revokeApiKey(input: RevokeApiKeyInput) {
    return this.apiKeyLifecycleService.revokeApiKey(input);
  }

  async rotateApiKey(input: RotateApiKeyInput) {
    return this.apiKeyLifecycleService.rotateApiKey(input);
  }

  async authenticateApiKey(input: AuthenticateApiKeyInput) {
    return this.apiKeyAuthenticationService.authenticateApiKey(input);
  }

  async authenticateHmacApiKey(input: AuthenticateHmacApiKeyInput) {
    return this.apiKeyAuthenticationService.authenticateHmacApiKey(input);
  }
}
