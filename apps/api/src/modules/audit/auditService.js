export function createAuditService(store) {
  return {
    async record({ actorUserId = null, tenantId = null, action, entityType, entityId = null, details = {}, request }) {
      return store.appendAuditEvent({
        actorUserId,
        tenantId,
        action,
        entityType,
        entityId,
        details,
        ipAddress: request?.ip,
        correlationId: request?.res?.locals?.correlationId
      });
    }
  };
}
