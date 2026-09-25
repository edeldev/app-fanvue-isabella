WITH "FanLifecycleFacts" AS (
  SELECT
    f."id",
    COUNT(DISTINCT p."id") FILTER (WHERE p."amountMinor" > 0 AND p."reversedAt" IS NULL) AS "paidPurchases",
    COUNT(DISTINCT m."id") FILTER (WHERE m."direction" = 'INBOUND' AND m."deletedAt" IS NULL) AS "inboundMessages",
    MAX(s."startedAt") FILTER (WHERE s."status" IN ('ACTIVE', 'CANCEL_AT_PERIOD_END')) AS "activeStartedAt",
    MAX(COALESCE(s."endedAt", s."updatedAt")) FILTER (WHERE s."status" IN ('EXPIRED', 'CANCELLED') OR s."endedAt" IS NOT NULL) AS "lastEndedAt"
  FROM "Fan" f
  LEFT JOIN "Purchase" p ON p."fanId" = f."id"
  LEFT JOIN "Subscription" s ON s."fanId" = f."id"
  LEFT JOIN "Conversation" c ON c."fanId" = f."id"
  LEFT JOIN "Message" m ON m."conversationId" = c."id"
  GROUP BY f."id"
), "CalculatedLifecycle" AS (
  SELECT
    f."id",
    CASE
      WHEN f."isSubscriber" AND f."isNonRenewingSubscriber" THEN 'NON_RENEWING'::"FanLifecycleStage"
      WHEN NOT f."isSubscriber" AND f."isExpiredSubscriber" THEN 'EXPIRED'::"FanLifecycleStage"
      WHEN f."isSubscriber" AND facts."lastEndedAt" IS NOT NULL AND facts."activeStartedAt" > facts."lastEndedAt" AND facts."activeStartedAt" >= NOW() - INTERVAL '30 days' THEN 'REACTIVATED'::"FanLifecycleStage"
      WHEN f."totalSpentMinor" >= 10000 OR (f."isTopSpender" AND f."totalSpentMinor" > 0) THEN 'VIP'::"FanLifecycleStage"
      WHEN f."totalSpentMinor" >= 5000 THEN 'HIGH_VALUE'::"FanLifecycleStage"
      WHEN facts."paidPurchases" >= 2 THEN 'REPEAT_BUYER'::"FanLifecycleStage"
      WHEN facts."paidPurchases" = 1 THEN 'FIRST_BUYER'::"FanLifecycleStage"
      WHEN f."isSubscriber" AND facts."activeStartedAt" >= NOW() - INTERVAL '7 days' THEN 'NEW_SUBSCRIBER'::"FanLifecycleStage"
      WHEN facts."inboundMessages" >= 3 AND f."lastActivityAt" >= NOW() - INTERVAL '30 days' THEN 'ENGAGED'::"FanLifecycleStage"
      ELSE 'FOLLOWER'::"FanLifecycleStage"
    END AS "stage"
  FROM "Fan" f
  JOIN "FanLifecycleFacts" facts ON facts."id" = f."id"
  WHERE f."lifecycleOverride" IS NULL
)
UPDATE "Fan" f
SET
  "lifecycleStage" = calculated."stage",
  "lifecycleChangedAt" = CASE WHEN f."lifecycleStage" <> calculated."stage" THEN NOW() ELSE f."lifecycleChangedAt" END,
  "lifecycleReason" = CASE calculated."stage"
    WHEN 'NON_RENEWING' THEN 'Tiene acceso activo, pero la renovación automática está desactivada.'
    WHEN 'EXPIRED' THEN 'Su acceso de suscripción terminó y todavía no se ha reactivado.'
    WHEN 'REACTIVATED' THEN 'Volvió a tener una suscripción activa después de una suscripción terminada.'
    WHEN 'VIP' THEN 'Alcanzó el nivel VIP por gasto confirmado o clasificación de top spender.'
    WHEN 'HIGH_VALUE' THEN 'Su gasto confirmado alcanzó el umbral de alto valor.'
    WHEN 'REPEAT_BUYER' THEN 'Tiene dos o más compras pagadas y no revertidas.'
    WHEN 'FIRST_BUYER' THEN 'Realizó su primera compra pagada y no revertida.'
    WHEN 'NEW_SUBSCRIBER' THEN 'Inició recientemente una suscripción activa.'
    WHEN 'ENGAGED' THEN 'Ha conversado y mostrado actividad recientemente.'
    ELSE 'Sigue la cuenta, pero aún no presenta una señal posterior del ciclo de vida.'
  END
FROM "CalculatedLifecycle" calculated
WHERE f."id" = calculated."id";
