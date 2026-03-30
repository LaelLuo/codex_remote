import { describe, expect, test } from "bun:test";
import { buildAccountAuthCardModel } from "./account-auth-card";

describe("account auth card model", () => {
  test("shows missing passkey next to configured totp", () => {
    const card = buildAccountAuthCardModel({
      hasPasskey: false,
      hasTotp: true,
      accountTotpFlow: "idle",
      accountNotice: null,
    });

    expect(card.titleKey).toBe("settings.account.title.signInMethods");
    expect(card.passkey.statusKey).toBe("settings.account.passkey.unbound");
    expect(card.passkey.actionKey).toBe("settings.account.passkey.bind");
    expect(card.totp.statusKey).toBe("settings.account.totp.bound");
    expect(card.totp.actionKey).toBe("settings.account.totp.rebind");
  });

  test("surfaces rebind confirmation copy before starting new totp setup", () => {
    const card = buildAccountAuthCardModel({
      hasPasskey: true,
      hasTotp: true,
      accountTotpFlow: "confirm_rebind",
      accountNotice: null,
    });

    expect(card.confirmation).toEqual({
      titleKey: "settings.account.confirm.totpRebind",
      detailKey: "settings.account.confirm.totpRebindDetail",
      noteKey: "settings.account.notice.deviceUnaffected",
    });
  });

  test("passes through translated success notice keys", () => {
    const card = buildAccountAuthCardModel({
      hasPasskey: true,
      hasTotp: true,
      accountTotpFlow: "idle",
      accountNotice: {
        kind: "key",
        key: "settings.account.notice.totpRebound",
      },
    });

    expect(card.notice).toEqual({
      kind: "key",
      key: "settings.account.notice.totpRebound",
    });
  });
});
