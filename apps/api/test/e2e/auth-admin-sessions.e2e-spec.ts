import { createAdmin, createCompany, createEmployee, newDevice, PASSWORD } from '../factories';
import { createTestApp, type TestApp } from '../test-app';

describe('Admin sign-in, refresh rotation and sign-out', () => {
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
  const refresh = (refreshToken: string) => t.http.post('/v1/auth/refresh').send({ refreshToken });
  const adminMe = (accessToken: string) =>
    t.http.get('/v1/admin/me').set('authorization', `Bearer ${accessToken}`);

  it('signs in an admin and returns role, scope and permissions', async () => {
    const admin = await createAdmin(t.prisma, companyId, { role: 'HR' });
    const { accessToken } = (await adminSignIn(admin.user.email).expect(200)).body;

    const me = await adminMe(accessToken).expect(200);
    expect(me.body).toMatchObject({ role: 'HR', scope: { kind: 'ALL' }, email: admin.user.email });
    expect(me.body.permissions).toContain('review.decide');
    expect(me.body.permissions).not.toContain('employees.write');
  });

  it('refuses web sign-in without admin access, and after access is removed', async () => {
    const { user } = await createEmployee(t.prisma, companyId);
    expect((await adminSignIn(user.email).expect(403)).body.code).toBe('NO_ADMIN_ACCESS');

    const admin = await createAdmin(t.prisma, companyId);
    const { accessToken } = (await adminSignIn(admin.user.email).expect(200)).body;
    await t.prisma.system.adminUser.update({
      where: { id: admin.id },
      data: { status: 'REMOVED' },
    });
    await adminMe(accessToken).expect(401);
    expect((await adminSignIn(admin.user.email).expect(403)).body.code).toBe('NO_ADMIN_ACCESS');
  });

  it('keeps audiences apart: a mobile token cannot call admin routes', async () => {
    const { user, employee } = await createEmployee(t.prisma, companyId);
    await createAdmin(t.prisma, companyId, {
      employee: { userId: user.id, employeeId: employee.id },
    });
    const mobile = await t.http
      .post('/v1/auth/mobile/sign-in')
      .send({ login: user.email, password: PASSWORD, device: newDevice() })
      .expect(200);
    await adminMe(mobile.body.accessToken).expect(401);
  });

  it('rotates the refresh token and revokes the family when an old one is reused', async () => {
    const admin = await createAdmin(t.prisma, companyId);
    const first = (await adminSignIn(admin.user.email).expect(200)).body;

    const second = (await refresh(first.refreshToken).expect(200)).body;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await adminMe(second.accessToken).expect(200);

    // Reusing the rotated token = theft signal: everything in the family dies.
    expect((await refresh(first.refreshToken).expect(401)).body.code).toBe('TOKEN_INVALID');
    await refresh(second.refreshToken).expect(401);
    await adminMe(second.accessToken).expect(401);

    const revoked = await t.prisma.system.session.findMany({
      where: { revokedReason: 'REFRESH_REUSE' },
    });
    expect(revoked).toHaveLength(1);
  });

  it('signs out the current session only', async () => {
    const admin = await createAdmin(t.prisma, companyId);
    const a = (await adminSignIn(admin.user.email).expect(200)).body;
    const b = (await adminSignIn(admin.user.email).expect(200)).body;

    await t.http
      .post('/v1/auth/sign-out')
      .set('authorization', `Bearer ${a.accessToken}`)
      .expect(204);
    await adminMe(a.accessToken).expect(401);
    await refresh(a.refreshToken).expect(401);
    await adminMe(b.accessToken).expect(200);
  });

  it('rejects requests without a valid token as problem+json', async () => {
    const res = await t.http.get('/v1/admin/me').set('authorization', 'Bearer nope').expect(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
  });

  describe('/v1/app/config', () => {
    it('resolves the only company without a header', async () => {
      const res = await t.http.get('/v1/app/config').expect(200);
      expect(res.body).toMatchObject({ minAppVersion: '1.0.0', features: { requests: false } });
      expect(res.headers['x-server-time']).toEqual(expect.any(String));
    });

    it('needs the x-company header once there are several companies', async () => {
      const other = await createCompany(t.prisma, { slug: 'other', name: 'Other Co' });
      expect((await t.http.get('/v1/app/config').expect(400)).body.code).toBe(
        'COMPANY_NOT_RESOLVED',
      );
      const res = await t.http.get('/v1/app/config').set('x-company', other.slug).expect(200);
      expect(res.body.company.name).toBe('Other Co');
    });
  });
});
