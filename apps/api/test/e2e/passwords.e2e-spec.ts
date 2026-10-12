import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { InvitationsService } from '../../src/modules/auth/invitations.service';
import { createAdmin, createCompany, createEmployee, newDevice, PASSWORD } from '../factories';
import { createTestApp, type TestApp } from '../test-app';

const NEW_PASSWORD = 'Brand-new-pass9';

describe('Forgot, reset, invitation and change password (PRD §9.7)', () => {
  let t: TestApp;
  let companyId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await t.reset();
    companyId = (await createCompany(t.prisma)).id;
  });

  const adminSignIn = (email: string, password = PASSWORD) =>
    t.http.post('/v1/auth/admin/sign-in').send({ email, password });

  it('resets the password with a single-use link and signs out every session', async () => {
    const admin = await createAdmin(t.prisma, companyId);
    const session = (await adminSignIn(admin.user.email).expect(200)).body;

    await t.http.post('/v1/auth/forgot-password').send({ email: admin.user.email }).expect(204);
    const token = t.mail.tokenFrom(await t.mail.waitFor(admin.user.email));

    await t.http
      .post('/v1/auth/reset-password')
      .send({ token, password: NEW_PASSWORD })
      .expect(204);

    await adminSignIn(admin.user.email).expect(401);
    await adminSignIn(admin.user.email, NEW_PASSWORD).expect(200);
    await t.http.post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    const reuse = await t.http
      .post('/v1/auth/reset-password')
      .send({ token, password: 'Another-pass9' })
      .expect(400);
    expect(reuse.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('answers 204 for unknown emails without sending anything', async () => {
    await t.http
      .post('/v1/auth/forgot-password')
      .send({ email: 'nobody@clockin.test' })
      .expect(204);
    await new Promise((r) => setTimeout(r, 100));
    expect(t.mail.sent).toHaveLength(0);
  });

  it('rejects an expired reset link', async () => {
    const admin = await createAdmin(t.prisma, companyId);
    await t.http.post('/v1/auth/forgot-password').send({ email: admin.user.email }).expect(204);
    const token = t.mail.tokenFrom(await t.mail.waitFor(admin.user.email));
    await t.prisma.system.passwordReset.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await t.http
      .post('/v1/auth/reset-password')
      .send({ token, password: NEW_PASSWORD })
      .expect(400);
  });

  it('enforces the password policy', async () => {
    const admin = await createAdmin(t.prisma, companyId);
    await t.http.post('/v1/auth/forgot-password').send({ email: admin.user.email }).expect(204);
    const token = t.mail.tokenFrom(await t.mail.waitFor(admin.user.email));

    const res = await t.http
      .post('/v1/auth/reset-password')
      .send({ token, password: 'short' })
      .expect(422);
    expect(res.body).toMatchObject({ code: 'PASSWORD_POLICY' });
    expect(res.body.details.violations).toEqual(['MIN_LENGTH', 'UPPERCASE', 'DIGIT']);
    const same = await t.http
      .post('/v1/auth/reset-password')
      .send({ token, password: PASSWORD })
      .expect(422);
    expect(same.body.code).toBe('PASSWORD_REUSED');
  });

  it('accepts an invitation through the reset flow and activates the account', async () => {
    const { user } = await createEmployee(t.prisma, companyId, { password: null });
    await TenantContext.run(() => t.app.get(InvitationsService).send(user.id), companyId);
    const token = t.mail.tokenFrom(await t.mail.waitFor(user.email));

    await t.http
      .post('/v1/auth/reset-password')
      .send({ token, password: NEW_PASSWORD })
      .expect(204);

    const activated = await t.prisma.system.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(activated.status).toBe('ACTIVE');
    await t.http
      .post('/v1/auth/mobile/sign-in')
      .send({ login: user.email, password: NEW_PASSWORD, device: newDevice() })
      .expect(200);
  });

  describe('change password', () => {
    it('keeps the current session and revokes the others', async () => {
      const admin = await createAdmin(t.prisma, companyId);
      const current = (await adminSignIn(admin.user.email).expect(200)).body;
      const other = (await adminSignIn(admin.user.email).expect(200)).body;
      const change = (body: object) =>
        t.http
          .post('/v1/auth/change-password')
          .set('authorization', `Bearer ${current.accessToken}`)
          .send(body);

      expect(
        (await change({ currentPassword: 'Wrong-pass99', newPassword: NEW_PASSWORD }).expect(422))
          .body.code,
      ).toBe('CURRENT_PASSWORD_INVALID');
      expect(
        (await change({ currentPassword: PASSWORD, newPassword: PASSWORD }).expect(422)).body.code,
      ).toBe('PASSWORD_REUSED');
      await change({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD }).expect(204);

      await t.http
        .get('/v1/admin/me')
        .set('authorization', `Bearer ${current.accessToken}`)
        .expect(200);
      await t.http
        .get('/v1/admin/me')
        .set('authorization', `Bearer ${other.accessToken}`)
        .expect(401);
      await adminSignIn(admin.user.email, NEW_PASSWORD).expect(200);
      const audit = await t.prisma.system.auditLog.findFirst({
        where: { action: 'auth.password_changed' },
      });
      expect(audit?.entityId).toBe(admin.userId);
    });
  });
});
