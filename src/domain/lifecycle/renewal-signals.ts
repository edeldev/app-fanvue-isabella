export function reconcileRenewalSignals(
  apiAutoRenewalEnabled: boolean | null,
  inAutoRenewingList: boolean,
  inNonRenewingList: boolean,
) {
  const listsAgree = inAutoRenewingList !== inNonRenewingList;
  const listValue = inAutoRenewingList ? true : inNonRenewingList ? false : null;
  const conflict = (inAutoRenewingList && inNonRenewingList)
    || (listsAgree && apiAutoRenewalEnabled !== null && listValue !== apiAutoRenewalEnabled);
  const confirmed = listsAgree && !conflict;

  return {
    isAutoRenewingSubscriber: confirmed && inAutoRenewingList,
    isNonRenewingSubscriber: confirmed && inNonRenewingList,
    renewalSignalsConflict: conflict,
  };
}

export function renewalLabel(fan: {
  isAutoRenewingSubscriber: boolean;
  isNonRenewingSubscriber: boolean;
  renewalSignalsConflict: boolean;
}) {
  if (fan.renewalSignalsConflict || (fan.isAutoRenewingSubscriber && fan.isNonRenewingSubscriber)) {
    return "Por confirmar · datos contradictorios en Fanvue";
  }
  if (fan.isAutoRenewingSubscriber) return "Automática encendida";
  if (fan.isNonRenewingSubscriber) return "Automática apagada";
  return "Por confirmar";
}
