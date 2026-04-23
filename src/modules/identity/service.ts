import { ApiKeyAuthenticationService } from './api-key-authentication.service';
import { ApiKeyLifecycleService } from './api-key-lifecycle.service';
import { EmailVerificationService } from './email-verification.service';
import { IdentityLoginService } from './identity-login.service';
import { IdentityRegistrationService } from './identity-registration.service';
import { LoginAuditService } from './login-audit.service';
import { OperatorAuthenticationService } from './operator-authentication.service';
import { OperatorPrincipalService } from './operator-principal.service';
import { SensitiveActionAuthorizationService } from './sensitive-action-authorization.service';
import { IdentitySessionService } from './session.service';
import { TotpFactorService } from './totp-factor.service';
import { TransactionalEmailDeliveryService } from './transactional-email-delivery.service';
import type {
  AuthenticateApiKeyInput,
  AuthenticateHmacApiKeyInput,
  AuthorizeSensitiveActionWithTotpInput,
  ConfirmTotpSetupInput,
  CreateApiKeyInput,
  CreateOperatorInput,
  CreateOperatorTokenInput,
  LinkExistingUserInput,
  LoginInput,
  RegisterInput,
  RequestEmailVerificationInput,
  RevokeApiKeyInput,
  RevokeOperatorTokenInput,
  RevokeSessionInput,
  RotateApiKeyInput,
  SetupTotpInput,
  VerifyEmailInput,
  VerifyTotpLoginInput,
} from './types';

export class IdentityService {
  private readonly loginAuditService = new LoginAuditService();
  private readonly sessionService = new IdentitySessionService();
  private readonly transactionalEmailDeliveryService =
    new TransactionalEmailDeliveryService();
  private readonly registrationService = new IdentityRegistrationService(
    this.transactionalEmailDeliveryService,
  );
  private readonly emailVerificationService = new EmailVerificationService(
    this.transactionalEmailDeliveryService,
  );
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
  private readonly operatorPrincipalService = new OperatorPrincipalService();
  private readonly operatorAuthenticationService =
    new OperatorAuthenticationService();

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

  async createOperator(input: CreateOperatorInput) {
    return this.operatorPrincipalService.createOperator(input);
  }

  async listOperators(input: { limit: number }) {
    return this.operatorPrincipalService.listOperators(input);
  }

  async createOperatorToken(input: CreateOperatorTokenInput) {
    return this.operatorPrincipalService.createOperatorToken(input);
  }

  async revokeOperatorToken(input: RevokeOperatorTokenInput) {
    return this.operatorPrincipalService.revokeOperatorToken(input);
  }

  async authenticateOperatorToken(
    rawToken: string,
    requiredPermission?: Parameters<
      OperatorAuthenticationService['authenticateOperatorToken']
    >[1],
  ) {
    return this.operatorAuthenticationService.authenticateOperatorToken(
      rawToken,
      requiredPermission,
    );
  }

  formatOperatorActor(input: { displayName: string | null; email: string }) {
    return this.operatorAuthenticationService.formatActor(input);
  }
}
