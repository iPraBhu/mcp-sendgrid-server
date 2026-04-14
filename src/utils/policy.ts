/**
 * Shared write-operation policy enforcement.
 * Centralizes the READ_ONLY / WRITES_ENABLED / approval-token checks used across domains.
 */

import { getConfig } from "../config/index.js";
import { PolicyError } from "./errors.js";

/**
 * Assert that the current configuration and provided token allow a write operation.
 * Throws a PolicyError if any check fails.
 *
 * @param operation - Human-readable name of the write operation (for error messages)
 * @param approvalToken - Token provided by the caller at runtime
 */
export function assertWriteApproved(operation: string, approvalToken: string | undefined): void {
  const cfg = getConfig().sendgrid;

  if (cfg.readOnly) {
    throw new PolicyError(
      "This server is running in read-only mode. " +
        "Set SENDGRID_READ_ONLY=false AND explicitly enable writes to perform this operation.",
      "READ_ONLY",
    );
  }

  if (!cfg.writesEnabled) {
    throw new PolicyError(
      `[WRITES_DISABLED] Write operations are disabled by configuration. To enable writes: set SENDGRID_WRITES_ENABLED=true and restart the server. (Blocked: ${operation})`,
      "WRITES_DISABLED",
    );
  }

  if (!cfg.writeApprovalToken) {
    throw new PolicyError(
      "[WRITES_MISCONFIGURED] Write operations are enabled but SENDGRID_WRITE_APPROVAL_TOKEN is not set. Restart with a token to proceed.",
      "WRITES_MISCONFIGURED",
    );
  }

  if (!approvalToken || approvalToken !== cfg.writeApprovalToken) {
    throw new PolicyError(
      "[WRITE_APPROVAL_REQUIRED] Runtime write approval is required. Provide 'approval_token' matching SENDGRID_WRITE_APPROVAL_TOKEN.",
      "WRITE_APPROVAL_REQUIRED",
    );
  }
}
