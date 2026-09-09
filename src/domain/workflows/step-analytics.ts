export interface WorkflowAnalyticsEvent {
  enrollmentId: string;
  workflowId: string;
  fanId: string;
  type: "SEND" | "REPLY" | "CONVERSION";
  occurredAt: Date;
  stepId?: string;
  stepName?: string;
  templateId?: string;
  templateName?: string;
  messageKind?: "MESSAGE" | "PPV";
  amountMinor?: number;
}

export interface WorkflowStepAnalytics {
  workflowId: string;
  stepId: string;
  stepName: string;
  templateId: string;
  templateName: string;
  messageKind: "MESSAGE" | "PPV";
  sends: number;
  recipients: number;
  responders: number;
  responseRate: number;
  conversions: number;
  attributedRevenueMinor: number;
  averageResponseMinutes: number | null;
}

export function buildWorkflowStepAnalytics(events: WorkflowAnalyticsEvent[]): WorkflowStepAnalytics[] {
  const sends = events
    .filter((event): event is WorkflowAnalyticsEvent & Required<Pick<WorkflowAnalyticsEvent, "stepId" | "stepName" | "templateId" | "templateName" | "messageKind">> => event.type === "SEND" && Boolean(event.stepId && event.templateId))
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
  const groups = new Map<string, {
    base: Omit<WorkflowStepAnalytics, "sends" | "recipients" | "responders" | "responseRate" | "conversions" | "attributedRevenueMinor" | "averageResponseMinutes">;
    sends: number;
    recipients: Set<string>;
    responders: Map<string, number>;
    conversions: Set<string>;
    attributedRevenueMinor: number;
  }>();

  for (const send of sends) {
    const key = `${send.workflowId}:${send.stepId}`;
    const group = groups.get(key) ?? {
      base: { workflowId: send.workflowId, stepId: send.stepId, stepName: send.stepName, templateId: send.templateId, templateName: send.templateName, messageKind: send.messageKind },
      sends: 0, recipients: new Set<string>(), responders: new Map<string, number>(), conversions: new Set<string>(), attributedRevenueMinor: 0,
    };
    group.sends += 1;
    group.recipients.add(send.fanId);
    groups.set(key, group);
  }

  for (const event of events.filter((item) => item.type !== "SEND").sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())) {
    const send = sends.findLast((candidate) => candidate.enrollmentId === event.enrollmentId && candidate.occurredAt <= event.occurredAt);
    if (!send) continue;
    const group = groups.get(`${send.workflowId}:${send.stepId}`);
    if (!group) continue;
    if (event.type === "REPLY") {
      const elapsedMinutes = Math.max(0, (event.occurredAt.getTime() - send.occurredAt.getTime()) / 60_000);
      const current = group.responders.get(event.fanId);
      if (current === undefined || elapsedMinutes < current) group.responders.set(event.fanId, elapsedMinutes);
    } else {
      group.conversions.add(event.fanId);
      group.attributedRevenueMinor += event.amountMinor ?? 0;
    }
  }

  return [...groups.values()].map((group) => {
    const responseMinutes = [...group.responders.values()];
    return {
      ...group.base,
      sends: group.sends,
      recipients: group.recipients.size,
      responders: group.responders.size,
      responseRate: group.recipients.size ? group.responders.size / group.recipients.size * 100 : 0,
      conversions: group.conversions.size,
      attributedRevenueMinor: group.attributedRevenueMinor,
      averageResponseMinutes: responseMinutes.length ? responseMinutes.reduce((total, value) => total + value, 0) / responseMinutes.length : null,
    };
  });
}
