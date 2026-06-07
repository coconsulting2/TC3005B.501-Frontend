/**
 * Cliente para POST /api/workflow-rules/preview
 */
import { apiRequest } from "@utils/apiClient";
import type {
  WorkflowRulePreviewRequest,
  WorkflowRulePreviewResponse,
} from "@type/WorkflowRuleTypes";

export async function previewWorkflowRules(
  payload: WorkflowRulePreviewRequest,
  headers?: Record<string, string>,
): Promise<WorkflowRulePreviewResponse> {
  return apiRequest<WorkflowRulePreviewResponse>("/workflow-rules/preview", {
    method: "POST",
    data: payload,
    headers,
  });
}
