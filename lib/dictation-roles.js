/**
 * Who may change this app's preferences, its one shared setting (kit rule 1).
 *
 * The owner and a helper may. A member or a viewer sees the saved choices with no
 * Save: online the host refuses every write by a viewer and a member's change of a
 * row someone else added, and these preferences belong to the whole app. Any other
 * answer changes nothing. On the Mac and outside Tellop everyone is the owner.
 */
const CHANGE_ROLES = Object.freeze(['owner', 'helper']);

/** @param {unknown} role @returns {boolean} */
export function canChange(role) {
  return typeof role === 'string' && CHANGE_ROLES.includes(role);
}
