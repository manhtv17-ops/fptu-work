export function canCreateProject(membership) {
  return membership?.role === 'manager' || membership?.role === 'team_lead' || membership?.can_create_project
}
export function canManageWorkspace(membership) { return membership?.role === 'manager' }
export function canManageProject(project, membership, projectMember) {
  return membership?.role === 'manager' || project?.lead_id === membership?.user_id || projectMember?.role_in_project === 'lead' || projectMember?.can_manage_members
}
export function canCreateTask(membership, projectMember) {
  return membership?.role === 'manager' || membership?.role === 'team_lead' || !!projectMember?.can_create_task
}
export function canAssignOutsideProject(membership, projectMember) {
  return membership?.role === 'manager' || !!membership?.can_assign_outside_project || !!projectMember?.can_assign_outside_project
}
export function canReviewTask(membership, projectMember) {
  return membership?.role === 'manager' || membership?.role === 'team_lead' || !!membership?.can_review_task || !!projectMember?.can_review_task
}
