import type { AccountTotpFlow } from "./auth.svelte";

type StoreMessage =
  | { kind: "key"; key: string; params?: Record<string, string | number> }
  | { kind: "text"; text: string };

export interface AccountAuthCardModelInput {
  hasPasskey: boolean;
  hasTotp: boolean;
  accountTotpFlow: AccountTotpFlow;
  accountNotice: StoreMessage | null;
}

interface AccountAuthRowModel {
  statusKey: string;
  actionKey: string | null;
}

interface AccountAuthConfirmationModel {
  titleKey: string;
  detailKey: string;
  noteKey: string;
}

export interface AccountAuthCardModel {
  titleKey: string;
  passkey: AccountAuthRowModel;
  totp: AccountAuthRowModel;
  confirmation: AccountAuthConfirmationModel | null;
  notice: StoreMessage | null;
}

export function buildAccountAuthCardModel(input: AccountAuthCardModelInput): AccountAuthCardModel {
  return {
    titleKey: "settings.account.title.signInMethods",
    passkey: {
      statusKey: input.hasPasskey ? "settings.account.passkey.bound" : "settings.account.passkey.unbound",
      actionKey: input.hasPasskey ? null : "settings.account.passkey.bind",
    },
    totp: {
      statusKey: input.hasTotp ? "settings.account.totp.bound" : "settings.account.totp.unbound",
      actionKey: input.hasTotp ? "settings.account.totp.rebind" : "settings.account.totp.bind",
    },
    confirmation:
      input.accountTotpFlow === "confirm_rebind"
        ? {
            titleKey: "settings.account.confirm.totpRebind",
            detailKey: "settings.account.confirm.totpRebindDetail",
            noteKey: "settings.account.notice.deviceUnaffected",
          }
        : null,
    notice: input.accountNotice,
  };
}
