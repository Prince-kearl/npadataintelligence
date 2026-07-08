TRUNCATE TABLE
  public.incident_attachments,
  public.incident_response_actions,
  public.incident_status_history,
  public.cases,
  public.incidents,
  public.notifications,
  public.audit_logs,
  public.auth_events,
  public.export_history,
  public.query_templates
RESTART IDENTITY CASCADE;