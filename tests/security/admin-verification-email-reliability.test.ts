import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("admin verification email reliability", () => {
  it("commits verification before scheduling email after the response", () => {
    const route = source("src/app/api/admin/agents/[agentId]/route.ts");
    const service = source("src/modules/agents/agent.service.ts");

    expect(route).toContain("after(() => sendVerificationEmailSafely(agentId, status))");
    expect(route).toContain("scheduleVerificationEmail(agentId, body.verificationStatus)");
    expect(service).toContain("return setVerificationStatus(agentId, verificationStatus)");
    expect(service).not.toContain("await sendAgentVerificationEmail(agentId, verificationStatus)");
  });

  it("bounds SMTP connection and socket waits", () => {
    const transactionalEmail = source("src/lib/email/transactional.ts");

    expect(transactionalEmail).toContain("connectionTimeout: 10_000");
    expect(transactionalEmail).toContain("greetingTimeout: 10_000");
    expect(transactionalEmail).toContain("socketTimeout: 15_000");
  });
});
