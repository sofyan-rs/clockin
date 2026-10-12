import { parseCompanySettings } from './company-settings';

describe('parseCompanySettings', () => {
  it('fills PRD §9.6 defaults for an empty object', () => {
    const settings = parseCompanySettings({});
    expect(settings.privacy.selfieRetentionMonths).toBe(3);
    expect(settings.privacy.locationRetentionMonths).toBe(12);
    expect(settings.clockIn.blockFakeGps).toBe(true);
    expect(settings.mobileApp.autoSignOutDays).toBe(30);
    expect(settings.features).toEqual({ requests: false, notifications: false, holidays: false });
  });

  it('keeps stored values and fills the rest', () => {
    const settings = parseCompanySettings({ privacy: { selfieRetentionMonths: 12 } });
    expect(settings.privacy).toEqual({ selfieRetentionMonths: 12, locationRetentionMonths: 12 });
  });

  it('rejects retention options outside the allowed list', () => {
    expect(() => parseCompanySettings({ privacy: { selfieRetentionMonths: 5 } })).toThrow();
  });
});
