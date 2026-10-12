import {
  createAdmin,
  createCompany,
  createConsent,
  createEmployee,
  newDevice,
  PASSWORD,
} from '../factories';
import { createTestApp, type TestApp } from '../test-app';

describe('Mobile sign-in and device binding (FR-M1, FR-M3)', () => {
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

  const signIn = (login: string, device = newDevice(), password = PASSWORD) =>
    t.http.post('/v1/auth/mobile/sign-in').send({ login, password, device });

  it('binds the phone on first sign-in with email', async () => {
    const { user, employee } = await createEmployee(t.prisma, companyId);
    await createConsent(t.prisma, companyId);

    const res = await signIn(user.email).expect(200);

    expect(res.body).toMatchObject({ consentRequired: true });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    const devices = await t.prisma.system.device.findMany({ where: { employeeId: employee.id } });
    expect(devices).toHaveLength(1);
    expect(devices[0]?.revokedAt).toBeNull();
    const audit = await t.prisma.system.auditLog.findFirst({ where: { action: 'device.bound' } });
    expect(audit?.entityId).toBe(employee.id);
  });

  it('signs in with Employee ID and the same phone again', async () => {
    const { employee } = await createEmployee(t.prisma, companyId, { code: 'SAS-042' });
    const device = newDevice();
    await signIn('SAS-042', device).expect(200);
    await signIn('SAS-042', device).expect(200);
    expect(await t.prisma.system.device.count({ where: { employeeId: employee.id } })).toBe(1);
  });

  it('rejects a wrong password and an unknown login with the same error', async () => {
    const { user } = await createEmployee(t.prisma, companyId);
    const wrong = await signIn(user.email, newDevice(), 'Wrong-password-1').expect(401);
    const unknown = await signIn('nobody@clockin.test').expect(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks the account after 5 wrong passwords, even for the right one', async () => {
    const { user } = await createEmployee(t.prisma, companyId);
    for (let attempt = 1; attempt <= 4; attempt++) {
      await signIn(user.email, newDevice(), 'Wrong-password-1').expect(401);
    }
    const fifth = await signIn(user.email, newDevice(), 'Wrong-password-1').expect(423);
    expect(fifth.body.code).toBe('ACCOUNT_LOCKED');
    expect(fifth.body.details.lockedUntil).toEqual(expect.any(String));

    const correct = await signIn(user.email).expect(423);
    expect(correct.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('refuses an unknown phone with 409 and creates one pending new-phone request', async () => {
    const { user, employee } = await createEmployee(t.prisma, companyId);
    await signIn(user.email).expect(200);

    const res = await signIn(user.email, newDevice({ platform: 'IOS' })).expect(409);
    expect(res.body.code).toBe('DEVICE_NOT_RECOGNIZED');
    await signIn(user.email, newDevice()).expect(409);

    const requests = await t.prisma.system.deviceChangeRequest.findMany({
      where: { employeeId: employee.id },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      status: 'PENDING',
      platform: 'ANDROID',
      id: res.body.details.deviceChangeRequestId,
    });
  });

  it('keeps non-employee admins and deactivated employees out of the app', async () => {
    const admin = await createAdmin(t.prisma, companyId);
    const { user } = await createEmployee(t.prisma, companyId, { status: 'DEACTIVATED' });

    expect((await signIn(admin.user.email).expect(403)).body.code).toBe('MOBILE_ACCESS_DENIED');
    expect((await signIn(user.email).expect(403)).body.code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('rate limits sign-in per IP', async () => {
    for (let attempt = 1; attempt <= 20; attempt++) {
      await signIn('nobody@clockin.test').expect(401);
    }
    expect((await signIn('nobody@clockin.test').expect(429)).body.code).toBe('RATE_LIMITED');
  });

  describe('/v1/me', () => {
    it('requires the bound phone header and returns the profile', async () => {
      const { user } = await createEmployee(t.prisma, companyId);
      const device = newDevice();
      const { accessToken } = (await signIn(user.email, device).expect(200)).body;

      await t.http.get('/v1/me').set('authorization', `Bearer ${accessToken}`).expect(403);
      await t.http
        .get('/v1/me')
        .set('authorization', `Bearer ${accessToken}`)
        .set('x-device-id', newDevice().id)
        .expect(403);
      const me = await t.http
        .get('/v1/me')
        .set('authorization', `Bearer ${accessToken}`)
        .set('x-device-id', device.id)
        .expect(200);
      expect(me.body).toMatchObject({
        email: user.email,
        roles: ['STAFF'],
        device: { platform: 'ANDROID' },
      });
    });

    it('accepts the current consent version and refuses a stale one', async () => {
      const { user } = await createEmployee(t.prisma, companyId);
      await createConsent(t.prisma, companyId, 1);
      await createConsent(t.prisma, companyId, 2);
      const device = newDevice();
      const { accessToken } = (await signIn(user.email, device).expect(200)).body;
      const auth = (req: ReturnType<typeof t.http.get>) =>
        req.set('authorization', `Bearer ${accessToken}`).set('x-device-id', device.id);

      const stale = await auth(t.http.post('/v1/me/consent')).send({ version: 1 }).expect(409);
      expect(stale.body).toMatchObject({
        code: 'CONSENT_VERSION_STALE',
        details: { currentVersion: 2 },
      });
      await auth(t.http.post('/v1/me/consent')).send({ version: 2 }).expect(204);

      const me = await auth(t.http.get('/v1/me')).expect(200);
      expect(me.body.consent).toMatchObject({
        currentVersion: 2,
        acceptedVersion: 2,
        required: false,
      });
    });
  });
});
